import { NextResponse } from 'next/server';
import { DB } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { testRedisConnection } from '@/lib/redis';

export async function GET() {
  const mysqlResult = await DB.testConnection();

  let prismaResult: { connected: boolean; message: string; userCount?: number } = {
    connected: false,
    message: 'Not tested',
  };

  try {
    const userCount = await prisma.user.count();
    prismaResult = {
      connected: true,
      message: 'Prisma connected to MySQL successfully!',
      userCount,
    };
  } catch (error: unknown) {
    const err = error as Error;
    prismaResult = {
      connected: false,
      message: `Prisma connection failed: ${err.message}`,
    };
  }

  const redisResult = await testRedisConnection();

  const allConnected = mysqlResult.connected && prismaResult.connected && redisResult.connected;

  return NextResponse.json(
    {
      status: allConnected ? 'success' : 'partial_failure',
      mysql: mysqlResult,
      prisma: prismaResult,
      redis: redisResult,
    },
    { status: allConnected ? 200 : 500 }
  );
}
