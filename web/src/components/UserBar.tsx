import { useEffect, useState } from 'react';

export function UserBar() {
  const [email, setEmail] = useState(() => localStorage.getItem('userEmail') ?? '');

  useEffect(() => {
    localStorage.setItem('userEmail', email);
  }, [email]);

  return (
    <div className="userbar">
      <span className="muted">Signed in as</span>
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
    </div>
  );
}
