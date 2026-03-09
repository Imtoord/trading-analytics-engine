import { Candle, IndicatorPoint } from '../utils/types';

export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  if (candles.length < period + 1) return [];
  const out: IndicatorPoint[] = [];
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) gains += d; else losses -= d;
  }

  let ag = gains / period;
  let al = losses / period;
  out.push({ time: candles[period].time, value: +(100 - 100 / (1 + ag / (al || 1e-10))).toFixed(2) });

  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    ag = (ag * (period - 1) + (d > 0 ? d : 0))  / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    out.push({ time: candles[i].time, value: +(100 - 100 / (1 + ag / (al || 1e-10))).toFixed(2) });
  }
  return out;
}