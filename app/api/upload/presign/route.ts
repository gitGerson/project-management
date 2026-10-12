import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { createPresignedUploadUrl } from '@/lib/s3';

// 50MB default limit for direct S3 uploads
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const presignSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255),
  contentType: z.string().min(1, 'Content type is required'),
  fileSize: z
    .number()
    .positive('File size must be positive')
    .max(MAX_FILE_SIZE, 'File size exceeds maximum limit of 50MB')
    .optional(),
  folder: z
    .string()
    .regex(/^[a-zA-Z0-9_\-\/]+$/, 'Folder path contains invalid characters')
    .optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const json = await request.json().catch(() => null);
    const parsed = presignSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { fileName, contentType, folder = 'uploads' } = parsed.data;

    // Namespace user uploads by user ID for isolation
    const prefix = `${folder}/${session.userId}`;

    const presigned = await createPresignedUploadUrl({
      prefix,
      fileName,
      contentType,
      expiresIn: 900, // 15 minutes is ample time for direct browser upload
      metadata: {
        userId: session.userId.toString(),
        username: session.username,
        uploadedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: presigned,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

