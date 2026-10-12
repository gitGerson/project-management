import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getS3Client, getPublicUrl, generateS3Key } from '@/lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Config } from '@/config/s3';

// 10MB maximum file size as requested
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran file melebihi batas maksimal 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const isImage =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name);

    // Organize prefix by type and user for cleanliness
    const folder = isImage ? 'boards/editor-images' : 'boards/editor-files';
    const key = generateS3Key(`${folder}/${session.userId}`, file.name);

    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
        Metadata: {
          userId: session.userId.toString(),
          uploadedAt: new Date().toISOString(),
          originalName: encodeURIComponent(file.name),
        },
      })
    );

    const publicUrl = getPublicUrl(key);

    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        key,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        isImage,
      },
    });
  } catch (error: unknown) {
    console.error('Chat upload error:', error);
    const message = error instanceof Error ? error.message : 'Gagal mengunggah file';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

