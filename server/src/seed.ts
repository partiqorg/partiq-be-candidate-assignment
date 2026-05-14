import { db, resetDb } from './db.js';

interface SeedTicketType {
  id: string;
  name: string;
  color: string;
  priceCents: number;
  quota: number;
}

interface SeedEvent {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  ticketTypes: SeedTicketType[];
}

const events: SeedEvent[] = [
  {
    id: 'evt_rooftop',
    name: 'Summer Rooftop',
    venue: 'Skybar TLV',
    startsAt: '2026-07-12T20:00:00.000Z',
    ticketTypes: [
      { id: 'tt_rooftop_vip', name: 'VIP', color: '#FFD700', priceCents: 25000, quota: 5 },
      { id: 'tt_rooftop_regular', name: 'Regular', color: '#2196F3', priceCents: 12000, quota: 20 },
      { id: 'tt_rooftop_student', name: 'Student', color: '#9C27B0', priceCents: 7000, quota: 10 },
    ],
  },
  {
    id: 'evt_indie',
    name: 'Indie Night',
    venue: 'The Block',
    startsAt: '2026-08-03T22:00:00.000Z',
    ticketTypes: [
      { id: 'tt_indie_vip', name: 'VIP', color: '#FFD700', priceCents: 18000, quota: 4 },
      { id: 'tt_indie_regular', name: 'Regular', color: '#2196F3', priceCents: 9000, quota: 25 },
    ],
  },
];

export function seed() {
  resetDb();

  const insertEvent = db.prepare(
    'INSERT INTO events (id, name, venue, starts_at) VALUES (?, ?, ?, ?)'
  );
  const insertType = db.prepare(
    'INSERT INTO ticket_types (id, event_id, name, color, price_cents, quota) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const insertTicket = db.prepare(
    `INSERT INTO tickets (id, event_id, ticket_type_id, owner_email, purchased_at, charge_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const e of events) {
      insertEvent.run(e.id, e.name, e.venue, e.startsAt);
      for (const t of e.ticketTypes) {
        insertType.run(t.id, e.id, t.name, t.color, t.priceCents, t.quota);
      }
    }
    insertTicket.run(
      'tkt_seed_demo',
      'evt_indie',
      'tt_indie_regular',
      'demo@partiq.local',
      '2026-05-01T12:00:00.000Z',
      'ch_seed_demo'
    );
  });

  tx();
}

export function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number };
  if (row.c === 0) {
    seed();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
  console.log('Seeded.');
}
