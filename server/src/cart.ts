import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { charge } from './routes/payments.js';
import { expiryFrom, releaseExpiredReservationsUnsafe } from './inventory.js';
import { totalCents } from './pricing.js';

export class CartError extends Error {
  constructor(
    public status: number,
    message: string,
    public reason?: string,
    public eventIds: string[] = []
  ) {
    super(message);
  }
}

export interface CartReservation {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ownerEmail: string;
  quantity: number;
  expiresAt: string;
  ticketTypeName: string;
  ticketTypeColor: string;
  priceCents: number;
  eventName: string;
}

export interface CartState {
  eventId: string | null;
  expiresAt: string | null;
  items: CartReservation[];
  totalCents: number;
}

function activeCartRows(ownerEmail: string, now: Date): CartReservation[] {
  return db
    .prepare(
      `SELECT
         r.id,
         r.event_id as eventId,
         r.ticket_type_id as ticketTypeId,
         r.owner_email as ownerEmail,
         r.quantity,
         r.expires_at as expiresAt,
         tt.name as ticketTypeName,
         tt.color as ticketTypeColor,
         tt.price_cents as priceCents,
         e.name as eventName
       FROM reservations r
       JOIN ticket_types tt ON tt.id = r.ticket_type_id
       JOIN events e ON e.id = r.event_id
       WHERE r.owner_email = ?
         AND r.status = 'active'
         AND r.expires_at > ?
       ORDER BY tt.price_cents DESC`
    )
    .all(ownerEmail, now.toISOString()) as CartReservation[];
}

function toCartState(items: CartReservation[]): CartState {
  return {
    eventId: items[0]?.eventId ?? null,
    expiresAt:
      items.length === 0
        ? null
        : items.reduce((min, item) => (item.expiresAt < min ? item.expiresAt : min), items[0]!.expiresAt),
    items,
    totalCents: totalCents(items),
  };
}

export function getCart(ownerEmail: string, now = new Date()): CartState {
  db.transaction(() => releaseExpiredReservationsUnsafe(now)).immediate();
  return toCartState(activeCartRows(ownerEmail, now));
}

export function addCartItem(input: {
  ownerEmail: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  now?: Date;
}): CartState {
  const now = input.now ?? new Date();
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new CartError(400, 'quantity must be a positive integer');
  }

  const tx = db.transaction(() => {
    releaseExpiredReservationsUnsafe(now);
    const nowIso = now.toISOString();
    const expiresAt = expiryFrom(now);

    const type = db
      .prepare(
        `SELECT id, event_id as eventId
         FROM ticket_types
         WHERE id = ? AND event_id = ?`
      )
      .get(input.ticketTypeId, input.eventId) as { id: string; eventId: string } | undefined;
    if (!type) throw new CartError(404, 'ticket type not found for this event');

    const existingCart = activeCartRows(input.ownerEmail, now);
    const existingEventId = existingCart[0]?.eventId;
    if (existingEventId && existingEventId !== input.eventId) {
      throw new CartError(409, 'cart already contains tickets for another event');
    }

    const reserve = db
      .prepare(
        `UPDATE ticket_type_inventory
         SET remaining = remaining - ?, updated_at = ?
         WHERE ticket_type_id = ? AND remaining >= ?`
      )
      .run(input.quantity, nowIso, input.ticketTypeId, input.quantity);
    if (reserve.changes === 0) throw new CartError(409, 'not enough tickets remaining');

    const existingLine = existingCart.find((item) => item.ticketTypeId === input.ticketTypeId);
    if (existingLine) {
      db.prepare(
        `UPDATE reservations
         SET quantity = quantity + ?, expires_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(input.quantity, expiresAt, nowIso, existingLine.id);
    } else {
      db.prepare(
        `INSERT INTO reservations (
           id, event_id, ticket_type_id, owner_email, quantity, status, expires_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
      ).run(
        `res_${randomUUID()}`,
        input.eventId,
        input.ticketTypeId,
        input.ownerEmail,
        input.quantity,
        expiresAt,
        nowIso,
        nowIso
      );
    }

    db.prepare(
      `UPDATE reservations
       SET expires_at = ?, updated_at = ?
       WHERE owner_email = ?
         AND event_id = ?
         AND status = 'active'
         AND expires_at > ?`
    ).run(expiresAt, nowIso, input.ownerEmail, input.eventId, nowIso);

    return activeCartRows(input.ownerEmail, now);
  });

  const items = tx.immediate();
  return toCartState(items);
}

export function releaseCart(ownerEmail: string, now = new Date()): { eventIds: string[] } {
  const tx = db.transaction(() => {
    releaseExpiredReservationsUnsafe(now);
    const nowIso = now.toISOString();
    const rows = db
      .prepare(
        `SELECT id, event_id as eventId, ticket_type_id as ticketTypeId, quantity
         FROM reservations
         WHERE owner_email = ? AND status = 'active' AND expires_at > ?`
      )
      .all(ownerEmail, nowIso) as Array<{
      id: string;
      eventId: string;
      ticketTypeId: string;
      quantity: number;
    }>;

    const eventIds = new Set<string>();
    for (const row of rows) {
      const released = db
        .prepare(
          `UPDATE reservations
           SET status = 'released', updated_at = ?
           WHERE id = ? AND status = 'active'`
        )
        .run(nowIso, row.id);
      if (released.changes > 0) {
        db.prepare(
          `UPDATE ticket_type_inventory
           SET remaining = remaining + ?, updated_at = ?
           WHERE ticket_type_id = ?`
        ).run(row.quantity, nowIso, row.ticketTypeId);
        eventIds.add(row.eventId);
      }
    }
    return { eventIds: [...eventIds] };
  });

  return tx.immediate();
}

export async function checkoutCart(input: {
  ownerEmail: string;
  cardNumber: string;
  now?: Date;
}): Promise<{
  tickets: Array<{ id: string; eventId: string; ticketTypeId: string; ownerEmail: string; chargeId: string }>;
  chargeId: string;
  amountCents: number;
  eventIds: string[];
}> {
  const checkoutStartedAt = input.now ?? new Date();
  const checkoutStartedIso = checkoutStartedAt.toISOString();
  const snapshot = getCart(input.ownerEmail, checkoutStartedAt);
  if (snapshot.items.length === 0) throw new CartError(409, 'cart is empty or expired');

  const result = await charge({ amountCents: snapshot.totalCents, cardNumber: input.cardNumber });
  if (result.status !== 'approved') {
    const released = releaseCart(input.ownerEmail, new Date());
    throw new CartError(402, 'payment declined', result.reason, released.eventIds);
  }

  const reservationIds = snapshot.items.map((item) => item.id);
  const tx = db.transaction(() => {
    const placeholders = reservationIds.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `SELECT id, event_id as eventId, ticket_type_id as ticketTypeId, owner_email as ownerEmail, quantity
         FROM reservations
         WHERE id IN (${placeholders})
           AND owner_email = ?
           AND status = 'active'
           AND expires_at > ?`
      )
      .all(...reservationIds, input.ownerEmail, checkoutStartedIso) as Array<{
      id: string;
      eventId: string;
      ticketTypeId: string;
      ownerEmail: string;
      quantity: number;
    }>;

    if (rows.length !== snapshot.items.length) {
      throw new CartError(409, 'cart changed or expired during checkout');
    }

    const purchasedAt = new Date().toISOString();
    const tickets: Array<{
      id: string;
      eventId: string;
      ticketTypeId: string;
      ownerEmail: string;
      chargeId: string;
    }> = [];
    const insertTicket = db.prepare(
      `INSERT INTO tickets (id, event_id, ticket_type_id, owner_email, purchased_at, charge_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const row of rows) {
      for (let i = 0; i < row.quantity; i++) {
        const ticketId = `tkt_${randomUUID()}`;
        insertTicket.run(ticketId, row.eventId, row.ticketTypeId, row.ownerEmail, purchasedAt, result.chargeId);
        tickets.push({
          id: ticketId,
          eventId: row.eventId,
          ticketTypeId: row.ticketTypeId,
          ownerEmail: row.ownerEmail,
          chargeId: result.chargeId,
        });
      }
    }

    db.prepare(
      `UPDATE reservations
       SET status = 'confirmed', updated_at = ?
       WHERE id IN (${placeholders})`
    ).run(purchasedAt, ...reservationIds);

    return {
      tickets,
      chargeId: result.chargeId,
      amountCents: snapshot.totalCents,
      eventIds: [...new Set(rows.map((row) => row.eventId))],
    };
  });

  return tx.immediate();
}
