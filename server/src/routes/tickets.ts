import { Router } from 'express';
import { addCartItem, CartError, checkoutCart, getCart } from '../cart.js';
import { broadcastEventUpdate } from '../ws.js';

export const ticketsRouter = Router();

ticketsRouter.post('/api/tickets/purchase', async (req, res) => {
  const ownerEmail = req.header('x-user-email');
  if (!ownerEmail) {
    res.status(401).json({ error: 'X-User-Email header is required' });
    return;
  }

  const { eventId, ticketTypeId, payment } = req.body ?? {};
  if (typeof eventId !== 'string' || typeof ticketTypeId !== 'string' || !payment?.cardNumber) {
    res.status(400).json({ error: 'eventId, ticketTypeId, payment.cardNumber are required' });
    return;
  }

  try {
    const existingCart = getCart(ownerEmail);
    if (existingCart.items.length > 0) {
      res.status(409).json({ error: 'active cart must be checked out or canceled first' });
      return;
    }

    addCartItem({ ownerEmail, eventId, ticketTypeId, quantity: 1 });
    broadcastEventUpdate(eventId);

    const result = await checkoutCart({ ownerEmail, cardNumber: payment.cardNumber });
    for (const updatedEventId of result.eventIds) broadcastEventUpdate(updatedEventId);

    res.status(201).json({ ticket: result.tickets[0] });
  } catch (error) {
    if (error instanceof CartError) {
      for (const updatedEventId of error.eventIds) broadcastEventUpdate(updatedEventId);
      res.status(error.status).json({ error: error.message, reason: error.reason });
      return;
    }
    throw error;
  }
});
