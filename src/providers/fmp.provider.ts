import axios from 'axios';
import { EventEmitter } from 'events';
import { ENV } from '../config/env';
import { Candle, Tick } from '../utils/types';

// ── Simulate micro price movement every 1s ────────────
function simulateTick(price: number, symbol: string): number {
  const s   = symbol.toUpperCase();
  let   vol = 0.0003;
  if (s.includes('BTC') || s.includes('ETH'))      vol = 0.0008;
  else if (s.length === 6 && !/\d/.test(s))        vol = 0.00005; // forex
  else if (s.includes('XAU') || s.includes('GC'))  vol = 0.0002;
  const change = (Math.random() - 0.5) * 2 * vol;
  return parseFloat((price * (1 + change)).toFixed(5));
}

export class FMPProvider extends EventEmitter {
  private lastPrice  = new Map<string, number>();
  private pollTimers = new Map<string, NodeJS.Timeout>(); // real fetch every 3s
  private tickTimers = new Map<string, NodeJS.Timeout>(); // simulation every 1s
  private refCount   = new Map<string, number>();

  // ── Get historical candles ─────────────────────────
  async getHistory(symbol: string, from: string, to: string): Promise<Candle[]> {
    const apikey = ENV.FMP_API_KEY || 'zTIuEPRlxpxOT3Mi6BnHU4olSaItcaCD';
    console.log(`[FMP] getHistory ${symbol} | key: ${apikey.slice(0,8)}...`);

    let raw: any[] = [];

    // Try stable endpoint first (supports forex/crypto)
    try {
      const res1 = await axios.get(`https://financialmodelingprep.com/stable/historical-price-eod/full`, {
        params: { symbol, from, to, apikey }, timeout: 10000,
      });
      let d1: any[] = Array.isArray(res1.data) ? res1.data : (res1.data?.historical || []);
      // Handle [{symbol:"AAPL", historical:[...]}] format returned for stocks
      if (d1.length > 0 && d1[0]?.historical) d1 = d1[0].historical;
      if (d1.length > 0) raw = d1;
    } catch(_) {}

    // Fallback: v3 endpoint (stocks - free plan)
    if (raw.length === 0) {
      try {
        const res2 = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}`, {
          params: { from, to, apikey }, timeout: 10000,
        });
        raw = res2.data?.historical || [];
      } catch(_) {}
    }

    console.log(`[FMP] raw length → ${raw.length}`);
    if (raw.length === 0) {
      const errMsg = 'No data returned — symbol may be invalid or not in your FMP plan';
      console.error(`[FMP] ${errMsg}`);
    }
    return raw
      .map((d: any) => ({
        time:   d.date   || null,
        open:   parseFloat(d.open)   || 0,
        high:   parseFloat(d.high)   || 0,
        low:    parseFloat(d.low)    || 0,
        close:  parseFloat(d.close)  || 0,
        volume: parseFloat(d.volume) || 0,
      }))
      .filter((d: Candle) => d.time && typeof d.time === 'string' && d.open && d.close)
      .sort((a: Candle, b: Candle) => a.time.localeCompare(b.time));
  }

  // ── Get current quote ──────────────────────────────
  async getQuote(symbol: string): Promise<any> {
    const res = await axios.get(`${ENV.FMP_BASE_URL}/quote`, {
      params: { symbol, apikey: ENV.FMP_API_KEY },
      timeout: 8000,
    });
    return Array.isArray(res.data) ? res.data[0] : res.data;
  }

  // ── Subscribe ──────────────────────────────────────
  subscribe(symbol: string): void {
    const count = (this.refCount.get(symbol) || 0) + 1;
    this.refCount.set(symbol, count);
    if (count > 1) return;
    this._startPoll(symbol);
    console.log(`[FMP] Subscribe → ${symbol}`);
  }

  // ── Unsubscribe ────────────────────────────────────
  unsubscribe(symbol: string): void {
    const count = (this.refCount.get(symbol) || 1) - 1;
    this.refCount.set(symbol, count);
    if (count > 0) return;
    this.refCount.delete(symbol);
    this._stopPoll(symbol);
    this._stopTick(symbol);
    this.lastPrice.delete(symbol);
    console.log(`[FMP] Unsubscribe → ${symbol}`);
  }

  // ── REST polling every 3s (real price anchor) ──────
  private _startPoll(symbol: string): void {
    if (this.pollTimers.has(symbol)) return;

    const fetchReal = async () => {
      try {
        const q = await this.getQuote(symbol);
        if (!q?.price) return;
        const price = parseFloat(q.price);
        this.lastPrice.set(symbol, price);
        console.log(`[FMP] Real price ${symbol}: ${price}`);
        // Start simulation after first real price
        this._startTick(symbol);
      } catch (e: any) {
        console.error(`[FMP] Poll error ${symbol}:`, e.message);
      }
    };

    fetchReal(); // immediate
    this.pollTimers.set(symbol, setInterval(fetchReal, 3000));
  }

  // ── Simulate price every 1s ────────────────────────
  private _startTick(symbol: string): void {
    if (this.tickTimers.has(symbol)) return;

    const id = setInterval(() => {
      const last = this.lastPrice.get(symbol);
      if (!last) return;

      const sim = simulateTick(last, symbol);
      this.lastPrice.set(symbol, sim);

      const tick: Tick = {
        symbol,
        price:     sim,
        volume:    Math.floor(Math.random() * 3000) + 100,
        timestamp: Date.now(),
      };

      this.emit('tick', tick);
    }, 1000);

    this.tickTimers.set(symbol, id);
    console.log(`[FMP] 1s simulation → ${symbol}`);
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