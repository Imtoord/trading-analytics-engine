import axios from 'axios';
import { Router, Request, Response } from 'express';
import { fmpProvider } from '../providers/fmp.provider';
import { buildDateRange } from '../services/dateRange';
import { calculateAll } from '../indicators';
import { RSIStrategy } from '../strategies/rsiStrategy';
import { SMACrossoverStrategy } from '../strategies/smaCrossover';

const router = Router();

// GET /api/history?symbol=EURUSD&range=1Y
router.get('/history', async (req: Request, res: Response) => {
  try {
    const symbol    = (req.query.symbol    as string || 'EURUSD').toUpperCase();
    const range     = req.query.range      as string || '1Y';
    const timeframe = req.query.timeframe  as string || '1d';
    const { from, to } = buildDateRange(range);
    const candles = await fmpProvider.getHistory(symbol, from, to, timeframe);
    res.json({ symbol, candles, count: candles.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quote?symbol=EURUSD
router.get('/quote', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string || 'EURUSD').toUpperCase();
    const quote  = await fmpProvider.getQuote(symbol);
    res.json(quote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/indicators?symbol=EURUSD&range=1Y
router.get('/indicators', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string || 'EURUSD').toUpperCase();
    const range  = req.query.range  as string || '1Y';
    const { from, to } = buildDateRange(range);
    const candles = await fmpProvider.getHistory(symbol, from, to);
    const indicators = calculateAll(candles);
    res.json({ symbol, indicators });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signals?symbol=EURUSD&range=1Y&strategy=rsi
router.get('/signals', async (req: Request, res: Response) => {
  try {
    const symbol   = (req.query.symbol   as string || 'EURUSD').toUpperCase();
    const range    = req.query.range     as string || '1Y';
    const strategy = req.query.strategy  as string || 'rsi';
    const { from, to } = buildDateRange(range);
    const candles = await fmpProvider.getHistory(symbol, from, to);

    let signals;
    if (strategy === 'sma') {
      signals = new SMACrossoverStrategy().generateSignals(candles, symbol, '1d');
    } else {
      signals = new RSIStrategy().generateSignals(candles, symbol, '1d');
    }

    res.json({ symbol, strategy, signals, count: signals.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/search?query=apple
// Uses v3 search endpoint (available on free plan)
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.query as string || '').trim();
    if (!query) return res.json([]);

    // Try v3 search (free plan compatible)
    const result = await axios.get('https://financialmodelingprep.com/api/v3/search', {
      params: { query, apikey: 'zTIuEPRlxpxOT3Mi6BnHU4olSaItcaCD', limit: 10, exchange: '' },
      timeout: 5000,
    });

    const data = Array.isArray(result.data) ? result.data : [];
    res.json(data
      .filter((r: any) => r.symbol && r.name)
      .map((r: any) => ({
        symbol:   r.symbol,
        name:     r.name,
        exchange: r.stockExchange || r.exchangeShortName || '',
      }))
    );
  } catch (err: any) {
    console.error('[Search]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
// ── already exported, just append above export default ──