import { NextResponse } from 'next/server';
import { DB } from '@/lib/db';

export async function GET() {
  const result = await DB.testConnection();

  if (!result.connected) {
    return NextResponse.json(
      {
        status: 'error',
        ...result,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: 'success',
    ...result,
  });
}

