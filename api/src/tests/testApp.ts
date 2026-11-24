import type { Express } from 'express';
import { createApp } from '../app.js';
import { createServices } from '../composition.js';
import type { Clock } from '../domain/clock.js';
import { checkDatabase, type PrismaClient } from '../db/prisma.js';
import { fixedClock } from './fixedClock.js';
import { createTestPrisma, resetDatabase } from './testDatabase.js';

export interface TestContext {
  prisma: PrismaClient;
  app: Express;
  clock: Clock;
}

/**
 * Builds the whole app on the real test database with a fixed clock.
 * Call `await context.reset()` in `beforeEach` and `await context.close()` in `afterAll`.
 */
export function createTestContext(clock: Clock = fixedClock()): TestContext & {
  reset: () => Promise<void>;
  close: () => Promise<void>;
} {
  const prisma = createTestPrisma();
  const app = createApp({
    checkDatabase: () => checkDatabase(prisma),
    ...createServices(prisma, clock),
  });

  return {
    prisma,
    app,
    clock,
    reset: () => resetDatabase(prisma),
    close: () => prisma.$disconnect(),
  };
}
