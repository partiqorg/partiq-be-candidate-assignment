import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type CartState } from '../api';

export function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartState | null>(null);
  const [cardNumber, setCardNumber] = useState('4242424242424242');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCart = () => {
    api.getCart().then((r) => setCart(r.cart)).catch((e) => setError(String(e)));
  };

  useEffect(() => {
    refreshCart();
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.checkoutCart({ cardNumber });
      navigate('/my-tickets');
    } catch (e) {
      setError(String(e));
      refreshCart();
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.cancelCart();
      refreshCart();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !cart) return <p className="error">{error}</p>;
  if (!cart) return <p className="muted">Loading…</p>;
  if (cart.items.length === 0) {
    return (
      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>Your cart is empty.</p>
        <Link to="/">
          <button>Browse events</button>
        </Link>
      </div>
    );
  }

  const firstItem = cart.items[0]!;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{firstItem.eventName}</h3>
      <div className="muted">
        Reserved until {cart.expiresAt ? new Date(cart.expiresAt).toLocaleTimeString() : ''}
      </div>

      <div style={{ marginTop: 12 }}>
        {cart.items.map((item) => (
          <div key={item.id} className="tt-row">
            <span className="dot" style={{ background: item.ticketTypeColor }} />
            <strong style={{ flex: 1 }}>{item.ticketTypeName}</strong>
            <span className="muted">x{item.quantity}</span>
            <span>${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <strong>Total ${(cart.totalCents / 100).toFixed(2)}</strong>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit} disabled={submitting}>
            {submitting ? 'Charging…' : 'Pay'}
          </button>
          <button className="secondary" onClick={cancel} disabled={submitting}>
            Cancel cart
          </button>
        </div>
      </div>
    </div>
  );
}
