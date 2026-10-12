import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';
import { s3Config } from '@/config/s3';

// Maintain a single client instance per Node.js process
let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    if (!s3Config.accessKeyId || !s3Config.secretAccessKey || !s3Config.bucket) {
      throw new Error(
        'AWS S3 configuration missing. Please verify AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_BUCKET in your environment variables.'
      );
    }

    s3ClientInstance = new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint,
      forcePathStyle: s3Config.forcePathStyle,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });
  }

  return s3ClientInstance;
}

/**
 * Resolve direct URL for a given S3 key.
 */
export function getPublicUrl(key: string): string {
  const cleanKey = key.replace(/^\/+/, '');
  if (s3Config.publicUrl) {
    return `${s3Config.publicUrl.replace(/\/+$/, '')}/${cleanKey}`;
  }

  if (s3Config.endpoint) {
    const cleanEndpoint = s3Config.endpoint.replace(/\/+$/, '');
    if (s3Config.forcePathStyle) {
      return `${cleanEndpoint}/${s3Config.bucket}/${cleanKey}`;
    }
    return `${cleanEndpoint.replace('://', `://${s3Config.bucket}.`)}/${cleanKey}`;
  }

  return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${cleanKey}`;
}

export interface PresignedUploadOptions {
  key?: string;
  prefix?: string;
  fileName: string;
  contentType: string;
  expiresIn?: number; // In seconds, default 1 hour
  metadata?: Record<string, string>;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

/**
 * Generate a presigned PUT URL for direct browser-to-S3 upload.
 * This completely avoids buffering large files through the Next.js server.
 */
export async function createPresignedUploadUrl(
  options: PresignedUploadOptions
): Promise<PresignedUploadResult> {
  const client = getS3Client();
  const expiresIn = options.expiresIn ?? 3600;

  const key =
    options.key ||
    generateS3Key(options.prefix || 'uploads', options.fileName);

  const command = new PutObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
    ContentType: options.contentType,
    Metadata: options.metadata,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  const publicUrl = getPublicUrl(key);

  return {
    uploadUrl,
    key,
    publicUrl,
    expiresIn,
  };
}

export interface PresignedDownloadOptions {
  key: string;
  expiresIn?: number; // In seconds, default 1 hour
  downloadFilename?: string;
}

/**
 * Generate a presigned GET URL for temporary preview or download of private S3 objects.
 */
export async function createPresignedDownloadUrl(
  options: PresignedDownloadOptions
): Promise<string> {
  const client = getS3Client();
  const expiresIn = options.expiresIn ?? 3600;

  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: options.key,
    ResponseContentDisposition: options.downloadFilename
      ? `attachment; filename="${encodeURIComponent(options.downloadFilename)}"`
      : undefined,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete an object from S3.
 */
export async function deleteS3Object(key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
    })
  );
}

/**
 * Check if an object exists in S3.
 */
export async function checkS3ObjectExists(key: string): Promise<boolean> {
  const client = getS3Client();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      })
    );
    return true;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err.name === 'NotFound' || (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
    ) {
      return false;
    }
    throw err;
  }
}

/**
 * Helper to generate sanitized, collision-resistant S3 storage keys.
 */
export function generateS3Key(prefix: string, fileName: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueId = crypto.randomUUID().slice(0, 8);
  const timestamp = Date.now();

  return `${cleanPrefix}/${timestamp}_${uniqueId}_${cleanName}`;
}

