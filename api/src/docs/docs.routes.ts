import { Router, type Request } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi.js';
import { toPostmanCollection } from './postman.js';

/** The address the caller used, so the Postman collection points at the server it was downloaded from. */
function apiBaseUrl(req: Request): string {
  const forwarded = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return `${forwarded ?? req.protocol}://${req.get('host') ?? 'localhost'}/api`;
}

/**
 * Documentation for people and tools:
 *   /api/docs                          Swagger page, where each call can be tried
 *   /api/openapi.json                  the description itself (Postman and other tools can import it)
 *   /api/docs/postman-collection.json  a ready-made Postman collection to download
 */
export function createDocsRouter(): Router {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  router.get('/docs/postman-collection.json', (req, res) => {
    res.attachment('acme-salary-management.postman_collection.json');
    res
      .type('application/json')
      .send(JSON.stringify(toPostmanCollection(openApiDocument, apiBaseUrl(req)), null, 2));
  });

  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'ACME Salary Management API',
      swaggerOptions: { tryItOutEnabled: true },
      customCss: '.swagger-ui .topbar { display: none }',
    }),
  );

  return router;
}
