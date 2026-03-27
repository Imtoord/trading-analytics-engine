# Trading Analytics Engine

Backend engine for financial market analysis.

Calculates technical indicators, generates trading signals, and runs backtesting on historical data.

Designed for scalable fintech platforms and algorithmic trading tools.

---

## Features

### Technical Indicators

- SMA
- EMA
- RSI
- MACD
- Bollinger Bands
- VWAP
- MFI
- Stochastic
- Aroon

### Backtesting

- test strategies on historical data
- evaluate signal performance
- measure win rate
- calculate drawdown
- compute Sharpe ratio

### Signal Generation

- buy signals
- sell signals
- crossover signals
- momentum signals

### Architecture

- modular indicator system
- reusable strategies
- scalable backend structure
- clean TypeScript types

---

## Tech Stack

<p>
<img src="https://skillicons.dev/icons?i=nodejs,ts,mongodb,docker" />
</p>

---

## Example Use Cases

Analyze stocks or crypto data.

Test strategy performance.

Generate trading signals.

Build fintech analytics tools.

Integrate with real-time market data providers.

---

## Example Signal Output

```json
{
 "symbol": "AAPL",
 "indicator": "RSI",
 "timeframe": "1d",
 "signal": 1,
 "winRate": 0.64,
 "sharpeRatio": 1.32,
 "maxDrawdown": -0.18
}
```

---

signal values

1 = buy
-1 = sell
0 = neutral

---

src

 indicators
  sma.ts
  ema.ts
  rsi.ts
  macd.ts
  bollinger.ts

 strategies
  rsiStrategy.ts
  macdStrategy.ts

 services
  backtest.service.ts
  signal.service.ts

 types
  candle.ts
  signal.ts

 utils
  math.ts

 config
