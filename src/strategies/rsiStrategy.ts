import { Candle, Signal } from '../utils/types';
import { rsi } from '../indicators/rsi';

export class RSIStrategy {
  constructor(
    private period = 14,
    private overbought = 70,
    private oversold   = 30,
  ) {}

  generateSignals(candles: Candle[], symbol: string, timeframe: string): Signal[] {
    const rsiData = rsi(candles, this.period);
    const signals: Signal[] = [];

    for (let i = 1; i < rsiData.length; i++) {
      const curr = rsiData[i].value;
      const prev = rsiData[i - 1].value;
      const candle = candles.find(c => c.time === rsiData[i].time)!;
      if (!candle) continue;

      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      let reason = '';

      if (prev <= this.oversold && curr > this.oversold) {
        signal = 'BUY';
        reason = `RSI crossed above oversold (${curr.toFixed(1)})`;
      } else if (prev >= this.overbought && curr < this.overbought) {
        signal = 'SELL';
        reason = `RSI crossed below overbought (${curr.toFixed(1)})`;
      }

      if (signal !== 'HOLD') {
        signals.push({ symbol, timeframe, time: String(candle.time), signal, reason, price: candle.close });
      }
    }
    return signals;
  }
}