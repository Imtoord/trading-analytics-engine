import { Server } from 'socket.io';
import { fmpProvider }      from '../providers/fmp.provider';
import { candleAggregator } from '../services/candleAggregator';
import { calculateAll }     from '../indicators';
import { historyCache }     from './HistoryCache';

const BROADCAST_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '12h', '1d', '1w', '1M'] as const;

function roomName(symbol: string, timeframe: string): string {
  return `sym:${timeframe}:${symbol}`;
}

export class MarketBroadcaster {
  constructor(private readonly io: Server) {
    this.listenToAggregator();
    this.listenToProviderTicks();
  }

  private listenToAggregator(): void {
    candleAggregator.on('candle:update', ({ symbol, timeframe, candle }) => {
      this.io.to(roomName(symbol, timeframe)).emit('candle', { symbol, timeframe, candle });
    });

    candleAggregator.on('candle:close', ({ symbol, timeframe, candle }) => {
      // Update all cache entries for this symbol+timeframe, get fresh indicators
      const indicators = historyCache.appendClosedCandle(symbol, timeframe, candle, calculateAll);
      if (!indicators) return;

      // Emit once to the room (not once per cache entry — fixes original bug)
      this.io.to(roomName(symbol, timeframe)).emit('indicators', { symbol, timeframe, indicators });
    });
  }

  private listenToProviderTicks(): void {
    fmpProvider.on('tick', ({ symbol, price, volume, timestamp }) => {
      for (const tf of BROADCAST_TIMEFRAMES) {
        this.io.to(roomName(symbol, tf)).emit('tick', { symbol, price, volume, timestamp });
      }
      candleAggregator.processTick({ symbol, price, volume, timestamp });
    });
  }
}
