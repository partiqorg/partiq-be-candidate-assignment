import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Event } from '../api';

export function EventsList() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listEvents().then((r) => setEvents(r.events)).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!events) return <p className="muted">Loading…</p>;

  return (
    <div>
      {events.map((e) => (
        <div key={e.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 style={{ margin: 0 }}>
              <Link to={`/events/${e.id}`}>{e.name}</Link>
            </h3>
            <span className="muted">{new Date(e.startsAt).toLocaleString()}</span>
          </div>
          <div className="muted">{e.venue}</div>
        </div>
      ))}
    </div>
  );
}
