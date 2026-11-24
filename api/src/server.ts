import { createApp } from './app.js';
import { createServices } from './composition.js';
import { loadEnv } from './config/env.js';
import { checkDatabase, createPrismaClient } from './db/prisma.js';
import { systemClock } from './domain/clock.js';

/** The only file that opens a port. Everything else is built to be tested without one. */
function main(): void {
  const env = loadEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);

  const app = createApp({
    checkDatabase: () => checkDatabase(prisma),
    corsOrigin: env.CORS_ORIGIN,
    ...createServices(prisma, systemClock),
  });

  const server = app.listen(env.PORT, () => {
    console.warn(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string): void => {
    console.warn(`${signal} received, shutting down`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
