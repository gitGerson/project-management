import { PrismaClient } from '@prisma/client';
import { buildDatabaseUrl } from '@/config/database';

// Global singleton declaration to preserve PrismaClient instance across Fast Refresh in Next.js development
declare global {
  var __prismaClient: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prismaClient ||
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

