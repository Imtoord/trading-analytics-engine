export interface Candle {
  time:   string | number;  // "YYYY-MM-DD" for daily, Unix seconds for intraday
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
  time:  string | number;
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

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d' | '1w' | '1M';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m':   60,
  '5m':   300,
  '15m':  900,
  '30m':  1800,
  '1h':   3600,
  '2h':   7200,
  '4h':   14400,
  '8h':   28800,
  '12h':  43200,
  '1d':   86400,
  '1w':   604800,
  '1M':   2592000,
};