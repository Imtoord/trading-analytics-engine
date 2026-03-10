import { Candle } from '../utils/types';

export interface HistoryCacheEntry {
  candles:    Candle[];
  indicators: Record<string, any>;
  fetchedAt:  number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CANDLES  = 2000;

export class HistoryCache {
  private readonly store = new Map<string, HistoryCacheEntry>();

  private key(symbol: string, timeframe: string, range: string): string {
    return `${symbol}:${timeframe}:${range}`;
  }

  get(symbol: string, timeframe: string, range: string): HistoryCacheEntry | null {
    const k     = this.key(symbol, timeframe, range);
    const entry = this.store.get(k);
    if (!entry) return null;

    const isExpired = Date.now() - entry.fetchedAt > CACHE_TTL_MS;
    if (isExpired) { this.store.delete(k); return null; }

    return entry;
  }

  set(symbol: string, timeframe: string, range: string, candles: Candle[], indicators: Record<string, any>): void {
    this.store.set(this.key(symbol, timeframe, range), { candles, indicators, fetchedAt: Date.now() });
  }

  /**
   * Append a closed candle to all cache entries matching symbol+timeframe (any range).
   * Returns the recalculated indicators from the last updated entry, or null if nothing was cached.
   */
  appendClosedCandle(
    symbol:    string,
    timeframe: string,
    candle:    Candle,
    recalc:    (candles: Candle[]) => Record<string, any>,
  ): Record<string, any> | null {
    let latestIndicators: Record<string, any> | null = null;

    for (const [key, entry] of this.store) {
      if (!key.startsWith(`${symbol}:${timeframe}`)) continue;

      entry.candles.push(candle);
      if (entry.candles.length > MAX_CANDLES) entry.candles.shift();
      entry.indicators = recalc(entry.candles);
      latestIndicators = entry.indicators;
    }

    return latestIndicators;
  }
}

export const historyCache = new HistoryCache();
