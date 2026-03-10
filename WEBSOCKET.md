# WebSocket Documentation — Trading Backend

## Overview

- **Library**: Socket.io v4
- **Server URL**: `http://localhost:3000`
- **Transport**: WebSocket (with polling fallback)
- **CORS**: All origins allowed (`*`)
- **Ping Timeout**: 20,000 ms
- **Ping Interval**: 10,000 ms

---

## How to Connect (Frontend)

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', {
  transports: ['websocket']
})

socket.on('connect', () => {
  console.log('Connected:', socket.id)
})
```

---

## Room System

Each symbol+timeframe pair has its own room.
Room name format: `sym:{timeframe}:{SYMBOL}`

| Example | Room Name |
|---------|-----------|
| EURUSD on 4h | `sym:4h:EURUSD` |
| AAPL on 1d | `sym:1d:AAPL` |
| BTCUSD on 1w | `sym:1w:BTCUSD` |

When a client subscribes, they **join that room** and only receive events for that symbol/timeframe.

---

## Client → Server Events (emit)

### `subscribe`
Subscribe to a symbol. Triggers loading of historical data + starts receiving live ticks.

> **Timeframe and range are fixed server-side — do not pass them.**
> The server always uses `timeframe = "4h"` and `range = "ALL"`.

```js
socket.emit('subscribe', {
  symbol: 'EURUSD',   // required — auto uppercased
})
```

**Immediately triggers** a `history` event back to the client with `timeframe: "4h"`.

---

### `change_tf`
Switch timeframe for an already subscribed symbol. Leaves old room, joins new room, reloads history.

> **Range is always `"ALL"` and cannot be changed by the client.**
> Only `symbol` and `timeframe` are used.

```js
socket.emit('change_tf', {
  symbol:    'EURUSD',   // required
  timeframe: '1d',       // required — see Available Timeframes below
})
```

**Immediately triggers** a `history` event back with data for the new timeframe.

---

### `unsubscribe`
Stop receiving updates for a symbol/timeframe pair.

```js
socket.emit('unsubscribe', {
  symbol:    'EURUSD',   // required
  timeframe: '4h',       // required
})
```

---

## Server → Client Events (listen)

### `history`
Sent once after `subscribe` or `change_tf`. Contains full historical candles + all calculated indicators.

```js
socket.on('history', (data) => {
  // data.symbol      → string   e.g. 'EURUSD'
  // data.timeframe   → string   e.g. '4h'
  // data.candles     → Candle[]
  // data.indicators  → object (see Indicators section)
})
```

**Candle object:**
```ts
// Intraday (1m, 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h):
{ time: number,  open: number, high: number, low: number, close: number, volume: number }
// time = Unix timestamp in seconds

// Daily / weekly / monthly (1d, 1w, 1M):
{ time: string,  open: number, high: number, low: number, close: number, volume: number }
// time = "YYYY-MM-DD" for 1d/1w, "YYYY-MM-01" for 1M
```

---

### `candle`
Sent on every tick — updates the **current (last) candle** in real-time.

```js
socket.on('candle', (data) => {
  // data.symbol     → string
  // data.timeframe  → string
  // data.candle     → Candle  (the updated current candle)
})
```

> Use this to update the last bar on your chart in real-time.

---

### `indicators`
Sent when a candle **closes** (timeframe bucket completes). Contains freshly recalculated indicators.

```js
socket.on('indicators', (data) => {
  // data.symbol     → string
  // data.timeframe  → string
  // data.indicators → object (same structure as in history)
})
```

---

### `tick`
Sent on every simulated price update (~1s). Broadcast to **all timeframe rooms** for the symbol.

```js
socket.on('tick', (data) => {
  // data.symbol     → string
  // data.price      → number
  // data.volume     → number
  // data.timestamp  → number (unix ms)
})
```

> Useful for displaying a live price ticker. Price is simulated between real FMP polls (3s interval).

---

### `error_msg`
Sent when something goes wrong (e.g. no data found, intraday data not available on free FMP plan).

```js
socket.on('error_msg', (data) => {
  // data.symbol   → string
  // data.message  → string  e.g. 'Intraday 1h requires a premium FMP plan (403)'
})
```

> When `error_msg` fires during a timeframe switch, revert to the previous timeframe. The chart is NOT destroyed.

---

## Available Timeframes

| Value | Description | Source |
|-------|-------------|--------|
| `1m`  | 1 Minute    | FMP intraday API |
| `5m`  | 5 Minutes   | FMP intraday API |
| `15m` | 15 Minutes  | FMP intraday API |
| `30m` | 30 Minutes  | FMP intraday API |
| `1h`  | 1 Hour      | FMP intraday API |
| `2h`  | 2 Hours     | Aggregated from 1h |
| `4h`  | 4 Hours (**default on subscribe**) | FMP intraday API |
| `8h`  | 8 Hours     | Aggregated from 4h |
| `12h` | 12 Hours    | Aggregated from 4h |
| `1d`  | 1 Day       | FMP daily API |
| `1w`  | 1 Week      | Aggregated from 1d |
| `1M`  | 1 Month     | Aggregated from 1d |

> **Note**: Intraday timeframes (1m–12h) for **forex pairs** (EURUSD, GBPUSD, etc.) require a premium FMP plan.
> Only `1d`, `1w`, `1M` work for forex on the free plan.
> Stocks and crypto support all timeframes.

---

## Indicators Structure (in `history` and `indicators` events)

```ts
indicators: {
  sma20:      { time, value }[]   // SMA 20
  sma50:      { time, value }[]   // SMA 50
  ema14:      { time, value }[]   // EMA 14
  vwap:       { time, value }[]   // VWAP
  bollinger: {
    upper:  { time, value }[]
    middle: { time, value }[]
    lower:  { time, value }[]
  }
  rsi14:      { time, value }[]   // RSI 14 (0–100)
  macd: {
    macdLine:   { time, value }[]
    signalLine: { time, value }[]
    histogram:  { time, value }[]
  }
  stochastic: {
    k: { time, value }[]          // %K
    d: { time, value }[]          // %D
  }
  mfi14:      { time, value }[]   // Money Flow Index 14
  aroon25: {
    up:   { time, value }[]       // Aroon Up 25
    down: { time, value }[]       // Aroon Down 25
  }
}
```

> Early values may be `null` while an indicator warms up (insufficient candles).

---

## Caching

- History cached **per `symbol + timeframe + range`** key
- Cache TTL: **5 minutes**
- On candle close: cache updated automatically, fresh `indicators` broadcast to room
- On cache miss: fetches from FMP API, calculates indicators, stores result

---

## Real-Time Price Flow

```
FMP REST /quote  (every 3s)
       │
       ▼
fmpProvider.lastPrice  ──→  simulation tick (every 1s)
       │
       ▼
fmpProvider emits 'tick'
       │
       ├──→  MarketBroadcaster → socket.to(room).emit('tick')  [all 12 TF rooms]
       │
       └──→  candleAggregator.processTick()
                    │
                    ├── candle:update → socket.to(room).emit('candle')
                    └── candle:close  → recalculate indicators → socket.to(room).emit('indicators')
```

---

## Full Example (Vanilla JS)

```js
const socket = io('http://localhost:3000', { transports: ['websocket'] })

// 1. Connect and subscribe (timeframe=4h, range=ALL — fixed by server)
socket.on('connect', () => {
  socket.emit('subscribe', { symbol: 'AAPL' })
})

// 2. Receive full history
socket.on('history', ({ symbol, timeframe, candles, indicators }) => {
  console.log(`${symbol} ${timeframe} — ${candles.length} candles`)
  renderChart(candles, indicators)
})

// 3. Real-time candle updates (~1s)
socket.on('candle', ({ candle }) => {
  updateLastBar(candle)
})

// 4. Indicators refresh on candle close
socket.on('indicators', ({ indicators }) => {
  updateIndicators(indicators)
})

// 5. Live price ticker
socket.on('tick', ({ symbol, price }) => {
  updatePriceTicker(symbol, price)
})

// 6. Error handling (e.g. no intraday data on free plan)
socket.on('error_msg', ({ symbol, message }) => {
  console.warn(`${symbol}: ${message}`)
  revertTimeframe()   // keep the chart, just go back to previous TF
})

// 7. Change timeframe — only timeframe needed, range is always ALL
function onTimeframeChange(tf) {
  socket.emit('change_tf', { symbol: 'AAPL', timeframe: tf })
}

// 8. Cleanup
function onDestroy() {
  socket.emit('unsubscribe', { symbol: 'AAPL', timeframe: '4h' })
  socket.disconnect()
}
```

---

## Event Flow Diagram

```
CLIENT                               SERVER
  |                                    |
  |-- connect ──────────────────────>  |
  |<──────────── (socket.id) ───────── |
  |                                    |
  |-- subscribe({ symbol:'EURUSD' }) ->|  timeframe=4h, range=ALL (hardcoded)
  |                                    |  joins room sym:4h:EURUSD
  |<──────────── history ──────────── |  candles + indicators for 4h/ALL
  |                                    |
  |     (live tick every ~1s)          |
  |<──────────── tick ──────────────── |  price update
  |<──────────── candle ───────────── |  current 4h candle updated
  |                                    |
  |     (4h candle closes)             |
  |<──────────── indicators ────────── |  recalculated indicators
  |                                    |
  |-- change_tf({ symbol, tf:'1d' }) ->|  range=ALL (hardcoded)
  |                                    |  leaves sym:4h:EURUSD
  |                                    |  joins  sym:1d:EURUSD
  |<──────────── history ──────────── |  new history for 1d/ALL
  |                                    |
  |-- unsubscribe({ sym, tf:'1d' }) -> |  leaves room
  |-- disconnect ───────────────────>  |
```
