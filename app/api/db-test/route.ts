import { NextResponse } from 'next/server';
import { DB } from '@/lib/db';
import { prisma } from '@/lib/prisma';

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

  const allConnected = mysqlResult.connected && prismaResult.connected;

  return NextResponse.json(
    {
      status: allConnected ? 'success' : 'error',
      mysql: mysqlResult,
      prisma: prismaResult,
    },
    { status: allConnected ? 200 : 500 }
  );
}
