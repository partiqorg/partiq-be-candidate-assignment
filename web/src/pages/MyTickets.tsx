import { useEffect, useState } from 'react';
import { api, type MyTicket } from '../api';

export function MyTickets() {
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.myTickets().then((r) => setTickets(r.tickets)).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!tickets) return <p className="muted">Loading…</p>;
  if (tickets.length === 0) return <p className="muted">No tickets yet.</p>;

  return (
    <div>
      {tickets.map((t) => (
        <div key={t.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{t.eventName}</strong>
            <span className="muted">{new Date(t.startsAt).toLocaleString()}</span>
          </div>
          <div className="tt-row">
            <span className="dot" style={{ background: t.ticketTypeColor }} />
            <span style={{ flex: 1 }}>{t.ticketTypeName}</span>
            <span className="muted">${(t.priceCents / 100).toFixed(2)}</span>
          </div>
          <div className="muted">Charge: {t.chargeId}</div>
        </div>
      ))}
    </div>
  );
}
