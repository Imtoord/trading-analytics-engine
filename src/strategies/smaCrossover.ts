import { Candle, Signal } from '../utils/types';
import { sma } from '../indicators/sma';

export class SMACrossoverStrategy {
  constructor(private fastPeriod = 20, private slowPeriod = 50) {}

  generateSignals(candles: Candle[], symbol: string, timeframe: string): Signal[] {
    const fast    = sma(candles, this.fastPeriod);
    const slow    = sma(candles, this.slowPeriod);
    const slowMap = new Map(slow.map(d => [d.time, d.value]));
    const signals: Signal[] = [];

    for (let i = 1; i < fast.length; i++) {
      const time     = fast[i].time;
      const prevTime = fast[i - 1].time;
      if (!slowMap.has(time) || !slowMap.has(prevTime)) continue;

      const fastCurr = fast[i].value;
      const fastPrev = fast[i - 1].value;
      const slowCurr = slowMap.get(time)!;
      const slowPrev = slowMap.get(prevTime)!;
      const candle   = candles.find(c => c.time === time)!;
      if (!candle) continue;

      if (fastPrev <= slowPrev && fastCurr > slowCurr) {
        signals.push({ symbol, timeframe, time, signal: 'BUY',  reason: `SMA${this.fastPeriod} crossed above SMA${this.slowPeriod}`, price: candle.close });
      } else if (fastPrev >= slowPrev && fastCurr < slowCurr) {
        signals.push({ symbol, timeframe, time, signal: 'SELL', reason: `SMA${this.fastPeriod} crossed below SMA${this.slowPeriod}`, price: candle.close });
      }
    }
    return signals;
  }
}