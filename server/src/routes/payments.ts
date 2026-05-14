import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { PaymentResult } from '../types.js';

export const paymentsRouter = Router();

const RANDOM_DECLINE_RATE = 0.1;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function charge(input: {
  amountCents: number;
  cardNumber: string;
}): Promise<PaymentResult> {
  await delay(200 + Math.random() * 400);

  if (!input.cardNumber || input.cardNumber.length < 4) {
    return { status: 'declined', reason: 'invalid card' };
  }
  if (input.amountCents <= 0) {
    return { status: 'declined', reason: 'invalid amount' };
  }

  if (input.cardNumber.startsWith('4242')) {
    return { status: 'approved', chargeId: `ch_${randomUUID()}` };
  }
  if (input.cardNumber.startsWith('4000')) {
    return { status: 'declined', reason: 'card declined' };
  }

  if (Math.random() < RANDOM_DECLINE_RATE) {
    return { status: 'declined', reason: 'card declined' };
  }
  return { status: 'approved', chargeId: `ch_${randomUUID()}` };
}

paymentsRouter.post('/api/payments/charge', async (req, res) => {
  const { amount, cardNumber } = req.body ?? {};
  if (typeof amount !== 'number' || typeof cardNumber !== 'string') {
    res.status(400).json({ error: 'amount (number) and cardNumber (string) are required' });
    return;
  }
  const result = await charge({ amountCents: amount, cardNumber });
  res.json(result);
});
