import { describe, expect, it } from 'vitest';
import { charge } from '../src/routes/payments.js';

describe('payment gateway', () => {
  it('approves a magic 4242 card', async () => {
    const res = await charge({ amountCents: 1000, cardNumber: '4242424242424242' });
    expect(res.status).toBe('approved');
    if (res.status === 'approved') {
      expect(res.chargeId).toMatch(/^ch_/);
    }
  });

  it('declines a magic 4000 card', async () => {
    const res = await charge({ amountCents: 1000, cardNumber: '4000000000000000' });
    expect(res.status).toBe('declined');
  });

  it('declines invalid amounts', async () => {
    const res = await charge({ amountCents: 0, cardNumber: '4242424242424242' });
    expect(res.status).toBe('declined');
  });
});
