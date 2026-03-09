import { Candle, IndicatorPoint } from '../utils/types';

/**
 * Stochastic Oscillator (%K and %D)
 * ─────────────────────────────────────────
 * BUY  signal: %K > 80 AND %K crosses below %D  (overbought crossover)
 *              OR %K < 20 (oversold)
 * SELL signal: %K < 20 AND %K crosses above %D
 *              OR %K > 80
 *
 * Formula:
 *   %K = (Close - Lowest Low) / (Highest High - Lowest Low) × 100
 *   %D = SMA(%K, smoothK)
 */
export interface StochasticResult {
  k: IndicatorPoint[];
  d: IndicatorPoint[];
}

export function stochastic(
  candles: Candle[],
  period  = 14,
  smoothK = 3,
  smoothD = 3,
): StochasticResult {
  const kRaw: IndicatorPoint[] = [];

  // Calculate raw %K
  for (let i = period - 1; i < candles.length; i++) {
    const slice      = candles.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow   = Math.min(...slice.map(c => c.low));
    const range        = highestHigh - lowestLow;
    const k            = range === 0 ? 50 : ((candles[i].close - lowestLow) / range) * 100;
    kRaw.push({ time: candles[i].time, value: +k.toFixed(2) });
  }

  // Smooth %K
  const kSmoothed = _sma(kRaw, smoothK);

  // %D = SMA of smoothed %K
  const d = _sma(kSmoothed, smoothD);

  return { k: kSmoothed, d };
}

function _sma(data: IndicatorPoint[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const avg = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.value, 0) / period;
    out.push({ time: data[i].time, value: +avg.toFixed(2) });
  }
  return out;
}