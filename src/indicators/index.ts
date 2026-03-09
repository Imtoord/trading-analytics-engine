import { Candle } from '../utils/types';
import { sma }                        from './sma';
import { ema }                        from './ema';
import { rsi }                        from './rsi';
import { macd }                       from './macd';
import { bollingerBands }             from './bollinger';
import { mfi }                        from './mfi';
import { stochastic }                 from './stochastic';
import { aroon }                      from './aroon';
import { vwap, rollingVwap }          from './vwap';

export { sma, ema, rsi, macd, bollingerBands, mfi, stochastic, aroon, vwap, rollingVwap };

export function calculateAll(candles: Candle[]) {
  if (!candles || candles.length < 30) return null;
  return {
    // Trend
    sma20:      sma(candles, 20),
    sma50:      sma(candles, 50),
    ema14:      ema(candles, 14),
    vwap:       rollingVwap(candles, 20),

    // Momentum
    rsi14:      rsi(candles, 14),
    macd:       macd(candles),
    stochastic: stochastic(candles, 14, 3, 3),
    mfi14:      mfi(candles, 14),

    // Volatility
    bollinger:  bollingerBands(candles),

    // Trend strength
    aroon25:    aroon(candles, 25),
  };
}