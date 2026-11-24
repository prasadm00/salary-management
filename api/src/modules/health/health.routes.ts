import { Router } from 'express';

export interface HealthDependencies {
  /** Resolves true when the database answers a trivial query. */
  checkDatabase: () => Promise<boolean>;
}

export function createHealthRouter({ checkDatabase }: HealthDependencies): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const databaseUp = await isDatabaseUp(checkDatabase);

    if (!databaseUp) {
      res.status(503).json({ status: 'degraded', database: 'down' });
      return;
    }
    res.json({ status: 'ok', database: 'up', uptimeSeconds: Math.floor(process.uptime()) });
  });

  return router;
}

/** A failing check must never crash the health endpoint, it just reports "down". */
async function isDatabaseUp(checkDatabase: () => Promise<boolean>): Promise<boolean> {
  try {
    return await checkDatabase();
  } catch {
    return false;
  }
}
