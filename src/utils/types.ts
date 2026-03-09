export interface Candle {
  time:   string;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

export interface Tick {
  symbol:    string;
  price:     number;
  bid?:      number;
  ask?:      number;
  volume:    number;
  timestamp: number;
}

export interface IndicatorPoint {
  time:  string;
  value: number;
}

export interface Signal {
  symbol:    string;
  timeframe: string;
  time:      string;
  signal:    'BUY' | 'SELL' | 'HOLD';
  reason:    string;
  price:     number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m':  60,
  '5m':  300,
  '15m': 900,
  '1h':  3600,
  '4h':  14400,
  '1d':  86400,
};