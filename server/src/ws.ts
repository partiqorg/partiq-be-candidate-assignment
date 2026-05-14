import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { db } from './db.js';
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
  const rows = db
    .prepare(
      `SELECT tt.id as ticketTypeId,
              tt.quota - (SELECT COUNT(*) FROM tickets t WHERE t.ticket_type_id = tt.id) AS remaining
       FROM ticket_types tt
       WHERE tt.event_id = ?`
    )
    .all(eventId) as Array<{ ticketTypeId: string; remaining: number }>;

  const remainingByTicketType: Record<string, number> = {};
  for (const r of rows) remainingByTicketType[r.ticketTypeId] = r.remaining;

  const message: WebSocketMessage = {
    type: 'event-updated',
    data: { eventId, remainingByTicketType },
  };

  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
