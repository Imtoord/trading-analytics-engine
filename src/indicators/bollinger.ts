import { Candle, IndicatorPoint } from '../utils/types';

export interface BollingerResult {
  upper:  IndicatorPoint[];
  middle: IndicatorPoint[];
  lower:  IndicatorPoint[];
}

export function bollingerBands(candles: Candle[], period = 20, mult = 2): BollingerResult {
  const upper: IndicatorPoint[] = [];
  const middle: IndicatorPoint[] = [];
  const lower: IndicatorPoint[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const sl  = candles.slice(i - period + 1, i + 1);
    const avg = sl.reduce((s, c) => s + c.close, 0) / period;
    const std = Math.sqrt(sl.reduce((s, c) => s + (c.close - avg) ** 2, 0) / period);
    const t   = candles[i].time;
    middle.push({ time: t, value: +avg.toFixed(5) });
    upper.push({  time: t, value: +(avg + mult * std).toFixed(5) });
    lower.push({  time: t, value: +(avg - mult * std).toFixed(5) });
  }
  return { upper, middle, lower };
}