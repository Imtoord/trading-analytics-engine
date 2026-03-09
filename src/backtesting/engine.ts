import { Candle } from '../utils/types';
import { BacktestConfig, BacktestResult, Trade, EquityPoint, Metrics } from './types';
import { generateSignals } from './signalGenerator';

export class BacktestEngine {

  run(candles: Candle[], config: BacktestConfig): BacktestResult {
    const start = Date.now();

    const {
      initialCapital = 10000,
      positionSize   = 0.1,
      stopLoss,
      takeProfit,
      commission     = 0.001,
    } = config;

    // ── Generate signals ───────────────────────────────
    const signals    = generateSignals(candles, config.strategy);
    const signalMap  = new Map(signals.map(s => [s.time, s]));

    // ── Simulation state ───────────────────────────────
    let capital    = initialCapital;
    let position: { direction: 'LONG' | 'SHORT'; entryPrice: number; entryTime: string; size: number; signal: string; id: number } | null = null;
    let tradeId    = 0;
    const trades:   Trade[]        = [];
    const equity:   EquityPoint[]  = [];
    let   peakEquity = initialCapital;

    // ── Run through each candle ─────────────────────────
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const sig    = signalMap.get(candle.time);

      // ── Check stop loss / take profit on open position ─
      if (position) {
        const { direction, entryPrice, entryTime, size, signal } = position;
        const comm   = size * candle.close * commission;
        let closed   = false;
        let exitReason: Trade['exitReason'] = null;

        if (direction === 'LONG') {
          const pctMove = (candle.close - entryPrice) / entryPrice;
          if (stopLoss  && pctMove <= -stopLoss)  { closed = true; exitReason = 'STOP_LOSS'; }
          if (takeProfit && pctMove >= takeProfit) { closed = true; exitReason = 'TAKE_PROFIT'; }
        } else {
          const pctMove = (entryPrice - candle.close) / entryPrice;
          if (stopLoss  && pctMove <= -stopLoss)  { closed = true; exitReason = 'STOP_LOSS'; }
          if (takeProfit && pctMove >= takeProfit) { closed = true; exitReason = 'TAKE_PROFIT'; }
        }

        // ── Close on opposite signal ───────────────────
        if (!closed && sig) {
          if (direction === 'LONG'  && sig.signal === 'SELL') { closed = true; exitReason = 'SIGNAL'; }
          if (direction === 'SHORT' && sig.signal === 'BUY')  { closed = true; exitReason = 'SIGNAL'; }
        }

        if (closed) {
          const exitPrice = candle.close;
          const pnl       = direction === 'LONG'
            ? (exitPrice - entryPrice) * size - comm
            : (entryPrice - exitPrice) * size - comm;
          const pnlPct    = (pnl / (entryPrice * size)) * 100;
          capital += pnl;

          trades.push({
            id: position.id, symbol: config.symbol, direction,
            entryTime, entryPrice,
            exitTime: candle.time, exitPrice, exitReason, pnl,
            pnlPct: +pnlPct.toFixed(3), commission: +comm.toFixed(2),
            holdingBars: i - candles.findIndex(c => c.time === entryTime),
            signal,
          });
          position = null;
        }
      }

      // ── Open new position on signal ───────────────────
      if (!position && sig && sig.signal !== 'HOLD') {
        const tradeCapital = capital * positionSize;
        const size         = tradeCapital / candle.close;
        const comm         = tradeCapital * commission;
        capital           -= comm;

        position = {
          id:         ++tradeId,
          direction:  sig.signal === 'BUY' ? 'LONG' : 'SHORT',
          entryPrice: candle.close,
          entryTime:  candle.time,
          size,
          signal:     sig.reason,
        };
      }

      // ── Track equity ───────────────────────────────────
      let unrealized = 0;
      if (position) {
        unrealized = position.direction === 'LONG'
          ? (candle.close - position.entryPrice) * position.size
          : (position.entryPrice - candle.close) * position.size;
      }
      const totalEquity = capital + unrealized;
      peakEquity        = Math.max(peakEquity, totalEquity);
      const drawdown    = ((peakEquity - totalEquity) / peakEquity) * 100;

      equity.push({ time: candle.time, value: +totalEquity.toFixed(2), drawdown: +drawdown.toFixed(2) });
    }

    // ── Close any open position at end ─────────────────
    if (position && candles.length > 0) {
      const last    = candles[candles.length - 1];
      const comm    = position.size * last.close * commission;
      const pnl     = position.direction === 'LONG'
        ? (last.close - position.entryPrice) * position.size - comm
        : (position.entryPrice - last.close) * position.size - comm;
      const pnlPct  = (pnl / (position.entryPrice * position.size)) * 100;
      capital      += pnl;

      trades.push({
        id: position.id, symbol: config.symbol,
        direction: position.direction,
        entryTime: position.entryTime, entryPrice: position.entryPrice,
        exitTime: last.time, exitPrice: last.close,
        exitReason: 'END_OF_DATA', pnl, pnlPct: +pnlPct.toFixed(3),
        commission: +comm.toFixed(2),
        holdingBars: candles.length - candles.findIndex(c => c.time === position!.entryTime),
        signal: position.signal,
      });
    }

    const metrics = this._calcMetrics(trades, equity, initialCapital, capital, candles, config);

    return {
      config,
      trades,
      equity,
      metrics,
      candlesCount: candles.length,
      runTimeMs:    Date.now() - start,
    };
  }

  // ── Calculate all metrics ──────────────────────────────
  private _calcMetrics(
    trades: Trade[],
    equity: EquityPoint[],
    initialCapital: number,
    finalCapital: number,
    candles: Candle[],
    config: BacktestConfig,
  ): Metrics {
    const wins   = trades.filter(t => (t.pnl ?? 0) > 0);
    const losses = trades.filter(t => (t.pnl ?? 0) <= 0);

    const totalReturn    = ((finalCapital - initialCapital) / initialCapital) * 100;
    const maxDrawdown    = Math.max(...equity.map(e => e.drawdown), 0);
    const totalCommissions = trades.reduce((s, t) => s + t.commission, 0);

    // Annualized return (using days between first and last candle)
    const days = candles.length > 1
      ? (new Date(candles[candles.length - 1].time).getTime() - new Date(candles[0].time).getTime()) / 86400000
      : 365;
    const years           = days / 365;
    const annualizedReturn = years > 0 ? (Math.pow(finalCapital / initialCapital, 1 / years) - 1) * 100 : 0;

    // Sharpe ratio (simplified, rf=0)
    const returns = equity.slice(1).map((e, i) => (e.value - equity[i].value) / equity[i].value);
    const avgRet  = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
    const stdRet  = Math.sqrt(returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / (returns.length || 1));
    const sharpe  = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0;

    // Sortino (downside deviation only)
    const negReturns = returns.filter(r => r < 0);
    const downDev    = negReturns.length > 0
      ? Math.sqrt(negReturns.reduce((s, r) => s + r ** 2, 0) / negReturns.length)
      : 0.0001;
    const sortino    = (avgRet / downDev) * Math.sqrt(252);

    // Calmar ratio
    const calmar = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    // Win stats
    const avgWin  = wins.length  > 0 ? wins.reduce((s, t)   => s + (t.pnlPct ?? 0), 0) / wins.length   : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnlPct ?? 0), 0) / losses.length : 0;

    const grossProfit = wins.reduce((s, t)   => s + (t.pnl ?? 0), 0);
    const grossLoss   = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

    const expectancy = trades.length > 0
      ? trades.reduce((s, t) => s + (t.pnl ?? 0), 0) / trades.length
      : 0;

    // Consecutive wins/losses
    let maxConsecWins = 0, maxConsecLosses = 0, curW = 0, curL = 0;
    for (const t of trades) {
      if ((t.pnl ?? 0) > 0) { curW++; curL = 0; maxConsecWins   = Math.max(maxConsecWins, curW); }
      else                   { curL++; curW = 0; maxConsecLosses = Math.max(maxConsecLosses, curL); }
    }

    // Buy & Hold benchmark
    const buyAndHoldReturn = candles.length > 1
      ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100
      : 0;

    return {
      totalReturn:        +totalReturn.toFixed(2),
      annualizedReturn:   +annualizedReturn.toFixed(2),
      cagr:               +annualizedReturn.toFixed(2),
      maxDrawdown:        +maxDrawdown.toFixed(2),
      sharpeRatio:        +sharpe.toFixed(3),
      sortinoRatio:       +sortino.toFixed(3),
      calmarRatio:        +calmar.toFixed(3),
      volatility:         +(stdRet * Math.sqrt(252) * 100).toFixed(2),
      totalTrades:        trades.length,
      winningTrades:      wins.length,
      losingTrades:       losses.length,
      winRate:            trades.length > 0 ? +((wins.length / trades.length) * 100).toFixed(1) : 0,
      avgWin:             +avgWin.toFixed(3),
      avgLoss:            +avgLoss.toFixed(3),
      profitFactor:       +profitFactor.toFixed(3),
      expectancy:         +expectancy.toFixed(2),
      avgHoldingBars:     trades.length > 0 ? +(trades.reduce((s, t) => s + t.holdingBars, 0) / trades.length).toFixed(1) : 0,
      largestWin:         wins.length  > 0 ? +Math.max(...wins.map(t   => t.pnlPct ?? 0)).toFixed(3) : 0,
      largestLoss:        losses.length > 0 ? +Math.min(...losses.map(t => t.pnlPct ?? 0)).toFixed(3) : 0,
      consecutiveWins:    maxConsecWins,
      consecutiveLosses:  maxConsecLosses,
      initialCapital,
      finalCapital:       +finalCapital.toFixed(2),
      totalCommissions:   +totalCommissions.toFixed(2),
      buyAndHoldReturn:   +buyAndHoldReturn.toFixed(2),
    };
  }
}

export const backtestEngine = new BacktestEngine();