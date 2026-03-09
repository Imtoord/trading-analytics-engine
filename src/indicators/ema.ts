import { Candle, IndicatorPoint } from '../utils/types';

export function ema(candles: Candle[], period = 14): IndicatorPoint[] {
  const k   = 2 / (period + 1);
  const out: IndicatorPoint[] = [];
  let   prev: number | null = null;

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      prev = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
      out.push({ time: candles[i].time, value: +prev.toFixed(5) });
      continue;
    }
    prev = (candles[i].close - prev) * k + prev;
    out.push({ time: candles[i].time, value: +prev.toFixed(5) });
  }
  return out;
}

export function emaValues(data: IndicatorPoint[], period: number): IndicatorPoint[] {
  const k   = 2 / (period + 1);
  const out: IndicatorPoint[] = [];
  let   prev: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      prev = data.slice(0, period).reduce((s, d) => s + d.value, 0) / period;
      out.push({ time: data[i].time, value: +prev.toFixed(5) });
      continue;
    }
    prev = (data[i].value - prev) * k + prev;
    out.push({ time: data[i].time, value: +prev.toFixed(5) });
  }
  return out;
}