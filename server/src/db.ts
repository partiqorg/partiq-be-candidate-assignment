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
`);

export function resetDb() {
  db.exec(`
    DELETE FROM tickets;
    DELETE FROM ticket_types;
    DELETE FROM events;
  `);
}
