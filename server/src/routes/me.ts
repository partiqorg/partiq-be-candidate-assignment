import { Router } from 'express';
import { db } from '../db.js';

export const meRouter = Router();

meRouter.get('/api/me/tickets', (req, res) => {
  const ownerEmail = req.header('x-user-email');
  if (!ownerEmail) {
    res.status(401).json({ error: 'X-User-Email header is required' });
    return;
  }

  const rows = db
    .prepare(
      `SELECT
         t.id              as id,
         t.event_id        as eventId,
         t.ticket_type_id  as ticketTypeId,
         t.purchased_at    as purchasedAt,
         t.charge_id       as chargeId,
         e.name            as eventName,
         e.venue           as venue,
         e.starts_at       as startsAt,
         tt.name           as ticketTypeName,
         tt.color          as ticketTypeColor,
         tt.price_cents    as priceCents
       FROM tickets t
       JOIN events e        ON e.id = t.event_id
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       WHERE t.owner_email = ?
       ORDER BY t.purchased_at DESC`
    )
    .all(ownerEmail);

  res.json({ tickets: rows });
});
