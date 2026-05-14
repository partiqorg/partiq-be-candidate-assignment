import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type EventWithTicketTypes } from '../api';
import { useEventStream } from '../ws';

export function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventWithTicketTypes | null>(null);
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

  return (
    <div>
      <div className="card">
        <h3 style={{ margin: 0 }}>{event.name}</h3>
        <div className="muted">{event.venue} · {new Date(event.startsAt).toLocaleString()}</div>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Tickets</h4>
        {event.ticketTypes.map((t) => (
          <div key={t.id} className="tt-row">
            <span className="dot" style={{ background: t.color }} />
            <strong style={{ flex: 1 }}>{t.name}</strong>
            <span className="muted">${(t.priceCents / 100).toFixed(2)}</span>
            <span className="muted" style={{ minWidth: 80, textAlign: 'right' }}>
              {t.remaining} / {t.quota} left
            </span>
            <Link to={`/events/${event.id}/checkout/${t.id}`}>
              <button disabled={t.remaining <= 0}>{t.remaining > 0 ? 'Buy' : 'Sold out'}</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
