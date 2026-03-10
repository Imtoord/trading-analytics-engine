import { Candle, IndicatorPoint } from '../utils/types';
import { ema, emaValues } from './ema';

export interface MACDResult {
  macdLine:   IndicatorPoint[];
  signalLine: IndicatorPoint[];
  histogram:  IndicatorPoint[];
}

export function macd(candles: Candle[], fast = 12, slow = 26, signal = 9): MACDResult {
  const fastEma = ema(candles, fast);
  const slowEma = ema(candles, slow);
  const slowMap = new Map(slowEma.map(d => [d.time, d.value]));
  const fastMap = new Map(fastEma.map(d => [d.time, d.value]));

  const macdLine: IndicatorPoint[] = [];
  for (const [time, sv] of slowMap) {
    if (fastMap.has(time)) {
      macdLine.push({ time, value: +(fastMap.get(time)! - sv).toFixed(5) });
    }
  }
  macdLine.sort((a, b) => String(a.time).localeCompare(String(b.time)));

  const signalLine = emaValues(macdLine, signal);
  const sigMap     = new Map(signalLine.map(d => [d.time, d.value]));
  const histogram  = macdLine
    .filter(d => sigMap.has(d.time))
    .map(d => ({ time: d.time, value: +(d.value - sigMap.get(d.time)!).toFixed(5) }));

  return { macdLine, signalLine, histogram };
}