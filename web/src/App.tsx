import { NavLink, Route, Routes } from 'react-router-dom';
import { UserBar } from './components/UserBar';
import { EventsList } from './pages/EventsList';
import { EventDetails } from './pages/EventDetails';
import { Checkout } from './pages/Checkout';
import { MyTickets } from './pages/MyTickets';

export function App() {
  return (
    <div className="app">
      <h2>partiq</h2>
      <UserBar />
      <nav className="nav">
        <NavLink to="/" end>Events</NavLink>
        <NavLink to="/checkout">Cart</NavLink>
        <NavLink to="/my-tickets">My tickets</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<EventsList />} />
        <Route path="/events/:id" element={<EventDetails />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/events/:id/checkout/:ticketTypeId" element={<Checkout />} />
        <Route path="/my-tickets" element={<MyTickets />} />
      </Routes>
    </div>
  );
}
