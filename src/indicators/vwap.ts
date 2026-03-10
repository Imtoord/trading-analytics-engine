import { Candle, IndicatorPoint } from '../utils/types';

/**
 * VWAP — Volume Weighted Average Price
 * ─────────────────────────────────────────
 * BUY  signal: Price crosses UP above VWAP
 * SELL signal: Price crosses DOWN below VWAP
 *
 * Formula:
 *   Typical Price = (High + Low + Close) / 3
 *   VWAP = Cumulative(TP × Volume) / Cumulative(Volume)
 *
 * Note:
 *   True VWAP resets daily. For historical daily candles,
 *   we calculate a rolling VWAP over the full series.
 *   For intraday use, reset at each new trading day.
 */
export function vwap(candles: Candle[]): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  let cumTPV = 0; // cumulative (TP × Volume)
  let cumVol = 0; // cumulative Volume

  // Group by date to reset daily
  let currentDay = '';

  for (let i = 0; i < candles.length; i++) {
    const c   = candles[i];
    const day = String(c.time).substring(0, 10); // "YYYY-MM-DD"

    // Reset at new trading day
    if (day !== currentDay) {
      cumTPV     = 0;
      cumVol     = 0;
      currentDay = day;
    }

    const tp  = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1;

    cumTPV += tp * vol;
    cumVol += vol;

    const value = +(cumTPV / cumVol).toFixed(5);
    out.push({ time: c.time, value });
  }

  return out;
}

/**
 * Rolling VWAP (no daily reset — useful for longer timeframes)
 */
export function rollingVwap(candles: Candle[], period = 20): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    let sumTPV  = 0;
    let sumVol  = 0;

    for (const c of slice) {
      const tp  = (c.high + c.low + c.close) / 3;
      const vol = c.volume || 1;
      sumTPV += tp * vol;
      sumVol += vol;
    }

    out.push({ time: candles[i].time, value: +(sumTPV / sumVol).toFixed(5) });
  }

  return out;
}