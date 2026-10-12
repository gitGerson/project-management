export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
  publicUrl?: string;
  forcePathStyle: boolean;
}

export const s3Config: S3Config = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  bucket: process.env.AWS_BUCKET || '',
  endpoint: process.env.AWS_ENDPOINT || undefined,
  publicUrl: process.env.AWS_URL || undefined,
  forcePathStyle: process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true',
};

export default s3Config;

