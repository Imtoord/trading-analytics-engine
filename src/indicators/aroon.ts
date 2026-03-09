import { Candle, IndicatorPoint } from '../utils/types';

/**
 * Aroon Indicator (Up & Down)
 * ─────────────────────────────────────────
 * BUY  signal: Aroon Up crosses above Aroon Down
 *              AND Aroon Up > 70
 * SELL signal: Aroon Down crosses above Aroon Up
 *              AND Aroon Down > 70
 *
 * Formula:
 *   Aroon Up   = ((period - periods since highest high) / period) × 100
 *   Aroon Down = ((period - periods since lowest low)   / period) × 100
 */
export interface AroonResult {
  up:        IndicatorPoint[];
  down:      IndicatorPoint[];
  oscillator: IndicatorPoint[]; // Up - Down
}

export function aroon(candles: Candle[], period = 25): AroonResult {
  const up:   IndicatorPoint[] = [];
  const down: IndicatorPoint[] = [];
  const osc:  IndicatorPoint[] = [];

  for (let i = period; i < candles.length; i++) {
    const slice = candles.slice(i - period, i + 1);
    const time  = candles[i].time;

    // Find index of highest high and lowest low in slice
    let highIdx = 0;
    let lowIdx  = 0;
    for (let j = 1; j < slice.length; j++) {
      if (slice[j].high > slice[highIdx].high) highIdx = j;
      if (slice[j].low  < slice[lowIdx].low)   lowIdx  = j;
    }

    // Periods since highest/lowest (from END of slice)
    const periodsSinceHigh = period - highIdx;
    const periodsSinceLow  = period - lowIdx;

    const aroonUp   = +((( period - periodsSinceHigh) / period) * 100).toFixed(2);
    const aroonDown = +((( period - periodsSinceLow)  / period) * 100).toFixed(2);

    up.push({   time, value: aroonUp });
    down.push({ time, value: aroonDown });
    osc.push({  time, value: +(aroonUp - aroonDown).toFixed(2) });
  }

  return { up, down, oscillator: osc };
}