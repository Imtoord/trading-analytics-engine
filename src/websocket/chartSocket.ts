import { Server, Socket } from 'socket.io';
import { MarketBroadcaster }      from './MarketBroadcaster';
import { SocketConnectionHandler } from './SocketConnectionHandler';

export function initChartSocket(io: Server): void {
  new MarketBroadcaster(io);

  io.on('connection', (socket: Socket) => {
    new SocketConnectionHandler(socket);
  });
}
