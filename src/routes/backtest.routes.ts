import { Router, Request, Response } from 'express';
import { fmpProvider }     from '../providers/fmp.provider';
import { buildDateRange }  from '../services/dateRange';
import { backtestEngine }  from '../backtesting/engine';
import { BacktestConfig }  from '../backtesting/types';

const router = Router();

/**
 * POST /api/backtest
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      symbol         = 'EURUSD',
      timeframe      = '1d',
      range          = '1Y',
      from, to,
      strategy       = 'rsi',
      initialCapital = 10000,
      positionSize   = 0.1,
      stopLoss, takeProfit,
      commission     = 0.001,
    } = req.body;

    const sym   = symbol.toUpperCase();
    const dates = from && to ? { from, to } : buildDateRange(range);
    const candles = await fmpProvider.getHistory(sym, dates.from, dates.to);
    if (!candles.length) return res.status(404).json({ error: `No data for ${sym}` });

    const config: BacktestConfig = {
      symbol: sym, timeframe, from: dates.from, to: dates.to,
      strategy, initialCapital: +initialCapital,
      positionSize: +positionSize,
      stopLoss:   stopLoss   ? +stopLoss   : undefined,
      takeProfit: takeProfit ? +takeProfit : undefined,
      commission: +commission,
    };

    res.json(backtestEngine.run(candles, config));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/backtest/strategies
 */
router.get('/strategies', (_req: Request, res: Response) => {
  res.json({
    strategies: [
      { id: 'no_signal',       name: 'NO_SIGNAL (Buy & Hold)',       description: 'Single buy on first bar — benchmark' },
      { id: 'rsi',             name: 'RSI_ONLY',                     description: 'RSI 30/70 crossover' },
      { id: 'rsi_50',          name: 'RSI_50_ONLY',                  description: 'RSI crosses 50 level' },
      { id: 'sma',             name: 'SMA_ONLY',                     description: 'SMA20 crosses SMA50' },
      { id: 'ema',             name: 'EMA Crossover',                description: 'EMA12 crosses EMA26' },
      { id: 'macd',            name: 'MACD',                         description: 'MACD crosses signal above/below 0' },
      { id: 'bollinger',       name: 'Bollinger Bands',              description: 'Price bounces off bands' },
      { id: 'stochastic',      name: 'Stochastic',                   description: '%K crosses %D in extreme zones' },
      { id: 'mfi',             name: 'MFI',                          description: 'MFI 20/80 crossover' },
      { id: 'aroon',           name: 'Aroon',                        description: 'Aroon Up crosses above Down' },
      { id: 'sma_with_rsi',    name: 'SMA_WITH_RSI',                 description: 'SMA signal confirmed by RSI > 50' },
      { id: 'rsi_with_rsi50',  name: 'RSI_WITH_RSI_50',              description: 'RSI 30/70 filtered by RSI50 trend' },
      { id: 'sma_rsi50_combo', name: 'SMA_RSI50_COMBO',              description: 'SMA + RSI50 must agree' },
      { id: 'rsi_rsi50_combo', name: 'RSI_RSI50_COMBO',              description: 'RSI14 + RSI50 must agree' },
      { id: 'rsi_sma_combo',   name: 'RSI_SMA_COMBO',                description: 'RSI + SMA must agree' },
      { id: 'rsi50_sma_combo', name: 'RSI50_SMA_COMBO',              description: 'RSI50 + SMA must agree' },
      { id: 'rsi_rsi50_sma',   name: 'RSI_RSI50_SMA_COMBO',          description: '2/3 of RSI+RSI50+SMA must agree' },
      { id: 'combined',        name: 'Combined (RSI+MACD+BB)',       description: '2/3 of RSI+MACD+BB must agree' },
    ],
  });
});

/**
 * POST /api/backtest/compare
 * Returns table matching screenshot format:
 * Combination | Total Trades | Win Rate | Avg Return | Total Return | Longest Trade | Shortest Trade | Avg Length
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const {
      symbol         = 'EURUSD',
      range          = '1Y',
      strategies,
      initialCapital = 10000,
      positionSize   = 0.1,
      commission     = 0.001,
      stopLoss,
      takeProfit,
    } = req.body;

    const ALL_STRATEGIES = [
      'no_signal', 'sma', 'rsi_50', 'rsi',
      'sma_rsi50_combo', 'sma_with_rsi', 'rsi_with_rsi50',
      'rsi_rsi50_sma', 'rsi_rsi50_combo', 'rsi_sma_combo', 'rsi50_sma_combo',
      'macd', 'bollinger', 'stochastic', 'mfi', 'aroon', 'combined',
    ];
    const toRun = strategies || ALL_STRATEGIES;

    const sym     = symbol.toUpperCase();
    const dates   = buildDateRange(range);
    const candles = await fmpProvider.getHistory(sym, dates.from, dates.to);
    if (!candles.length) return res.status(404).json({ error: `No data for ${sym}` });

    const results = toRun.map((strategy: string) => {
      const config: BacktestConfig = {
        symbol: sym, timeframe: '1d',
        from: dates.from, to: dates.to,
        strategy,
        initialCapital: +initialCapital,
        positionSize:   +positionSize,
        commission:     +commission,
        stopLoss:       stopLoss   ? +stopLoss   : undefined,
        takeProfit:     takeProfit ? +takeProfit : undefined,
      };

      const r = backtestEngine.run(candles, config);

      // ── Build exact columns from screenshot ──────────
      const bars          = r.trades.map(t => t.holdingBars).filter(b => b > 0);
      const longestTrade  = bars.length ? Math.max(...bars) : 0;
      const shortestTrade = bars.length ? Math.min(...bars) : 0;
      const avgLength     = bars.length
        ? +(bars.reduce((s, b) => s + b, 0) / bars.length).toFixed(1)
        : 0;

      // Avg Return = mean pnlPct per trade (matching screenshot)
      const pnlPcts   = r.trades.map(t => t.pnlPct ?? 0);
      const avgReturn = pnlPcts.length
        ? +(pnlPcts.reduce((s, p) => s + p, 0) / pnlPcts.length).toFixed(2)
        : 0;

      return {
        combination:    ({
          no_signal:'NO_SIGNAL', rsi:'RSI_ONLY', rsi_50:'RSI_50_ONLY', sma:'SMA_ONLY',
          ema:'EMA_ONLY', macd:'MACD_ONLY', bollinger:'BOLLINGER_ONLY',
          stochastic:'STOCHASTIC_ONLY', mfi:'MFI_ONLY', aroon:'AROON_ONLY',
          sma_with_rsi:'SMA_WITH_RSI', rsi_with_rsi50:'RSI_WITH_RSI_50',
          sma_rsi50_combo:'SMA_RSI_50_COMBO', rsi_rsi50_combo:'RSI_RSI50_COMBO',
          rsi_sma_combo:'RSI_SMA_COMBO', rsi50_sma_combo:'RSI50_SMA_COMBO',
          rsi_rsi50_sma:'RSI_RSI50_SMA_COMBO', combined:'COMBINED',
        } as any)[strategy] || strategy.toUpperCase(),
        totalTrades:    r.metrics.totalTrades,
        winRate:        r.metrics.winRate,
        avgReturn,
        totalReturn:    r.metrics.totalReturn,
        longestTrade,
        shortestTrade,
        avgLength,
        // bonus
        sharpeRatio:    r.metrics.sharpeRatio,
        maxDrawdown:    r.metrics.maxDrawdown,
        profitFactor:   r.metrics.profitFactor,
        finalCapital:   r.metrics.finalCapital,
        buyAndHold:     r.metrics.buyAndHoldReturn,
      };
    });

    // Sort by totalReturn descending (same as screenshot)
    results.sort((a: any, b: any) => b.totalReturn - a.totalReturn);

    // ── Build formatted text table (like screenshot) ──
    const pad = (s: string, n: number) => s.padEnd(n);
    const C = { combo:22, trades:12, win:12, avg:14, total:14, longest:15, shortest:16, avglen:10 };
    const sep = "-".repeat(120);
    const header =
      pad("Combination", C.combo) + " | " +
      pad("Total Trades", C.trades) + " | " +
      pad("Win Rate", C.win) + " | " +
      pad("Avg Return", C.avg) + " | " +
      pad("Total Return", C.total) + " | " +
      pad("Longest Trade", C.longest) + " | " +
      pad("Shortest Trade", C.shortest) + " | " +
      "Avg Length";
    const rows = results.map((r: any) =>
      pad(r.combination, C.combo) + " | " +
      pad(String(r.totalTrades), C.trades) + " | " +
      pad(r.winRate.toFixed(2) + "%", C.win) + " | " +
      pad(r.avgReturn.toFixed(2) + "%", C.avg) + " | " +
      pad(r.totalReturn.toFixed(2) + "%", C.total) + " | " +
      pad(String(r.longestTrade), C.longest) + " | " +
      pad(String(r.shortestTrade), C.shortest) + " | " +
      r.avgLength.toFixed(1)
    );
    const table = ["=" .repeat(120), header, sep, ...rows].join("");

    res.json({
      symbol:         sym,
      range,
      from:           dates.from,
      to:             dates.to,
      candlesCount:   candles.length,
      initialCapital: +initialCapital,
      table,     // formatted text exactly like the screenshot
      results,   // structured JSON for frontend
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;