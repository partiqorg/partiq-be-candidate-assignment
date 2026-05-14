# Architecture

A short tour of the system. Read this before you start coding — it will save you time.

## Components

```
┌─────────────────┐         REST          ┌───────────────────────┐
│   web (React)   │  ───────────────────► │   server (Express)    │
│  localhost:5173 │  ◄───── WebSocket ─── │    localhost:3001     │
└─────────────────┘                       │                       │
                                          │  ┌─────────────────┐  │
                                          │  │  SQLite (file)  │  │
                                          │  │   server/data.db│  │
                                          │  └─────────────────┘  │
                                          └───────────────────────┘
```

There is no separate payment service. Payments are an endpoint inside the server (`/api/payments/charge`) that simulates latency and occasional declines. Treat it conceptually as if it were an external gateway.

## server/ layout

```
server/
├── src/
│   ├── index.ts          Express + WebSocket wiring, app bootstrap
│   ├── db.ts             SQLite connection and schema migration
│   ├── seed.ts           Inserts demo events and ticket types on first boot
│   ├── ws.ts             WebSocket broadcaster, exposes broadcast() to the rest of the app
│   ├── pricing.ts        Pure helper for totals
│   ├── types.ts          Shared types
│   └── routes/
│       ├── events.ts     GET /api/events, GET /api/events/:id
│       ├── tickets.ts    POST /api/tickets/purchase  (the single-ticket flow)
│       ├── payments.ts   POST /api/payments/charge   (the fake gateway)
│       └── me.ts         GET  /api/me/tickets        (current user's tickets)
└── tests/
    ├── purchase.test.ts  end-to-end happy path through the single-ticket flow
    └── payments.test.ts  payment gateway behaviour
```

## Data model

Three tables, defined in `server/src/db.ts`:

- **events** — `id`, `name`, `venue`, `starts_at`
- **ticket_types** — `id`, `event_id`, `name`, `color`, `price_cents`, `quota`
- **tickets** — `id`, `event_id`, `ticket_type_id`, `owner_email`, `purchased_at`, `charge_id`

Available count for a ticket type today is computed as `quota - COUNT(tickets WHERE ticket_type_id = ?)`. This is fine for the single-purchase flow but you may want to revisit it.

## User identity

There is no auth. The current user is identified by the `X-User-Email` header on every request. The web app has a small bar at the top where the user types their email; it's persisted to localStorage and sent on every API call. For tests, set the header directly.

## WebSocket protocol

One channel, broadcast to all connected clients. Messages:

```ts
{
  type: "event-updated",
  data: {
    eventId: string,
    remainingByTicketType: { [ticketTypeId: string]: number }
  }
}
```

The server emits this whenever a ticket is created. The web app listens and updates the visible "remaining" counts live.

## Payment gateway (`/api/payments/charge`)

- 200–600 ms artificial latency
- ~10% random declines
- Magic card numbers:
  - `4242...` always succeeds
  - `4000...` always declines
- Returns `{ status: "approved", chargeId }` on success or `{ status: "declined", reason }` on failure
- No idempotency. If you call it twice with the same input you get charged twice. This is on the TODO list.

## Seeded data

`seed.ts` populates two events and one demo ticket (Indie Night, Regular, owned by `demo@partiq.local`). Set the user bar in the web app to that email to see a pre-existing ticket in `/api/me/tickets` without buying anything.

## Using transactions

We use [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3), which is synchronous. Transactions look like this:

```ts
import { db } from './db.js';

const tx = db.transaction((email: string) => {
  const charge = db.prepare('INSERT INTO charges (id) VALUES (?)').run('ch_x');
  db.prepare('INSERT INTO tickets (id, owner_email) VALUES (?, ?)').run('tkt_x', email);
  return charge.changes;
});

tx('alice@example.com'); // runs everything inside BEGIN/COMMIT, rolls back on throw
```

You can also use `db.transaction(fn).immediate(...)` or `.exclusive(...)` if you need stronger locking semantics during contention.

## Things you can rely on

- The server is small. Reading all of `server/src/` end-to-end takes 5–10 minutes.
- The test suite is the source of truth for "what works today". Run it first.
- SQLite means transactions are real. Use them.
