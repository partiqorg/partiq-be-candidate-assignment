import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { charge } from './payments.js';
import { broadcastEventUpdate } from '../ws.js';
import type { TicketType } from '../types.js';

export const ticketsRouter = Router();

ticketsRouter.post('/api/tickets/purchase', async (req, res) => {
  const ownerEmail = req.header('x-user-email');
  if (!ownerEmail) {
    res.status(401).json({ error: 'X-User-Email header is required' });
    return;
  }

  const { eventId, ticketTypeId, payment } = req.body ?? {};
  if (typeof eventId !== 'string' || typeof ticketTypeId !== 'string' || !payment?.cardNumber) {
    res.status(400).json({ error: 'eventId, ticketTypeId, payment.cardNumber are required' });
    return;
  }

  const type = db
    .prepare(
      `SELECT id, event_id as eventId, name, color, price_cents as priceCents, quota
       FROM ticket_types WHERE id = ? AND event_id = ?`
    )
    .get(ticketTypeId, eventId) as TicketType | undefined;

  if (!type) {
    res.status(404).json({ error: 'ticket type not found for this event' });
    return;
  }

  const sold = db
    .prepare('SELECT COUNT(*) as c FROM tickets WHERE ticket_type_id = ?')
    .get(type.id) as { c: number };
  if (sold.c >= type.quota) {
    res.status(409).json({ error: 'sold out' });
    return;
  }

  const result = await charge({ amountCents: type.priceCents, cardNumber: payment.cardNumber });
  if (result.status !== 'approved') {
    res.status(402).json({ error: 'payment declined', reason: result.reason });
    return;
  }

  const ticketId = `tkt_${randomUUID()}`;
  db.prepare(
    `INSERT INTO tickets (id, event_id, ticket_type_id, owner_email, purchased_at, charge_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(ticketId, eventId, type.id, ownerEmail, new Date().toISOString(), result.chargeId);

  broadcastEventUpdate(eventId);

  res.status(201).json({
    ticket: {
      id: ticketId,
      eventId,
      ticketTypeId: type.id,
      ownerEmail,
      chargeId: result.chargeId,
    },
  });
});
