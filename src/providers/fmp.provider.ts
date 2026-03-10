import axios from 'axios';
import { EventEmitter } from 'events';
import { ENV } from '../config/env';
import { Candle, Tick } from '../utils/types';

// ── Timeframe helpers ──────────────────────────────────
function toMs(t: string | number): number {
  return typeof t === 'number' ? t * 1000 : new Date(t).getTime();
}

function sortByTime(a: Candle, b: Candle): number {
  return toMs(a.time) - toMs(b.time);
}

function aggregateCandles(
  candles: Candle[],
  bucketMs: number,
  outputAsTimestamp: boolean,
): Candle[] {
  if (!candles.length) return [];

  const buckets = new Map<number, Candle>();

  for (const c of candles) {
    const bucket = Math.floor(toMs(c.time) / bucketMs) * bucketMs;
    const existing = buckets.get(bucket);

    if (!existing) {
      const time: string | number = outputAsTimestamp
        ? Math.floor(bucket / 1000)
        : new Date(bucket).toISOString().split('T')[0];
      buckets.set(bucket, { time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    } else {
      existing.high    = Math.max(existing.high, c.high);
      existing.low     = Math.min(existing.low,  c.low);
      existing.close   = c.close;
      existing.volume += c.volume;
    }
  }

  return Array.from(buckets.values()).sort(sortByTime);
}

function aggregateCandlesMonthly(candles: Candle[]): Candle[] {
  if (!candles.length) return [];

  const buckets = new Map<string, Candle>();

  for (const c of candles) {
    const d    = new Date(toMs(c.time));
    const key  = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, { time: key, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
    } else {
      existing.high    = Math.max(existing.high, c.high);
      existing.low     = Math.min(existing.low,  c.low);
      existing.close   = c.close;
      existing.volume += c.volume;
    }
  }

  return Array.from(buckets.values()).sort(sortByTime);
}

// ── Price simulation ───────────────────────────────────
function simulateTick(price: number, symbol: string): number {
  const s = symbol.toUpperCase();
  let volatility = 0.0003;
  if (s.includes('BTC') || s.includes('ETH'))     volatility = 0.0008;
  else if (s.length === 6 && !/\d/.test(s))       volatility = 0.00005; // forex pair
  else if (s.includes('XAU') || s.includes('GC')) volatility = 0.0002;

  const change = (Math.random() - 0.5) * 2 * volatility;
  return parseFloat((price * (1 + change)).toFixed(5));
}

// ── Raw candle mappers ─────────────────────────────────
function mapIntraday(d: any): Candle | null {
  const ts = d.date ? Math.floor(new Date(d.date.replace(' ', 'T')).getTime() / 1000) : null;
  if (!ts) return null;
  return {
    time:   ts,
    open:   parseFloat(d.open)   || 0,
    high:   parseFloat(d.high)   || 0,
    low:    parseFloat(d.low)    || 0,
    close:  parseFloat(d.close)  || 0,
    volume: parseFloat(d.volume) || 0,
  };
}

function mapDaily(d: any): Candle | null {
  if (!d.date) return null;
  return {
    time:   d.date,
    open:   parseFloat(d.open)   || 0,
    high:   parseFloat(d.high)   || 0,
    low:    parseFloat(d.low)    || 0,
    close:  parseFloat(d.close)  || 0,
    volume: parseFloat(d.volume) || 0,
  };
}

function filterValid(candles: (Candle | null)[]): Candle[] {
  return (candles.filter(c => c && c.open && c.close) as Candle[]).sort(sortByTime);
}

// ── FMP intraday interval map ─────────────────────────
const INTRADAY_MAP: Record<string, string> = {
  '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1hour', '4h': '4hour',
};

// ── FMPProvider ────────────────────────────────────────
export class FMPProvider extends EventEmitter {
  private readonly lastPrice  = new Map<string, number>();
  private readonly pollTimers = new Map<string, NodeJS.Timeout>();
  private readonly tickTimers = new Map<string, NodeJS.Timeout>();
  private readonly refCount   = new Map<string, number>();

  // ── Get historical candles ─────────────────────────
  async getHistory(symbol: string, from: string, to: string, timeframe = '1d'): Promise<Candle[]> {
    const { FMP_API_KEY: apikey, FMP_BASE_URL, FMP_V3_URL } = ENV;
    const dateParams: Record<string, string> = {};
    if (from) dateParams.from = from;
    if (to)   dateParams.to   = to;

    console.log(`[FMP] getHistory  ${symbol}  ${timeframe}`);

    // ── Aggregated intraday timeframes ────────────────
    // Wrap recursive calls so errors from the base TF are re-thrown with the
    // requested timeframe in the message (e.g. "2h not available" not "1h not available")
    if (timeframe === '2h') {
      try {
        const base = await this.getHistory(symbol, from, to, '1h');
        return aggregateCandles(base, 2 * 60 * 60 * 1000, true);
      } catch (e: any) {
        throw new Error(`${timeframe} not available for ${symbol} — base 1h: ${e.message}`);
      }
    }

    if (timeframe === '8h') {
      try {
        const base = await this.getHistory(symbol, from, to, '4h');
        return aggregateCandles(base, 8 * 60 * 60 * 1000, true);
      } catch (e: any) {
        throw new Error(`${timeframe} not available for ${symbol} — base 4h: ${e.message}`);
      }
    }

    if (timeframe === '12h') {
      try {
        const base = await this.getHistory(symbol, from, to, '4h');
        return aggregateCandles(base, 12 * 60 * 60 * 1000, true);
      } catch (e: any) {
        throw new Error(`${timeframe} not available for ${symbol} — base 4h: ${e.message}`);
      }
    }

    // ── 1w / 1M aggregate from 1d (always available) ─
    if (timeframe === '1w') {
      const base = await this.getHistory(symbol, from, to, '1d');
      return aggregateCandles(base, 7 * 24 * 60 * 60 * 1000, false);
    }

    if (timeframe === '1M') {
      const base = await this.getHistory(symbol, from, to, '1d');
      return aggregateCandlesMonthly(base);
    }

    // ── Intraday (1m / 5m / 15m / 1h / 4h) ──────────
    const intradayInterval = INTRADAY_MAP[timeframe];
    if (intradayInterval) {
      try {
        const res = await axios.get(
          `${FMP_V3_URL}/historical-chart/${intradayInterval}/${symbol}`,
          { params: { ...dateParams, apikey, limit: 5000 }, timeout: 15000 },
        );

        if (Array.isArray(res.data)) {
          const candles = filterValid(res.data.map(mapIntraday));
          console.log(`[FMP] Intraday  ${symbol} ${timeframe}  →  ${candles.length} candles`);
          return candles;
        }

        // FMP returns {"Error Message":"..."} when the plan doesn't support this data
        const apiError = (res.data as any)?.['Error Message'] ?? JSON.stringify(res.data);
        console.error(`[FMP] Intraday API error  ${symbol} ${timeframe}: ${apiError}`);
        throw new Error(`Intraday ${timeframe} not available for ${symbol} on this FMP plan`);
      } catch (e: any) {
        if (e.response?.status === 403) {
          throw new Error(`Intraday ${timeframe} requires a premium FMP plan (403)`);
        }
        // Re-throw if it's already our descriptive error
        if (!e.response) throw e;
        console.error(`[FMP] Intraday request failed  ${symbol} ${timeframe}: ${e.message}`);
      }

      return []; // no fallback for intraday — daily candles can't replace them
    }

    // ── Daily (1d) — stable endpoint first ────────────
    let raw: any[] = [];

    try {
      const res = await axios.get(`${FMP_BASE_URL}/historical-price-eod/full`, {
        params: { symbol, ...dateParams, apikey, limit: 5000 },
        timeout: 15000,
      });

      let data: any[] = Array.isArray(res.data) ? res.data : (res.data?.historical || []);
      // Stocks sometimes come as [{symbol, historical:[...]}]
      if (data.length > 0 && data[0]?.historical) data = data[0].historical;

      if (data.length > 0) {
        raw = data;
        console.log(`[FMP] Daily (stable)  ${symbol}  →  ${raw.length} rows`);
      }
    } catch (e: any) {
      console.error(`[FMP] Daily stable endpoint failed  ${symbol}: ${e.message}`);
    }

    // ── Daily fallback — v3 endpoint (stocks) ─────────
    if (!raw.length) {
      try {
        const res = await axios.get(`${FMP_V3_URL}/historical-price-full/${symbol}`, {
          params: { ...dateParams, apikey, limit: 5000 },
          timeout: 15000,
        });
        raw = res.data?.historical || [];
        if (raw.length) console.log(`[FMP] Daily (v3 fallback)  ${symbol}  →  ${raw.length} rows`);
      } catch (e: any) {
        console.error(`[FMP] Daily v3 fallback failed  ${symbol}: ${e.message}`);
      }
    }

    if (!raw.length) {
      console.error(`[FMP] No daily data returned for ${symbol} — check symbol name or API plan`);
    }

    return filterValid(raw.map(mapDaily));
  }

  // ── Get current quote ──────────────────────────────
  async getQuote(symbol: string): Promise<any> {
    const res = await axios.get(`${ENV.FMP_BASE_URL}/quote`, {
      params: { symbol, apikey: ENV.FMP_API_KEY },
      timeout: 8000,
    });
    return Array.isArray(res.data) ? res.data[0] : res.data;
  }

  // ── Subscribe / Unsubscribe ────────────────────────
  subscribe(symbol: string): void {
    const count = (this.refCount.get(symbol) || 0) + 1;
    this.refCount.set(symbol, count);
    if (count > 1) return; // already polling
    this._startPoll(symbol);
    console.log(`[FMP] Subscribe  →  ${symbol}`);
  }

  unsubscribe(symbol: string): void {
    const count = (this.refCount.get(symbol) || 1) - 1;
    this.refCount.set(symbol, count);
    if (count > 0) return; // other subscribers remain
    this.refCount.delete(symbol);
    this._stopPoll(symbol);
    this._stopTick(symbol);
    this.lastPrice.delete(symbol);
    console.log(`[FMP] Unsubscribe  →  ${symbol}`);
  }

  // ── Real price polling every 3s ────────────────────
  private _startPoll(symbol: string): void {
    if (this.pollTimers.has(symbol)) return;

    const poll = async () => {
      try {
        const quote = await this.getQuote(symbol);
        if (!quote?.price) return;
        const price = parseFloat(quote.price);
        this.lastPrice.set(symbol, price);
        this._startTick(symbol); // begin simulation once we have a real anchor
        console.log(`[FMP] Real price  ${symbol}:  ${price}`);
      } catch (e: any) {
        console.error(`[FMP] Poll error  ${symbol}: ${e.message}`);
      }
    };

    poll(); // immediate first fetch
    this.pollTimers.set(symbol, setInterval(poll, 3000));
  }

  // ── Simulated tick every 1s ────────────────────────
  private _startTick(symbol: string): void {
    if (this.tickTimers.has(symbol)) return;

    const timer = setInterval(() => {
      const last = this.lastPrice.get(symbol);
      if (!last) return;

      const price = simulateTick(last, symbol);
      this.lastPrice.set(symbol, price);

      const tick: Tick = {
        symbol,
        price,
        volume:    Math.floor(Math.random() * 3000) + 100,
        timestamp: Date.now(),
      };

      this.emit('tick', tick);
    }, 1000);

    this.tickTimers.set(symbol, timer);
    console.log(`[FMP] Tick simulation started  →  ${symbol}`);
  }

  private _stopPoll(symbol: string): void {
    clearInterval(this.pollTimers.get(symbol));
    this.pollTimers.delete(symbol);
  }

  private _stopTick(symbol: string): void {
    clearInterval(this.tickTimers.get(symbol));
    this.tickTimers.delete(symbol);
  }
}

export const fmpProvider = new FMPProvider();
