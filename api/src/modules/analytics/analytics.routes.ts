import { Router } from 'express';
import { createAnalyticsController } from './analytics.controller.js';
import type { AnalyticsService } from './analytics.service.js';

/** Mounted at /api/analytics. All routes only read. */
export function createAnalyticsRouter(service: AnalyticsService): Router {
  const router = Router();
  const controller = createAnalyticsController(service);

  router.get('/summary', controller.summary);
  router.get('/by-country', controller.byCountry);
  router.get('/by-department', controller.byDepartment);
  router.get('/by-level', controller.byLevel);
  router.get('/distribution', controller.distribution);
  router.get('/extremes', controller.extremes);
  router.get('/recent-changes', controller.recentChanges);

  return router;
}
