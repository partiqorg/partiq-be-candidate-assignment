import { db } from './db.js';

export const RESERVATION_TTL_MS = Number(process.env.RESERVATION_TTL_MS ?? 60_000);

export interface ReleasedReservations {
  eventIds: string[];
}

export function expiryFrom(now: Date): string {
  return new Date(now.getTime() + RESERVATION_TTL_MS).toISOString();
}

export function releaseExpiredReservationsUnsafe(now: Date): ReleasedReservations {
  const nowIso = now.toISOString();
  const expired = db
    .prepare(
      `SELECT id, event_id as eventId, ticket_type_id as ticketTypeId, quantity
       FROM reservations
       WHERE status = 'active' AND expires_at <= ?`
    )
    .all(nowIso) as Array<{
    id: string;
    eventId: string;
    ticketTypeId: string;
    quantity: number;
  }>;

  const eventIds = new Set<string>();
  const release = db.prepare(
    `UPDATE reservations
     SET status = 'released', updated_at = ?
     WHERE id = ? AND status = 'active'`
  );
  const restore = db.prepare(
    `UPDATE ticket_type_inventory
     SET remaining = remaining + ?, updated_at = ?
     WHERE ticket_type_id = ?`
  );

  for (const r of expired) {
    const result = release.run(nowIso, r.id);
    if (result.changes > 0) {
      restore.run(r.quantity, nowIso, r.ticketTypeId);
      eventIds.add(r.eventId);
    }
  }

  return { eventIds: [...eventIds] };
}

export const releaseExpiredReservations = db
  .transaction((now: Date = new Date()) => releaseExpiredReservationsUnsafe(now))
  .immediate;

export function remainingByTicketType(eventId: string): Record<string, number> {
  releaseExpiredReservations(new Date());

  const rows = db
    .prepare(
      `SELECT tt.id as ticketTypeId, COALESCE(inv.remaining, tt.quota) as remaining
       FROM ticket_types tt
       LEFT JOIN ticket_type_inventory inv ON inv.ticket_type_id = tt.id
       WHERE tt.event_id = ?`
    )
    .all(eventId) as Array<{ ticketTypeId: string; remaining: number }>;

  const out: Record<string, number> = {};
  for (const row of rows) out[row.ticketTypeId] = row.remaining;
  return out;
}
