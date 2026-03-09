import 'dotenv/config';
import express from 'express';
import http    from 'http';
import cors    from 'cors';
import { Server } from 'socket.io';

import { ENV }            from './config/env';
import { connectDatabase } from './database/connection';
import marketRoutes        from './routes/market.routes';
import backtestRoutes      from './routes/backtest.routes';
import { initChartSocket } from './websocket/chartSocket';

async function startServer() {
  // ── Express ──────────────────────────────────────
  const app    = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json());

  // ── REST API ─────────────────────────────────────
  app.use('/api/backtest', backtestRoutes);
  app.use('/api', marketRoutes);
  app.get('/health', (_, res) => res.json({ status: 'ok', clients: io.engine.clientsCount }));

  // ── Socket.io ────────────────────────────────────
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET','POST'] },
    pingTimeout:  20000,
    pingInterval: 10000,
  });

  // ── Database ─────────────────────────────────────
  await connectDatabase();

  // ── WebSocket handler ─────────────────────────────
  initChartSocket(io);

  // ── Start ─────────────────────────────────────────
  server.listen(ENV.PORT, () => {
    console.log(`\n🚀 Server → http://localhost:${ENV.PORT}`);
    console.log('\n── REST API ──────────────────────────────');
    console.log(`  GET /api/history?symbol=EURUSD&range=1Y`);
    console.log(`  GET /api/quote?symbol=EURUSD`);
    console.log(`  GET /api/indicators?symbol=EURUSD`);
    console.log(`  GET /api/signals?symbol=EURUSD&strategy=rsi`);
    console.log('\n── Backtest API ──────────────────────────');
    console.log('  POST /api/backtest          { symbol, strategy, range, ... }');
    console.log('  POST /api/backtest/compare  { symbol, strategies: [...] }');
    console.log('  GET  /api/backtest/strategies');
    console.log('\n── WebSocket Events ──────────────────────');
    console.log('  Client → subscribe    { symbol, timeframe, range }');
    console.log('  Client → change_tf    { symbol, timeframe, range }');
    console.log('  Client → unsubscribe  { symbol, timeframe }');
    console.log('  Server → history      { symbol, timeframe, candles, indicators }');
    console.log('  Server → candle       { symbol, timeframe, candle }');
    console.log('  Server → indicators   { symbol, timeframe, indicators }');
    console.log('  Server → tick         { symbol, price, volume, timestamp }');
    console.log('──────────────────────────────────────────\n');
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});