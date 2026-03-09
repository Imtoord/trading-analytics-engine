import { Server } from 'socket.io';
import { fmpProvider } from '../providers/fmp.provider';
import { candleAggregator } from '../services/candleAggregator';
import { buildDateRange } from '../services/dateRange';
import { calculateAll } from '../indicators';
import { Candle } from '../utils/types';

// ── History cache: 5min TTL ────────────────────────────
interface CacheEntry { candles: Candle[]; indicators: any; fetchedAt: number; }
const historyCache = new Map<string, CacheEntry>();
const CACHE_TTL    = 5 * 60 * 1000;

function roomName(symbol: string, tf: string) { return `sym:${tf}:${symbol}`; }

async function loadHistory(socket: any, symbol: string, timeframe: string, range: string) {
  const key = `${symbol}:${timeframe}:${range}`;
  const cached = historyCache.get(key);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    socket.emit('history', { symbol, timeframe, candles: cached.candles, indicators: cached.indicators });
    return;
  }

  try {
    const { from, to } = buildDateRange(range);
    const candles      = await fmpProvider.getHistory(symbol, from, to);
    if (!candles.length) { socket.emit('error_msg', { symbol, message: `No data for ${symbol}` }); return; }

    const indicators = calculateAll(candles);
    historyCache.set(key, { candles, indicators, fetchedAt: Date.now() });
    socket.emit('history', { symbol, timeframe, candles, indicators });
    console.log(`[Socket] History → ${symbol} ${timeframe} (${candles.length})`);
  } catch (err: any) {
    socket.emit('error_msg', { symbol, message: err.message });
  }
}

export function initChartSocket(io: Server) {

  // ── Aggregator → rooms ────────────────────────────
  candleAggregator.on('candle:update', ({ symbol, timeframe, candle }) => {
    io.to(roomName(symbol, timeframe)).emit('candle', { symbol, timeframe, candle });
  });

  candleAggregator.on('candle:close', ({ symbol, timeframe, candle }) => {
    const prefix = `${symbol}:${timeframe}`;
    for (const [key, data] of historyCache) {
      if (key.startsWith(prefix)) {
        data.candles.push(candle);
        if (data.candles.length > 2000) data.candles.shift();
        data.indicators = calculateAll(data.candles);
        io.to(roomName(symbol, timeframe)).emit('indicators', {
          symbol, timeframe, indicators: data.indicators,
        });
      }
    }
  });

  // ── Provider ticks → rooms ────────────────────────
  fmpProvider.on('tick', ({ symbol, price, volume, timestamp }) => {
    for (const tf of ['1m','5m','15m','1h','4h','1d']) {
      io.to(roomName(symbol, tf)).emit('tick', { symbol, price, volume, timestamp });
    }
    candleAggregator.processTick({ symbol, price, volume, timestamp });
  });

  // ── Socket connections ────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);
    const subs = new Set<string>();

    socket.on('subscribe', async ({ symbol, timeframe = '1d', range = '1Y' }) => {
      if (!symbol) return;
      const sym    = symbol.toUpperCase();
      const subKey = `${sym}:${timeframe}`;
      if (!subs.has(subKey)) {
        subs.add(subKey);
        socket.join(roomName(sym, timeframe));
        fmpProvider.subscribe(sym);
      }
      await loadHistory(socket, sym, timeframe, range);
    });

    socket.on('change_tf', async ({ symbol, timeframe, range = '1Y' }) => {
      if (!symbol || !timeframe) return;
      const sym = symbol.toUpperCase();
      for (const sub of subs) {
        if (sub.startsWith(`${sym}:`)) {
          subs.delete(sub);
          socket.leave(roomName(sym, sub.split(':')[1]));
        }
      }
      subs.add(`${sym}:${timeframe}`);
      socket.join(roomName(sym, timeframe));
      await loadHistory(socket, sym, timeframe, range);
    });

    socket.on('unsubscribe', ({ symbol, timeframe }) => {
      if (!symbol) return;
      const sym = symbol.toUpperCase();
      subs.delete(`${sym}:${timeframe}`);
      socket.leave(roomName(sym, timeframe));
      fmpProvider.unsubscribe(sym);
    });

    socket.on('disconnect', () => {
      for (const sub of subs) {
        fmpProvider.unsubscribe(sub.split(':')[0]);
      }
      subs.clear();
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}