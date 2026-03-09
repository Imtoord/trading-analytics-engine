import { Candle, IndicatorPoint } from '../utils/types';

/**
 * Money Flow Index (MFI)
 * ─────────────────────────────────────────
 * BUY  signal: MFI <= 20 (oversold)
 * SELL signal: MFI >= 80 (overbought)
 *
 * Formula:
 *   Typical Price = (High + Low + Close) / 3
 *   Raw Money Flow = Typical Price × Volume
 *   Money Flow Ratio = Positive MF / Negative MF
 *   MFI = 100 - (100 / (1 + Money Flow Ratio))
 */
export function mfi(candles: Candle[], period = 14): IndicatorPoint[] {
  if (candles.length < period + 1) return [];
  const out: IndicatorPoint[] = [];

  for (let i = period; i < candles.length; i++) {
    const slice = candles.slice(i - period, i + 1);
    let posMF = 0;
    let negMF = 0;

    for (let j = 1; j < slice.length; j++) {
      const curr = slice[j];
      const prev = slice[j - 1];
      const tp     = (curr.high + curr.low + curr.close) / 3;
      const prevTp = (prev.high + prev.low + prev.close) / 3;
      const rawMF  = tp * (curr.volume || 1);

      if (tp > prevTp)      posMF += rawMF;
      else if (tp < prevTp) negMF += rawMF;
    }

    const mfRatio = negMF === 0 ? 100 : posMF / negMF;
    const value   = +(100 - 100 / (1 + mfRatio)).toFixed(2);
    out.push({ time: candles[i].time, value });
  }

  return out;
}