import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { remainingByTicketType } from './inventory.js';
import type { WebSocketMessage } from './types.js';

const clients = new Set<WebSocket>();

export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });
}

export function broadcastEventUpdate(eventId: string) {
  const message: WebSocketMessage = {
    type: 'event-updated',
    data: { eventId, remainingByTicketType: remainingByTicketType(eventId) },
  };

  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
