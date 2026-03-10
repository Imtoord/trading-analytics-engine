import { Socket } from 'socket.io';
import { fmpProvider }   from '../providers/fmp.provider';
import { buildDateRange } from '../services/dateRange';
import { calculateAll }  from '../indicators';
import { historyCache }  from './HistoryCache';

export class HistoryLoader {
  async load(socket: Socket, symbol: string, timeframe: string, range: string): Promise<void> {
    const cached = historyCache.get(symbol, timeframe, range);
    if (cached) {
      socket.emit('history', { symbol, timeframe, candles: cached.candles, indicators: cached.indicators });
      return;
    }

    try {
      const { from, to } = buildDateRange(range);
      const candles      = await fmpProvider.getHistory(symbol, from, to, timeframe);

      if (!candles.length) {
        socket.emit('error_msg', { symbol, message: `No data available for ${symbol}` });
        return;
      }

      const indicators = calculateAll(candles);
      historyCache.set(symbol, timeframe, range, candles, indicators);
      socket.emit('history', { symbol, timeframe, candles, indicators });

      console.log(`[HistoryLoader] ${symbol} ${timeframe} — ${candles.length} candles`);
    } catch (error: any) {
      console.error(`[HistoryLoader] Failed for ${symbol}:`, error.message);
      socket.emit('error_msg', { symbol, message: error.message });
    }
  }
}

export const historyLoader = new HistoryLoader();
