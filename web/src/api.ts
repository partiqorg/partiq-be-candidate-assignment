export interface Event {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  color: string;
  priceCents: number;
  quota: number;
  remaining: number;
}

export interface EventWithTicketTypes extends Event {
  ticketTypes: TicketType[];
}

export interface MyTicket {
  id: string;
  eventId: string;
  ticketTypeId: string;
  purchasedAt: string;
  chargeId: string;
  eventName: string;
  venue: string;
  startsAt: string;
  ticketTypeName: string;
  ticketTypeColor: string;
  priceCents: number;
}

export interface CartItem {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ownerEmail: string;
  quantity: number;
  expiresAt: string;
  ticketTypeName: string;
  ticketTypeColor: string;
  priceCents: number;
  eventName: string;
}

export interface CartState {
  eventId: string | null;
  expiresAt: string | null;
  items: CartItem[];
  totalCents: number;
}

function userEmail(): string {
  return localStorage.getItem('userEmail') ?? '';
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Email': userEmail(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.reason ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json();
}

export const api = {
  listEvents: () => http<{ events: Event[] }>('/api/events'),
  getEvent: (id: string) => http<EventWithTicketTypes>(`/api/events/${id}`),
  myTickets: () => http<{ tickets: MyTicket[] }>('/api/me/tickets'),
  getCart: () => http<{ cart: CartState }>('/api/cart'),
  addCartItem: (input: { eventId: string; ticketTypeId: string; quantity: number }) =>
    http<{ cart: CartState }>('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  cancelCart: () =>
    fetch('/api/cart', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Email': userEmail(),
      },
    }).then((res) => {
      if (!res.ok) throw new Error(`${res.status} failed to cancel cart`);
    }),
  checkoutCart: (input: { cardNumber: string }) =>
    http<{ tickets: Array<{ id: string }>; chargeId: string; amountCents: number }>(
      '/api/cart/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ payment: { cardNumber: input.cardNumber } }),
      }
    ),
  purchase: (input: { eventId: string; ticketTypeId: string; cardNumber: string }) =>
    http<{ ticket: { id: string } }>('/api/tickets/purchase', {
      method: 'POST',
      body: JSON.stringify({
        eventId: input.eventId,
        ticketTypeId: input.ticketTypeId,
        payment: { cardNumber: input.cardNumber },
      }),
    }),
};
