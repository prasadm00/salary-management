import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { MetaService } from './meta.service.js';

/** This endpoint takes no query parameters, so any that are sent are reported (R-34). */
const noQuerySchema = z.strictObject({});

/** Mounted at /api/meta. */
export function createMetaRouter(service: MetaService): Router {
  const router = Router();

  router.get('/filters', async (req: Request, res: Response) => {
    noQuerySchema.parse(req.query);
    res.json(await service.filters());
  });

  return router;
}
