import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { join } from 'node:path';
import { createDocsRouter } from './docs/docs.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { createCompensationRouter } from './modules/compensation/compensation.routes.js';
import type { CompensationService } from './modules/compensation/compensation.service.js';
import { createEmployeeRouter } from './modules/employees/employee.routes.js';
import type { EmployeeService } from './modules/employees/employee.service.js';
import type { EmployeeQueryService } from './modules/employees/employeeQuery.service.js';
import { createAnalyticsRouter } from './modules/analytics/analytics.routes.js';
import type { AnalyticsService } from './modules/analytics/analytics.service.js';
import { createMetaRouter } from './modules/meta/meta.routes.js';
import type { MetaService } from './modules/meta/meta.service.js';
import { createHealthRouter, type HealthDependencies } from './modules/health/health.routes.js';

/** Everything the app needs from the outside world. Tests pass fakes. */
export interface AppDependencies extends HealthDependencies {
  /** Browser origin allowed to call the API. Leave out when the API serves the UI itself. */
  corsOrigin?: string | undefined;
  employeeService: EmployeeService;
  compensationService: CompensationService;
  employeeQueryService: EmployeeQueryService;
  metaService: MetaService;
  analyticsService: AnalyticsService;
  /** Folder with the built web app. When set, the API serves the UI too, so one address does both. */
  webDir?: string | undefined;
}

/** Serves the built web app: its files, and index.html for any page address the React app handles itself. */
function serveWebApp(app: Express, webDir: string): void {
  app.use(express.static(webDir));
  app.use((req, res, next) => {
    // Unknown /api paths must still get the JSON "not found" answer, not the web page.
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(join(webDir, 'index.html'), (error) => {
      if (error) next();
    });
  });
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

  app.use('/api', createDocsRouter());
  app.use('/api/health', createHealthRouter(dependencies));
  app.use(
    '/api/employees',
    createEmployeeRouter(dependencies.employeeService, dependencies.employeeQueryService),
  );
  app.use('/api/employees', createCompensationRouter(dependencies.compensationService));
  app.use('/api/meta', createMetaRouter(dependencies.metaService));
  app.use('/api/analytics', createAnalyticsRouter(dependencies.analyticsService));

  if (dependencies.webDir) {
    serveWebApp(app, dependencies.webDir);
  }

  // Order matters: unknown routes next, and the error handler must be last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
