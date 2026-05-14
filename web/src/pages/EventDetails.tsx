import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type EventWithTicketTypes } from '../api';
import { useEventStream } from '../ws';

export function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventWithTicketTypes | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getEvent(id).then(setEvent).catch((e) => setError(String(e)));
  }, [id]);

  useEventStream((msg) => {
    if (!event || msg.data.eventId !== event.id) return;
    setEvent({
      ...event,
      ticketTypes: event.ticketTypes.map((t) => ({
        ...t,
        remaining: msg.data.remainingByTicketType[t.id] ?? t.remaining,
      })),
    });
  });

  if (error) return <p className="error">{error}</p>;
  if (!event) return <p className="muted">Loading…</p>;

  const addToCart = async (ticketTypeId: string) => {
    setAdding(ticketTypeId);
    setError(null);
    setCartMessage(null);
    try {
      const quantity = quantities[ticketTypeId] ?? 1;
      const result = await api.addCartItem({ eventId: event.id, ticketTypeId, quantity });
      setCartMessage(`${result.cart.items.length} cart line(s), reserved until ${new Date(result.cart.expiresAt!).toLocaleTimeString()}`);
      const refreshed = await api.getEvent(event.id);
      setEvent(refreshed);
    } catch (e) {
      setError(String(e));
    } finally {
      setAdding(null);
    }
  };

  return (
    <div>
      <div className="card">
        <h3 style={{ margin: 0 }}>{event.name}</h3>
        <div className="muted">{event.venue} · {new Date(event.startsAt).toLocaleString()}</div>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Tickets</h4>
        {cartMessage && (
          <div className="ok" style={{ marginBottom: 8 }}>
            {cartMessage} · <Link to="/checkout">Checkout</Link>
          </div>
        )}
        {event.ticketTypes.map((t) => (
          <div key={t.id} className="tt-row">
            <span className="dot" style={{ background: t.color }} />
            <strong style={{ flex: 1 }}>{t.name}</strong>
            <span className="muted">${(t.priceCents / 100).toFixed(2)}</span>
            <span className="muted" style={{ minWidth: 80, textAlign: 'right' }}>
              {t.remaining} / {t.quota} left
            </span>
            <input
              type="number"
              min={1}
              max={Math.max(t.remaining, 1)}
              value={quantities[t.id] ?? 1}
              onChange={(e) =>
                setQuantities({
                  ...quantities,
                  [t.id]: Math.max(1, Number(e.target.value) || 1),
                })
              }
              disabled={t.remaining <= 0}
              style={{ width: 68 }}
            />
            <button disabled={t.remaining <= 0 || adding === t.id} onClick={() => addToCart(t.id)}>
              {t.remaining > 0 ? (adding === t.id ? 'Adding…' : 'Add') : 'Sold out'}
            </button>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <Link to="/checkout">
            <button className="secondary">View cart</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
