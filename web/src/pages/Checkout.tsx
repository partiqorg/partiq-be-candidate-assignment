import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type EventWithTicketTypes } from '../api';

export function Checkout() {
  const { id, ticketTypeId } = useParams<{ id: string; ticketTypeId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventWithTicketTypes | null>(null);
  const [cardNumber, setCardNumber] = useState('4242424242424242');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getEvent(id).then(setEvent).catch((e) => setError(String(e)));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!event || !ticketTypeId) return <p className="muted">Loading…</p>;

  const tt = event.ticketTypes.find((t) => t.id === ticketTypeId);
  if (!tt) return <p className="error">Ticket type not found.</p>;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.purchase({ eventId: event.id, ticketTypeId: tt.id, cardNumber });
      navigate('/my-tickets');
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{event.name}</h3>
      <div className="tt-row">
        <span className="dot" style={{ background: tt.color }} />
        <strong style={{ flex: 1 }}>{tt.name}</strong>
        <span>${(tt.priceCents / 100).toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <label className="muted">Card number</label>
        <input
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="4242 4242 4242 4242"
        />
        <span className="muted">
          Magic cards: <code>4242…</code> always approves, <code>4000…</code> always declines.
        </span>
        {error && <p className="error">{error}</p>}
        <button onClick={submit} disabled={submitting}>
          {submitting ? 'Charging…' : `Pay $${(tt.priceCents / 100).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
