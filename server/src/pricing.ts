export function totalCents(items: Array<{ priceCents: number; quantity: number }>): number {
  return items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
}
