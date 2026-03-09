import { Candle, IndicatorPoint } from '../utils/types';

export function sma(candles: Candle[], period = 20): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const avg = candles.slice(i - period + 1, i + 1).reduce((s, c) => s + c.close, 0) / period;
    out.push({ time: candles[i].time, value: +avg.toFixed(5) });
  }
  return out;
}