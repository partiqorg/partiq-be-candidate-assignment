import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { seedIfEmpty } from './seed.js';
import { attachWebSocket } from './ws.js';
import { eventsRouter } from './routes/events.js';
import { paymentsRouter } from './routes/payments.js';
import { ticketsRouter } from './routes/tickets.js';
import { meRouter } from './routes/me.js';

export function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use(eventsRouter);
  app.use(paymentsRouter);
  app.use(ticketsRouter);
  app.use(meRouter);

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedIfEmpty();

  const app = buildApp();
  const server = createServer(app);
  attachWebSocket(server);

  const PORT = Number(process.env.PORT ?? 3001);
  server.listen(PORT, () => {
    console.log(`partiq API ready  http://localhost:${PORT}`);
    console.log(`WebSocket         ws://localhost:${PORT}`);
  });
}
