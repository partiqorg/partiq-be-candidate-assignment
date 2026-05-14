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
}

export interface EventWithTicketTypes extends Event {
  ticketTypes: Array<TicketType & { remaining: number }>;
}

export interface Ticket {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ownerEmail: string;
  purchasedAt: string;
  chargeId: string;
}

export type PaymentResult =
  | { status: 'approved'; chargeId: string }
  | { status: 'declined'; reason: string };

export type WebSocketMessage = {
  type: 'event-updated';
  data: {
    eventId: string;
    remainingByTicketType: Record<string, number>;
  };
};
