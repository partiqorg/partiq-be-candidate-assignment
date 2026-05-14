import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'data.db');

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    venue TEXT NOT NULL,
    starts_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ticket_types (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    quota INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id),
    owner_email TEXT NOT NULL,
    purchased_at TEXT NOT NULL,
    charge_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ticket_type_inventory (
    ticket_type_id TEXT PRIMARY KEY REFERENCES ticket_types(id) ON DELETE CASCADE,
    remaining INTEGER NOT NULL CHECK (remaining >= 0),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    ticket_type_id TEXT NOT NULL REFERENCES ticket_types(id),
    owner_email TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL CHECK (status IN ('active', 'confirmed', 'released')),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_reservations_owner_status
    ON reservations(owner_email, status);

  CREATE INDEX IF NOT EXISTS idx_reservations_expiry
    ON reservations(status, expires_at);
`);

export function initializeInventory() {
  db.prepare(
    `INSERT OR IGNORE INTO ticket_type_inventory (ticket_type_id, remaining, updated_at)
     SELECT
       tt.id,
       MAX(tt.quota - (
         SELECT COUNT(*) FROM tickets t WHERE t.ticket_type_id = tt.id
       ), 0),
       ?
     FROM ticket_types tt`
  ).run(new Date().toISOString());
}

initializeInventory();

export function resetDb() {
  db.exec(`
    DELETE FROM reservations;
    DELETE FROM ticket_type_inventory;
    DELETE FROM tickets;
    DELETE FROM ticket_types;
    DELETE FROM events;
  `);
}
