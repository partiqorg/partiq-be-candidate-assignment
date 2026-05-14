import { Router } from 'express';
import { addCartItem, CartError, checkoutCart, getCart, releaseCart } from '../cart.js';
import { broadcastEventUpdate } from '../ws.js';

export const cartRouter = Router();

function ownerEmail(req: { header(name: string): string | undefined }) {
  return req.header('x-user-email');
}

function handleCartError(res: { status(code: number): { json(body: unknown): void } }, error: unknown) {
  if (error instanceof CartError) {
    res.status(error.status).json({ error: error.message, reason: error.reason });
    return;
  }
  throw error;
}

cartRouter.get('/api/cart', (req, res) => {
  const email = ownerEmail(req);
  if (!email) {
    res.status(401).json({ error: 'X-User-Email header is required' });
    return;
  }
  res.json({ cart: getCart(email) });
});

cartRouter.post('/api/cart/items', (req, res) => {
  const email = ownerEmail(req);
  if (!email) {
    res.status(401).json({ error: 'X-User-Email header is required' });
    return;
  }

  const { eventId, ticketTypeId, quantity } = req.body ?? {};
  if (typeof eventId !== 'string' || typeof ticketTypeId !== 'string') {
    res.status(400).json({ error: 'eventId and ticketTypeId are required' });
    return;
  }

  try {
    const cart = addCartItem({
      ownerEmail: email,
      eventId,
      ticketTypeId,
      quantity: typeof quantity === 'number' ? quantity : 1,
    });
    broadcastEventUpdate(eventId);
    res.status(201).json({ cart });
  } catch (error) {
    handleCartError(res, error);
  }
});

cartRouter.delete('/api/cart', (req, res) => {
  const email = ownerEmail(req);
  if (!email) {
    res.status(401).json({ error: 'X-User-Email header is required' });
    return;
  }

  const released = releaseCart(email);
  for (const eventId of released.eventIds) broadcastEventUpdate(eventId);
  res.status(204).send();
});

cartRouter.post('/api/cart/checkout', async (req, res) => {
  const email = ownerEmail(req);
  if (!email) {
    res.status(401).json({ error: 'X-User-Email header is required' });
    return;
  }

  const { payment } = req.body ?? {};
  if (!payment?.cardNumber) {
    res.status(400).json({ error: 'payment.cardNumber is required' });
    return;
  }

  try {
    const result = await checkoutCart({ ownerEmail: email, cardNumber: payment.cardNumber });
    for (const eventId of result.eventIds) broadcastEventUpdate(eventId);
    res.status(201).json({
      tickets: result.tickets,
      chargeId: result.chargeId,
      amountCents: result.amountCents,
    });
  } catch (error) {
    if (error instanceof CartError && error.status === 402) {
      for (const eventId of error.eventIds) broadcastEventUpdate(eventId);
    }
    handleCartError(res, error);
  }
});
