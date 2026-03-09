export interface BacktestConfig {
  symbol:      string;
  timeframe:   string;
  from:        string;
  to:          string;
  strategy:    string;        // 'rsi' | 'sma' | 'macd' | 'bollinger' | 'stochastic' | 'mfi' | 'aroon' | 'combined'
  initialCapital: number;     // e.g. 10000
  positionSize:   number;     // fraction of capital per trade, e.g. 0.1 = 10%
  stopLoss?:      number;     // e.g. 0.02 = 2%
  takeProfit?:    number;     // e.g. 0.04 = 4%
  commission?:    number;     // e.g. 0.001 = 0.1%
}

export interface Trade {
  id:          number;
  symbol:      string;
  direction:   'LONG' | 'SHORT';
  entryTime:   string;
  entryPrice:  number;
  exitTime:    string | null;
  exitPrice:   number | null;
  exitReason:  'SIGNAL' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_DATA' | null;
  pnl:         number | null;     // absolute P&L
  pnlPct:      number | null;     // percentage P&L
  commission:  number;
  holdingBars: number;
  signal:      string;            // reason for entry
}

export interface BacktestResult {
  config:        BacktestConfig;
  trades:        Trade[];
  equity:        EquityPoint[];   // equity curve
  metrics:       Metrics;
  candlesCount:  number;
  runTimeMs:     number;
}

export interface EquityPoint {
  time:   string;
  value:  number;
  drawdown: number;  // % drawdown from peak
}

export interface Metrics {
  // Returns
  totalReturn:      number;   // %
  annualizedReturn: number;   // %
  cagr:             number;   // %

  // Risk
  maxDrawdown:      number;   // %
  sharpeRatio:      number;
  sortinoRatio:     number;
  calmarRatio:      number;
  volatility:       number;   // annualized %

  // Trades
  totalTrades:      number;
  winningTrades:    number;
  losingTrades:     number;
  winRate:          number;   // %
  avgWin:           number;   // %
  avgLoss:          number;   // %
  profitFactor:     number;
  expectancy:       number;   // $ per trade
  avgHoldingBars:   number;
  largestWin:       number;   // %
  largestLoss:      number;   // %
  consecutiveWins:  number;
  consecutiveLosses: number;

  // Capital
  initialCapital:   number;
  finalCapital:     number;
  totalCommissions: number;
  buyAndHoldReturn: number;   // % benchmark
}