import type { StatsGroupBy } from '@acme/shared';
import type { Request, Response } from 'express';
import {
  analyticsFilterSchema,
  distributionQuerySchema,
  extremesQuerySchema,
  recentChangesQuerySchema,
} from './analytics.schema.js';
import type { AnalyticsService } from './analytics.service.js';

/** HTTP in and out only. */
export function createAnalyticsController(service: AnalyticsService) {
  const grouped = (groupBy: StatsGroupBy) => async (req: Request, res: Response) => {
    res.json(await service.byGroup(groupBy, analyticsFilterSchema.parse(req.query)));
  };

  return {
    summary: async (req: Request, res: Response): Promise<void> => {
      res.json(await service.summary(analyticsFilterSchema.parse(req.query)));
    },
    byCountry: grouped('country'),
    byDepartment: grouped('department'),
    byLevel: grouped('level'),

    distribution: async (req: Request, res: Response): Promise<void> => {
      res.json(await service.distribution(distributionQuerySchema.parse(req.query)));
    },

    extremes: async (req: Request, res: Response): Promise<void> => {
      res.json(await service.extremes(extremesQuerySchema.parse(req.query)));
    },

    recentChanges: async (req: Request, res: Response): Promise<void> => {
      const { limit } = recentChangesQuerySchema.parse(req.query);
      res.json(await service.recentChanges(limit));
    },
  };
}
