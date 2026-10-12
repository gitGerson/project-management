import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createPresignedDownloadUrl, getPublicUrl } from '@/lib/s3';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const download = searchParams.get('download') === 'true';
    const filename = searchParams.get('filename') || undefined;

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Missing required "key" query parameter' },
        { status: 400 }
      );
    }

    // Generate time-limited presigned GET URL
    const presignedUrl = await createPresignedDownloadUrl({
      key,
      expiresIn: 3600, // 1 hour preview/download link
      downloadFilename: download ? filename : undefined,
    });

    const publicUrl = getPublicUrl(key);

    return NextResponse.json({
      success: true,
      data: {
        key,
        presignedUrl,
        publicUrl,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate preview URL';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

