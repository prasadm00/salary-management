import { config as loadDotenv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// The single .env file lives at the repository root.
loadDotenv({ path: '../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
