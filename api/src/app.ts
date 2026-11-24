import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { createHealthRouter, type HealthDependencies } from './modules/health/health.routes.js';

/** Everything the app needs from the outside world. Tests pass fakes. */
export interface AppDependencies extends HealthDependencies {
  /** Browser origin allowed to call the API. Leave out when the API serves the UI itself. */
  corsOrigin?: string | undefined;
}

/**
 * Builds the Express app without starting a server, so tests can call it directly.
 * `server.ts` is the only place that listens on a port.
 */
export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  if (dependencies.corsOrigin) {
    app.use(cors({ origin: dependencies.corsOrigin }));
  }
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter(dependencies));

  // Order matters: unknown routes next, and the error handler must be last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
