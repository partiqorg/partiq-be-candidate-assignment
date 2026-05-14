# TODO

Stuff we've been meaning to get to, in no particular order. Some of these intersect with the assignment, some don't. Use your judgement on what is actually relevant to the work in front of you.

- [ ] Add idempotency keys to `/api/payments/charge` so retries don't double-charge.
- [ ] Refund endpoint (`POST /api/payments/refund`) — we want partial refunds eventually.
- [ ] Discount codes. Product keeps asking. We've been deferring it.
- [ ] The available-count query in `routes/events.ts` is a `quota - COUNT(*)` against tickets. Works fine for single-purchase, may not survive concurrent sales.
- [ ] WebSocket broadcasts go to every connected client regardless of which event they're viewing. At 50 concurrent events this is going to hurt.
- [ ] WebSocket reconnect on the client doesn't request a fresh snapshot, so a tab that reconnects can show stale counts until the next broadcast.
- [ ] Tickets table has no index on `owner_email`. `/api/me/tickets` is fine today but will degrade.
- [ ] Audit log for purchases (`who bought what when, charge id`). Compliance wants this eventually.
- [ ] Transferring a ticket from one user to another.
