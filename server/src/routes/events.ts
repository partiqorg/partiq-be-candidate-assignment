import { Router } from 'express';
import { db } from '../db.js';
import { remainingByTicketType } from '../inventory.js';
import type { Event, EventWithTicketTypes, TicketType } from '../types.js';

export const eventsRouter = Router();

eventsRouter.get('/api/events', (_req, res) => {
  const rows = db
    .prepare('SELECT id, name, venue, starts_at as startsAt FROM events ORDER BY starts_at ASC')
    .all() as Event[];
  res.json({ events: rows });
});

eventsRouter.get('/api/events/:id', (req, res) => {
  const event = db
    .prepare('SELECT id, name, venue, starts_at as startsAt FROM events WHERE id = ?')
    .get(req.params.id) as Event | undefined;

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const types = db
    .prepare(
      `SELECT id, event_id as eventId, name, color, price_cents as priceCents, quota
       FROM ticket_types
       WHERE event_id = ?
       ORDER BY price_cents DESC`
    )
    .all(event.id) as TicketType[];

  const remaining = remainingByTicketType(event.id);
  const ticketTypes = types.map((t) => ({ ...t, remaining: remaining[t.id] ?? 0 }));

  const out: EventWithTicketTypes = { ...event, ticketTypes };
  res.json(out);
});
