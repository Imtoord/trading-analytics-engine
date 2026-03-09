import { Candle } from '../utils/types';
import { sma }            from '../indicators/sma';
import { ema }            from '../indicators/ema';
import { rsi }            from '../indicators/rsi';
import { macd }           from '../indicators/macd';
import { bollingerBands } from '../indicators/bollinger';
import { stochastic }     from '../indicators/stochastic';
import { mfi }            from '../indicators/mfi';
import { aroon }          from '../indicators/aroon';

export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface BarSignal {
  time:   string;
  signal: SignalType;
  reason: string;
}

// ── RSI strategy ──────────────────────────────────────
export function rsiSignals(candles: Candle[], period = 14, ob = 70, os = 30): BarSignal[] {
  const rsiData = rsi(candles, period);
  const out: BarSignal[] = [];

  for (let i = 1; i < rsiData.length; i++) {
    const curr = rsiData[i].value;
    const prev = rsiData[i - 1].value;
    const time = rsiData[i].time;

    if (prev <= os && curr > os) {
      out.push({ time, signal: 'BUY',  reason: `RSI crossed above ${os} (${curr.toFixed(1)})` });
    } else if (prev >= ob && curr < ob) {
      out.push({ time, signal: 'SELL', reason: `RSI crossed below ${ob} (${curr.toFixed(1)})` });
    } else {
      out.push({ time, signal: 'HOLD', reason: '' });
    }
  }
  return out;
}

// ── SMA Crossover ─────────────────────────────────────
export function smaSignals(candles: Candle[], fast = 20, slow = 50): BarSignal[] {
  const fastData = sma(candles, fast);
  const slowData = sma(candles, slow);
  const slowMap  = new Map(slowData.map(d => [d.time, d.value]));
  const out: BarSignal[] = [];

  for (let i = 1; i < fastData.length; i++) {
    const t    = fastData[i].time;
    const tPrev = fastData[i - 1].time;
    if (!slowMap.has(t) || !slowMap.has(tPrev)) { out.push({ time: t, signal: 'HOLD', reason: '' }); continue; }

    const fc = fastData[i].value,  fp = fastData[i - 1].value;
    const sc = slowMap.get(t)!,    sp = slowMap.get(tPrev)!;

    if (fp <= sp && fc > sc)      out.push({ time: t, signal: 'BUY',  reason: `SMA${fast} crossed above SMA${slow}` });
    else if (fp >= sp && fc < sc) out.push({ time: t, signal: 'SELL', reason: `SMA${fast} crossed below SMA${slow}` });
    else                           out.push({ time: t, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── EMA Crossover ─────────────────────────────────────
export function emaSignals(candles: Candle[], fast = 12, slow = 26): BarSignal[] {
  const { ema: calcEma } = require('../indicators/ema');
  const fastData = calcEma(candles, fast);
  const slowData = calcEma(candles, slow);
  const slowMap  = new Map(slowData.map((d: any) => [d.time, d.value]));
  const out: BarSignal[] = [];

  for (let i = 1; i < fastData.length; i++) {
    const t    = fastData[i].time;
    const tPrev = fastData[i - 1].time;
    if (!slowMap.has(t) || !slowMap.has(tPrev)) { out.push({ time: t, signal: 'HOLD', reason: '' }); continue; }

    const fc = fastData[i].value,   fp = fastData[i - 1].value;
    const sc = slowMap.get(t)!,     sp = slowMap.get(tPrev)!;

    if (fp <= sp && fc > sc)      out.push({ time: t, signal: 'BUY',  reason: `EMA${fast} crossed above EMA${slow}` });
    else if (fp >= sp && fc < sc) out.push({ time: t, signal: 'SELL', reason: `EMA${fast} crossed below EMA${slow}` });
    else                           out.push({ time: t, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── MACD Strategy ─────────────────────────────────────
export function macdSignals(candles: Candle[]): BarSignal[] {
  const { macdLine, signalLine } = macd(candles);
  const sigMap = new Map(signalLine.map(d => [d.time, d.value]));
  const out: BarSignal[] = [];

  for (let i = 1; i < macdLine.length; i++) {
    const t    = macdLine[i].time;
    const tPrev = macdLine[i - 1].time;
    const mc = macdLine[i].value,   mp = macdLine[i - 1].value;
    const sc = sigMap.get(t),       sp = sigMap.get(tPrev);

    if (sc == null || sp == null) { out.push({ time: t, signal: 'HOLD', reason: '' }); continue; }

    if (mp <= sp && mc > sc && mc > 0)      out.push({ time: t, signal: 'BUY',  reason: `MACD crossed above signal (MACD > 0)` });
    else if (mp >= sp && mc < sc && mc < 0) out.push({ time: t, signal: 'SELL', reason: `MACD crossed below signal (MACD < 0)` });
    else                                     out.push({ time: t, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── Bollinger Bands ───────────────────────────────────
export function bollingerSignals(candles: Candle[]): BarSignal[] {
  const { upper, lower } = bollingerBands(candles);
  const upMap = new Map(upper.map(d => [d.time, d.value]));
  const loMap = new Map(lower.map(d => [d.time, d.value]));
  const out: BarSignal[] = [];

  for (let i = 1; i < candles.length; i++) {
    const c    = candles[i];
    const prev = candles[i - 1];
    const up   = upMap.get(c.time);
    const lo   = loMap.get(c.time);
    const upP  = upMap.get(prev.time);
    const loP  = loMap.get(prev.time);

    if (!up || !lo || !upP || !loP) { out.push({ time: c.time, signal: 'HOLD', reason: '' }); continue; }

    if (prev.close <= loP && c.close > lo)      out.push({ time: c.time, signal: 'BUY',  reason: `Price bounced above lower BB` });
    else if (prev.close >= upP && c.close < up) out.push({ time: c.time, signal: 'SELL', reason: `Price crossed below upper BB` });
    else                                         out.push({ time: c.time, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── Stochastic ────────────────────────────────────────
export function stochasticSignals(candles: Candle[]): BarSignal[] {
  const { k, d } = stochastic(candles);
  const dMap = new Map(d.map(v => [v.time, v.value]));
  const out: BarSignal[] = [];

  for (let i = 1; i < k.length; i++) {
    const t = k[i].time, tp = k[i - 1].time;
    const kc = k[i].value, kp = k[i - 1].value;
    const dc = dMap.get(t), dp = dMap.get(tp);

    if (dc == null || dp == null) { out.push({ time: t, signal: 'HOLD', reason: '' }); continue; }

    if (kp <= dp && kc > dc && kc < 20)      out.push({ time: t, signal: 'BUY',  reason: `%K crossed above %D in oversold zone (${kc.toFixed(1)})` });
    else if (kp >= dp && kc < dc && kc > 80) out.push({ time: t, signal: 'SELL', reason: `%K crossed below %D in overbought zone (${kc.toFixed(1)})` });
    else                                       out.push({ time: t, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── MFI Strategy ─────────────────────────────────────
export function mfiSignals(candles: Candle[]): BarSignal[] {
  const mfiData = mfi(candles);
  const out: BarSignal[] = [];

  for (let i = 1; i < mfiData.length; i++) {
    const curr = mfiData[i].value;
    const prev = mfiData[i - 1].value;
    const time = mfiData[i].time;

    if (prev <= 20 && curr > 20)      out.push({ time, signal: 'BUY',  reason: `MFI crossed above 20 (${curr.toFixed(1)})` });
    else if (prev >= 80 && curr < 80) out.push({ time, signal: 'SELL', reason: `MFI crossed below 80 (${curr.toFixed(1)})` });
    else                               out.push({ time, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── Aroon Strategy ────────────────────────────────────
export function aroonSignals(candles: Candle[]): BarSignal[] {
  const { up, down } = aroon(candles);
  const dnMap = new Map(down.map(d => [d.time, d.value]));
  const out: BarSignal[] = [];

  for (let i = 1; i < up.length; i++) {
    const t = up[i].time, tp = up[i - 1].time;
    const uc = up[i].value,  up_p = up[i - 1].value;
    const dc = dnMap.get(t), dp   = dnMap.get(tp);

    if (dc == null || dp == null) { out.push({ time: t, signal: 'HOLD', reason: '' }); continue; }

    if (up_p <= dp && uc > dc && uc > 70)      out.push({ time: t, signal: 'BUY',  reason: `Aroon Up crossed above Down (${uc.toFixed(0)})` });
    else if (up_p >= dp && uc < dc && dc > 70) out.push({ time: t, signal: 'SELL', reason: `Aroon Down crossed above Up (${dc.toFixed(0)})` });
    else                                         out.push({ time: t, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── Combined multi-indicator ──────────────────────────
export function combinedSignals(candles: Candle[]): BarSignal[] {
  const rsiSig   = rsiSignals(candles);
  const macdSig  = macdSignals(candles);
  const bbSig    = bollingerSignals(candles);

  // Align all to same time basis
  const rsiMap  = new Map(rsiSig.map(s  => [s.time, s]));
  const macdMap = new Map(macdSig.map(s => [s.time, s]));
  const bbMap   = new Map(bbSig.map(s   => [s.time, s]));

  const times = [...new Set([...rsiMap.keys(), ...macdMap.keys()])].sort();
  const out: BarSignal[] = [];

  for (const time of times) {
    const r = rsiMap.get(time)?.signal  || 'HOLD';
    const m = macdMap.get(time)?.signal || 'HOLD';
    const b = bbMap.get(time)?.signal   || 'HOLD';

    const buyVotes  = [r, m, b].filter(s => s === 'BUY').length;
    const sellVotes = [r, m, b].filter(s => s === 'SELL').length;

    if (buyVotes >= 2)       out.push({ time, signal: 'BUY',  reason: `Combined: ${buyVotes}/3 indicators BUY` });
    else if (sellVotes >= 2) out.push({ time, signal: 'SELL', reason: `Combined: ${sellVotes}/3 indicators SELL` });
    else                      out.push({ time, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── NO_SIGNAL (Buy & Hold — always BUY on first bar) ──
export function noSignal(candles: Candle[]): BarSignal[] {
  return candles.map((c, i) => ({
    time:   c.time,
    signal: i === 0 ? 'BUY' : 'HOLD',
    reason: i === 0 ? 'Buy & Hold entry' : '',
  }));
}

// ── RSI_50_ONLY (RSI crosses 50) ──────────────────────
export function rsi50Signals(candles: Candle[], period = 14): BarSignal[] {
  const rsiData = rsi(candles, period);
  const out: BarSignal[] = [];
  for (let i = 1; i < rsiData.length; i++) {
    const curr = rsiData[i].value, prev = rsiData[i - 1].value;
    const time = rsiData[i].time;
    if (prev <= 50 && curr > 50)      out.push({ time, signal: 'BUY',  reason: `RSI crossed above 50 (${curr.toFixed(1)})` });
    else if (prev >= 50 && curr < 50) out.push({ time, signal: 'SELL', reason: `RSI crossed below 50 (${curr.toFixed(1)})` });
    else                               out.push({ time, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── SMA_WITH_RSI (SMA signal confirmed by RSI > 50) ───
export function smaWithRsiSignals(candles: Candle[]): BarSignal[] {
  const smaRaw = smaSignals(candles);
  const rsiData = rsi(candles, 14);
  const rsiMap  = new Map(rsiData.map(d => [d.time, d.value]));
  return smaRaw.map(s => {
    if (s.signal === 'HOLD') return s;
    const rsiVal = rsiMap.get(s.time);
    if (rsiVal == null) return { ...s, signal: 'HOLD' as SignalType, reason: '' };
    if (s.signal === 'BUY'  && rsiVal > 50) return { ...s, reason: s.reason + ` & RSI=${rsiVal.toFixed(1)}>50` };
    if (s.signal === 'SELL' && rsiVal < 50) return { ...s, reason: s.reason + ` & RSI=${rsiVal.toFixed(1)}<50` };
    return { ...s, signal: 'HOLD' as SignalType, reason: '' };
  });
}

// ── RSI_WITH_RSI50 (RSI 30/70 filtered by RSI 50 trend) ─
export function rsiWithRsi50Signals(candles: Candle[]): BarSignal[] {
  const rsi14 = rsi(candles, 14);
  const rsi50 = rsi(candles, 50);
  const r50Map = new Map(rsi50.map(d => [d.time, d.value]));
  const out: BarSignal[] = [];
  for (let i = 1; i < rsi14.length; i++) {
    const curr = rsi14[i].value, prev = rsi14[i - 1].value;
    const time = rsi14[i].time;
    const r50  = r50Map.get(time) ?? 50;
    if (prev <= 30 && curr > 30 && r50 > 50)      out.push({ time, signal: 'BUY',  reason: `RSI14 OS bounce & RSI50=${r50.toFixed(1)}>50` });
    else if (prev >= 70 && curr < 70 && r50 < 50) out.push({ time, signal: 'SELL', reason: `RSI14 OB pullback & RSI50=${r50.toFixed(1)}<50` });
    else                                            out.push({ time, signal: 'HOLD', reason: '' });
  }
  return out;
}

// ── SMA_RSI50_COMBO (SMA cross + RSI50 same direction) ─
export function smaRsi50Combo(candles: Candle[]): BarSignal[] {
  const smaSig = smaSignals(candles);
  const r50    = rsi50Signals(candles);
  const r50Map = new Map(r50.map(s => [s.time, s.signal]));
  return smaSig.map(s => {
    if (s.signal === 'HOLD') return s;
    const r = r50Map.get(s.time);
    if (r === s.signal) return { ...s, reason: s.reason + ' + RSI50 confirms' };
    return { ...s, signal: 'HOLD' as SignalType, reason: '' };
  });
}

// ── RSI_RSI50_SMA_COMBO (3-way vote) ─────────────────
export function rsiRsi50SmaCombo(candles: Candle[]): BarSignal[] {
  const s1 = rsiSignals(candles);
  const s2 = rsi50Signals(candles);
  const s3 = smaSignals(candles);
  const m2 = new Map(s2.map(s => [s.time, s.signal]));
  const m3 = new Map(s3.map(s => [s.time, s.signal]));
  return s1.map(s => {
    const v2 = m2.get(s.time) || 'HOLD';
    const v3 = m3.get(s.time) || 'HOLD';
    const votes = [s.signal, v2, v3];
    const buys  = votes.filter(v => v === 'BUY').length;
    const sells = votes.filter(v => v === 'SELL').length;
    if (buys >= 2)       return { time: s.time, signal: 'BUY'  as SignalType, reason: `RSI+RSI50+SMA combo BUY (${buys}/3)` };
    if (sells >= 2)      return { time: s.time, signal: 'SELL' as SignalType, reason: `RSI+RSI50+SMA combo SELL (${sells}/3)` };
    return { time: s.time, signal: 'HOLD' as SignalType, reason: '' };
  });
}

// ── RSI_RSI50_COMBO ───────────────────────────────────
export function rsiRsi50Combo(candles: Candle[]): BarSignal[] {
  const s1 = rsiSignals(candles);
  const s2 = rsi50Signals(candles);
  const m2 = new Map(s2.map(s => [s.time, s.signal]));
  return s1.map(s => {
    const v2 = m2.get(s.time) || 'HOLD';
    if (s.signal !== 'HOLD' && s.signal === v2)
      return { ...s, reason: s.reason + ' + RSI50 confirms' };
    return { time: s.time, signal: 'HOLD' as SignalType, reason: '' };
  });
}

// ── RSI_SMA_COMBO ─────────────────────────────────────
export function rsiSmaCombo(candles: Candle[]): BarSignal[] {
  const s1 = rsiSignals(candles);
  const s2 = smaSignals(candles);
  const m2 = new Map(s2.map(s => [s.time, s.signal]));
  return s1.map(s => {
    const v2 = m2.get(s.time) || 'HOLD';
    if (s.signal !== 'HOLD' && s.signal === v2)
      return { ...s, reason: s.reason + ' + SMA confirms' };
    if (v2 !== 'HOLD' && v2 === s.signal)
      return { ...s, reason: `RSI+SMA agree: ${s.signal}` };
    return { time: s.time, signal: 'HOLD' as SignalType, reason: '' };
  });
}

// ── RSI50_SMA_COMBO ───────────────────────────────────
export function rsi50SmaCombo(candles: Candle[]): BarSignal[] {
  const s1 = rsi50Signals(candles);
  const s2 = smaSignals(candles);
  const m2 = new Map(s2.map(s => [s.time, s.signal]));
  return s1.map(s => {
    const v2 = m2.get(s.time) || 'HOLD';
    if (s.signal !== 'HOLD' && s.signal === v2)
      return { ...s, reason: `RSI50+SMA agree: ${s.signal}` };
    return { time: s.time, signal: 'HOLD' as SignalType, reason: '' };
  });
}

// ── Strategy dispatcher ───────────────────────────────
export function generateSignals(candles: Candle[], strategy: string): BarSignal[] {
  switch (strategy) {
    case 'rsi':              return rsiSignals(candles);
    case 'rsi_50':           return rsi50Signals(candles);
    case 'sma':              return smaSignals(candles);
    case 'ema':              return emaSignals(candles);
    case 'macd':             return macdSignals(candles);
    case 'bollinger':        return bollingerSignals(candles);
    case 'stochastic':       return stochasticSignals(candles);
    case 'mfi':              return mfiSignals(candles);
    case 'aroon':            return aroonSignals(candles);
    case 'combined':         return combinedSignals(candles);
    case 'no_signal':        return noSignal(candles);
    case 'sma_with_rsi':     return smaWithRsiSignals(candles);
    case 'rsi_with_rsi50':   return rsiWithRsi50Signals(candles);
    case 'sma_rsi50_combo':  return smaRsi50Combo(candles);
    case 'rsi_rsi50_sma':    return rsiRsi50SmaCombo(candles);
    case 'rsi_rsi50_combo':  return rsiRsi50Combo(candles);
    case 'rsi_sma_combo':    return rsiSmaCombo(candles);
    case 'rsi50_sma_combo':  return rsi50SmaCombo(candles);
    default:                  return rsiSignals(candles);
  }
}