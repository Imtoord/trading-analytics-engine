import { Socket } from 'socket.io';
import { fmpProvider }  from '../providers/fmp.provider';
import { historyLoader } from './HistoryLoader';

interface SubscribePayload   { symbol: string; timeframe?: string; range?: string; }
interface ChangeTfPayload    { symbol: string; timeframe: string;  range?: string; }
interface UnsubscribePayload { symbol: string; timeframe: string; }

function roomName(symbol: string, timeframe: string): string {
  return `sym:${timeframe}:${symbol}`;
}

export class SocketConnectionHandler {
  private readonly subscriptions = new Set<string>();

  constructor(private readonly socket: Socket) {
    this.registerEvents();
    console.log(`[Socket] Connected: ${socket.id}`);
  }

  private registerEvents(): void {
    this.socket.on('subscribe',   (p: SubscribePayload)   => this.onSubscribe(p));
    this.socket.on('change_tf',   (p: ChangeTfPayload)    => this.onChangeTf(p));
    this.socket.on('unsubscribe', (p: UnsubscribePayload) => this.onUnsubscribe(p));
    this.socket.on('disconnect',  ()                      => this.onDisconnect());
  }

  private async onSubscribe({ symbol }: SubscribePayload): Promise<void> {
    if (!symbol) return;

    const sym       = symbol.toUpperCase();
    const timeframe = '1d';
    const range     = 'ALL';
    const subKey    = `${sym}:${timeframe}`;

    if (!this.subscriptions.has(subKey)) {
      this.subscriptions.add(subKey);
      this.socket.join(roomName(sym, timeframe));
      fmpProvider.subscribe(sym);
    }

    await historyLoader.load(this.socket, sym, timeframe, range);
  }

  private async onChangeTf({ symbol, timeframe }: ChangeTfPayload): Promise<void> {
    if (!symbol || !timeframe) return;

    const sym   = symbol.toUpperCase();
    const range = 'ALL'; // range is always ALL — not client-controlled

    // Leave all current rooms for this symbol before joining the new timeframe
    for (const sub of Array.from(this.subscriptions)) {
      if (!sub.startsWith(`${sym}:`)) continue;
      const prevTimeframe = sub.split(':')[1];
      this.subscriptions.delete(sub);
      this.socket.leave(roomName(sym, prevTimeframe));
    }

    this.subscriptions.add(`${sym}:${timeframe}`);
    this.socket.join(roomName(sym, timeframe));

    await historyLoader.load(this.socket, sym, timeframe, range);
  }

  private onUnsubscribe({ symbol, timeframe }: UnsubscribePayload): void {
    if (!symbol) return;

    const sym = symbol.toUpperCase();
    this.subscriptions.delete(`${sym}:${timeframe}`);
    this.socket.leave(roomName(sym, timeframe));
    fmpProvider.unsubscribe(sym);
  }

  private onDisconnect(): void {
    for (const sub of this.subscriptions) {
      const symbol = sub.split(':')[0];
      fmpProvider.unsubscribe(symbol);
    }
    this.subscriptions.clear();
    console.log(`[Socket] Disconnected: ${this.socket.id}`);
  }
}
