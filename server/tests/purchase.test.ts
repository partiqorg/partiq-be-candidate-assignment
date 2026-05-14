import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.DB_PATH = path.join(__dirname, '..', 'test.db');

let app: import('express').Express;
let resetAndSeed: () => void;

beforeAll(async () => {
  try {
    fs.unlinkSync(process.env.DB_PATH!);
  } catch {}
  const indexMod = await import('../src/index.js');
  const seedMod = await import('../src/seed.js');
  app = indexMod.buildApp();
  resetAndSeed = seedMod.seed;
});

beforeEach(() => {
  resetAndSeed();
});

const USER = 'alice@example.com';

describe('GET /api/events', () => {
  it('lists seeded events', async () => {
    const res = await request(app).get('/api/events').expect(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
  });
});

describe('GET /api/events/:id', () => {
  it('returns ticket types with remaining counts', async () => {
    const res = await request(app).get('/api/events/evt_rooftop').expect(200);
    expect(res.body.id).toBe('evt_rooftop');
    expect(res.body.ticketTypes.length).toBe(3);
    for (const t of res.body.ticketTypes) {
      expect(t.remaining).toBe(t.quota);
    }
  });

  it('404 on unknown event', async () => {
    await request(app).get('/api/events/nope').expect(404);
  });
});

describe('POST /api/tickets/purchase — happy path', () => {
  it('charges and creates a ticket with a magic card', async () => {
    const res = await request(app)
      .post('/api/tickets/purchase')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        payment: { cardNumber: '4242424242424242' },
      })
      .expect(201);

    expect(res.body.ticket.ownerEmail).toBe(USER);
    expect(res.body.ticket.chargeId).toMatch(/^ch_/);

    const me = await request(app)
      .get('/api/me/tickets')
      .set('X-User-Email', USER)
      .expect(200);
    expect(me.body.tickets.length).toBe(1);
  });

  it('decrements remaining count', async () => {
    const before = await request(app).get('/api/events/evt_rooftop').expect(200);
    const regularBefore = before.body.ticketTypes.find(
      (t: { id: string }) => t.id === 'tt_rooftop_regular'
    );

    await request(app)
      .post('/api/tickets/purchase')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        payment: { cardNumber: '4242424242424242' },
      })
      .expect(201);

    const after = await request(app).get('/api/events/evt_rooftop').expect(200);
    const regularAfter = after.body.ticketTypes.find(
      (t: { id: string }) => t.id === 'tt_rooftop_regular'
    );

    expect(regularAfter.remaining).toBe(regularBefore.remaining - 1);
  });
});

describe('POST /api/tickets/purchase — failure modes', () => {
  it('401 without user header', async () => {
    await request(app)
      .post('/api/tickets/purchase')
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        payment: { cardNumber: '4242424242424242' },
      })
      .expect(401);
  });

  it('402 when the card is declined', async () => {
    await request(app)
      .post('/api/tickets/purchase')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        payment: { cardNumber: '4000000000000000' },
      })
      .expect(402);
  });

  it('409 when the ticket type is sold out', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/tickets/purchase')
        .set('X-User-Email', `buyer${i}@example.com`)
        .send({
          eventId: 'evt_rooftop',
          ticketTypeId: 'tt_rooftop_vip',
          payment: { cardNumber: '4242424242424242' },
        })
        .expect(201);
    }

    await request(app)
      .post('/api/tickets/purchase')
      .set('X-User-Email', 'late@example.com')
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_vip',
        payment: { cardNumber: '4242424242424242' },
      })
      .expect(409);
  });
});
