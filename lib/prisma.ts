import { PrismaClient } from '@prisma/client';
import { buildDatabaseUrl } from '@/config/database';

// Global singleton declaration to preserve PrismaClient instance across Fast Refresh in Next.js development
declare global {
  var __prismaClient: PrismaClient | undefined;
}

// Invalidate stale in-memory client if schema has evolved during dev (e.g. missing newly added models)
const existingClient = global.__prismaClient;
const isValidClient =
  existingClient?.user &&
  existingClient.board &&
  existingClient.role &&
  existingClient.permission &&
  existingClient.userRole &&
  existingClient.rolePermission;

export const prisma: PrismaClient =
  (isValidClient ? existingClient : undefined) ||
  new PrismaClient({
    datasources: {
      db: {
        url: buildDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prismaClient = prisma;
}

export default prisma;

