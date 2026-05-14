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

describe('cart reservations and checkout', () => {
  it('reserves and checks out different ticket types for the same event in one charge', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        quantity: 2,
      })
      .expect(201);

    const reserved = await request(app).get('/api/events/evt_rooftop').expect(200);
    const regularReserved = reserved.body.ticketTypes.find(
      (t: { id: string }) => t.id === 'tt_rooftop_regular'
    );
    expect(regularReserved.remaining).toBe(18);

    const addStudent = await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_student',
        quantity: 1,
      })
      .expect(201);

    expect(addStudent.body.cart.items).toHaveLength(2);
    expect(addStudent.body.cart.totalCents).toBe(31000);

    const checkout = await request(app)
      .post('/api/cart/checkout')
      .set('X-User-Email', USER)
      .send({ payment: { cardNumber: '4242424242424242' } })
      .expect(201);

    expect(checkout.body.amountCents).toBe(31000);
    expect(checkout.body.tickets).toHaveLength(3);
    expect(new Set(checkout.body.tickets.map((t: { chargeId: string }) => t.chargeId)).size).toBe(1);

    const me = await request(app)
      .get('/api/me/tickets')
      .set('X-User-Email', USER)
      .expect(200);
    expect(me.body.tickets).toHaveLength(3);
  });

  it('rejects tickets from another event without clearing the active cart', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        quantity: 1,
      })
      .expect(201);

    await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_indie',
        ticketTypeId: 'tt_indie_regular',
        quantity: 1,
      })
      .expect(409);

    const cart = await request(app).get('/api/cart').set('X-User-Email', USER).expect(200);
    expect(cart.body.cart.eventId).toBe('evt_rooftop');
    expect(cart.body.cart.items).toHaveLength(1);
  });

  it('allows tickets for multiple events in separate transactions', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        quantity: 1,
      })
      .expect(201);
    await request(app)
      .post('/api/cart/checkout')
      .set('X-User-Email', USER)
      .send({ payment: { cardNumber: '4242424242424242' } })
      .expect(201);

    await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_indie',
        ticketTypeId: 'tt_indie_vip',
        quantity: 1,
      })
      .expect(201);
    await request(app)
      .post('/api/cart/checkout')
      .set('X-User-Email', USER)
      .send({ payment: { cardNumber: '4242424242424242' } })
      .expect(201);

    const me = await request(app)
      .get('/api/me/tickets')
      .set('X-User-Email', USER)
      .expect(200);
    expect(me.body.tickets).toHaveLength(2);
    expect(new Set(me.body.tickets.map((t: { eventId: string }) => t.eventId))).toEqual(
      new Set(['evt_rooftop', 'evt_indie'])
    );
  });

  it('extends all existing cart item expiries when adding another item', async () => {
    const first = await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        quantity: 1,
      })
      .expect(201);
    const firstExpiry = first.body.cart.items[0].expiresAt;

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_student',
        quantity: 1,
      })
      .expect(201);

    const expiries = second.body.cart.items.map((item: { expiresAt: string }) => item.expiresAt);
    expect(expiries).toHaveLength(2);
    expect(new Set(expiries).size).toBe(1);
    expect(expiries[0] > firstExpiry).toBe(true);
  });

  it('releases the whole cart when payment is declined', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        quantity: 2,
      })
      .expect(201);

    await request(app)
      .post('/api/cart/checkout')
      .set('X-User-Email', USER)
      .send({ payment: { cardNumber: '4000000000000000' } })
      .expect(402);

    const cart = await request(app).get('/api/cart').set('X-User-Email', USER).expect(200);
    expect(cart.body.cart.items).toHaveLength(0);

    const event = await request(app).get('/api/events/evt_rooftop').expect(200);
    const regular = event.body.ticketTypes.find((t: { id: string }) => t.id === 'tt_rooftop_regular');
    expect(regular.remaining).toBe(20);
  });

  it('does not allow two concurrent reservations of the last seat', async () => {
    await request(app)
      .post('/api/cart/items')
      .set('X-User-Email', 'setup@example.com')
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_vip',
        quantity: 4,
      })
      .expect(201);

    const attempts = await Promise.allSettled([
      request(app)
        .post('/api/cart/items')
        .set('X-User-Email', 'alice@example.com')
        .send({
          eventId: 'evt_rooftop',
          ticketTypeId: 'tt_rooftop_vip',
          quantity: 1,
        }),
      request(app)
        .post('/api/cart/items')
        .set('X-User-Email', 'bob@example.com')
        .send({
          eventId: 'evt_rooftop',
          ticketTypeId: 'tt_rooftop_vip',
          quantity: 1,
        }),
    ]);

    const statuses = attempts.map((attempt) =>
      attempt.status === 'fulfilled' ? attempt.value.status : 500
    );
    expect(statuses.sort()).toEqual([201, 409]);
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

  it('404 when ticketTypeId belongs to a different event', async () => {
    await request(app)
      .post('/api/tickets/purchase')
      .set('X-User-Email', USER)
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_indie_regular',
        payment: { cardNumber: '4242424242424242' },
      })
      .expect(404);
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

describe('GET /api/me/tickets', () => {
  it('401 without user header', async () => {
    await request(app).get('/api/me/tickets').expect(401);
  });

  it('only returns tickets owned by the caller', async () => {
    await request(app)
      .post('/api/tickets/purchase')
      .set('X-User-Email', 'alice@example.com')
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        payment: { cardNumber: '4242424242424242' },
      })
      .expect(201);

    await request(app)
      .post('/api/tickets/purchase')
      .set('X-User-Email', 'bob@example.com')
      .send({
        eventId: 'evt_rooftop',
        ticketTypeId: 'tt_rooftop_regular',
        payment: { cardNumber: '4242424242424242' },
      })
      .expect(201);

    const aliceTickets = await request(app)
      .get('/api/me/tickets')
      .set('X-User-Email', 'alice@example.com')
      .expect(200);

    expect(aliceTickets.body.tickets).toHaveLength(1);
    const bobTickets = await request(app)
      .get('/api/me/tickets')
      .set('X-User-Email', 'bob@example.com')
      .expect(200);
    expect(bobTickets.body.tickets).toHaveLength(1);
    expect(aliceTickets.body.tickets[0].id).not.toBe(bobTickets.body.tickets[0].id);
  });
});
