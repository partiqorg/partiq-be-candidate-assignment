# partiq backend candidate assignment

Welcome. This is a small slice of the partiq ticketing platform. The system runs today: users browse events, buy a ticket, and pay with a fake card. Your job is to extend it.

## Time

You have **90–120 minutes**, including a short discussion at the end. You will probably not finish everything — that's expected. We care about how you work, what you choose to ship, what you skip, and how you communicate trade-offs.

## What's in this repo

```
server/   Node + Express + WebSocket + SQLite backend (this is where most of your work lives)
web/      Minimal React app to exercise the system. UI quality will NOT be graded.
ARCHITECTURE.md   Short overview of how the pieces fit together
TODO.md           Backlog of things we've been meaning to get to
```

This is a backend role. You are free to touch the web app if it helps you verify, but you do not need to. `curl`, an HTTP client, or the existing tests are all fine ways to exercise your work.

## Setup

Requires Node 20+.

```bash
npm install
npm run dev
```

This starts:
- the API server on `http://localhost:3001`
- the web app on `http://localhost:5173`

The SQLite database is created and seeded on first run at `server/data.db`. To wipe and reseed:

```bash
npm run reset-db
```

Run the test suite:

```bash
npm test
```

You should see green tests on a fresh checkout. If they don't pass, flag it.

TypeScript is strict in both workspaces. To check types without running:

```bash
npm run typecheck
```

## The assignment

Read **both** steps before you start coding. Your Step 1 design will be load-bearing for Step 2 — picking the easiest possible cart now usually means rewriting it later.

### Step 1 — Cart

Today, a user can only buy one ticket at a time. Add support for buying **multiple tickets in a single transaction**.

Concretely:
- A user can add several ticket types and quantities from a single event to a cart.
- Checkout charges the whole cart in **one** payment, not many.
- The existing single-ticket purchase flow must keep working, or be cleanly migrated to use the new cart path.
- Cover your changes with tests. Update existing tests where you changed behaviour, and add new ones for the new behaviour.

How you model the cart (client-side, server-side, where state lives, what the API looks like) is your call. Be ready to defend it.

### Step 2 — Reservations & expiry

Today, the system has no notion of holding a ticket. Two users hitting "buy" on the last seat at the same moment will both succeed, and we oversell. Fix that.

Requirements:
- Adding a ticket to a cart **reserves** it for **60 seconds**.
- A reserved ticket counts against the event's available quota for other users. They should see the remaining count drop in real time (the WebSocket channel is already there — see `ARCHITECTURE.md`).
- If payment completes within 60s, the reservation becomes a confirmed ticket.
- If payment fails, the user cancels, or the 60s elapses, the reservation is released and the quota returns.
- Two simultaneous reservations for the same last seat must **not** both succeed.

Tests: write at least one test that **demonstrates two concurrent reservations of the last seat cannot both succeed**. If you run short on time, leave a clear comment in the test file describing what else you'd cover and why.

#### Things we deliberately left fuzzy

The spec above is what we'll grade against. A few things are intentionally underspecified — pick a defensible answer and either ask us during the session or document the choice in code:

- What happens when a user "cancels"? Cancel one item from the cart, or release the whole cart? Is there an explicit endpoint, or is closing the tab enough?
- Does adding a new item to the cart extend the 60-second TTL on existing items, or is each item's clock independent?
- If the same user reserves the same ticket type twice in quick succession, is that one reservation or two?

### Step 3 — Discussion

After you've coded as much as you're going to code, we'll talk through:
- The design decisions you made and the alternatives you considered.
- The edge cases you handled and the ones you didn't.
- What you'd do with another day, another week, another quarter.

We may interleave short design conversations between Steps 1 and 2.

## Ground rules

- **AI tools are allowed.** Use whatever you'd use at work. Expect to defend every change you ship — if you can't explain it, it doesn't count.
- **Tests are part of the work.** Don't say "I'd write tests next" if you have time to write one now.
- **Ask questions.** If something in the spec or the codebase is unclear, ask. Misreading the requirements costs more than a 30-second clarification.
- **Communicate as you go.** Think out loud, narrate trade-offs, flag things you're deferring. The discussion at the end is much shorter if we already know what you were thinking.

## API today (single-ticket flow)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness probe. Returns `{ ok: true }`. |
| GET | `/api/events` | List events |
| GET | `/api/events/:id` | One event with ticket types and remaining counts |
| POST | `/api/tickets/purchase` | Buy one ticket. Body: `{ eventId, ticketTypeId, payment: { cardNumber } }`. Charges payment then creates ticket. |
| GET | `/api/me/tickets` | Tickets owned by the current user (identified by `X-User-Email` header) |
| POST | `/api/payments/charge` | Charge a card. Body: `{ amount, cardNumber }`. Returns `{ status, chargeId }`. Has artificial latency and a small failure rate. Magic cards: `4242…` always succeeds, `4000…` always declines. |

WebSocket: connect to `ws://localhost:3001` to receive `{ type: "event-updated", data: { eventId, remainingByTicketType } }` messages whenever an event's remaining counts change.

Good luck.
