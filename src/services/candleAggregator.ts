import { EventEmitter } from 'events';
import { Tick, Candle, Timeframe, TIMEFRAME_SECONDS } from '../utils/types';

interface OpenCandle {
  time:   number;  // Unix seconds (bucket start)
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

class CandleAggregator extends EventEmitter {
  // openCandles[symbol][timeframe] = current open candle
  private openCandles = new Map<string, Map<Timeframe, OpenCandle>>();

  processTick(tick: Tick): void {
    const { symbol, price, volume = 0, timestamp } = tick;
    const ts = timestamp || Date.now();

    for (const [tf, bucketSec] of Object.entries(TIMEFRAME_SECONDS) as [Timeframe, number][]) {
      this._update(symbol, tf, bucketSec, price, volume, ts);
    }
  }

  private _update(symbol: string, tf: Timeframe, bucketSec: number, price: number, volume: number, ts: number): void {
    const bucketMs   = bucketSec * 1000;
    const bucketTime = Math.floor(ts / bucketMs) * bucketSec;

    if (!this.openCandles.has(symbol)) {
      this.openCandles.set(symbol, new Map());
    }
    const tfMap = this.openCandles.get(symbol)!;
    const prev  = tfMap.get(tf);

    // Close old candle if new bucket
    if (prev && prev.time !== bucketTime) {
      this.emit('candle:close', { symbol, timeframe: tf, candle: this._toCandle(prev, tf) });
    }

    // Open new or update existing
    if (!prev || prev.time !== bucketTime) {
      tfMap.set(tf, { time: bucketTime, open: price, high: price, low: price, close: price, volume });
    } else {
      prev.high    = Math.max(prev.high, price);
      prev.low     = Math.min(prev.low,  price);
      prev.close   = price;
      prev.volume += volume;
    }

    this.emit('candle:update', { symbol, timeframe: tf, candle: this._toCandle(tfMap.get(tf)!, tf) });
  }

  private _toCandle(c: OpenCandle, tf: Timeframe): Candle {
    let time: string | number;
    if (tf === '1d' || tf === '1w') {
      time = new Date(c.time * 1000).toISOString().split('T')[0]; // YYYY-MM-DD
    } else if (tf === '1M') {
      const d = new Date(c.time * 1000);
      time = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`; // YYYY-MM-01
    } else {
      time = c.time; // Unix seconds for intraday
    }
    return { time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
  }

  getOpenCandle(symbol: string, tf: Timeframe): OpenCandle | null {
    return this.openCandles.get(symbol)?.get(tf) ?? null;
  }

  clearSymbol(symbol: string): void {
    this.openCandles.delete(symbol);
  }
}

export const candleAggregator = new CandleAggregator();