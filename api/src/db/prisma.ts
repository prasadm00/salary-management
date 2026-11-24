import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export type { PrismaClient };

/** Creates a Prisma client that talks to PostgreSQL through the `pg` driver. */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** True when the database answers a trivial query. Used by the health endpoint. */
export async function checkDatabase(prisma: PrismaClient): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
