import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const bucket = process.env.AWS_BUCKET;
const endpoint = process.env.AWS_ENDPOINT;
const publicUrl = process.env.AWS_URL;
const forcePathStyle = process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true';

console.log('Testing S3 connection with settings:');
console.log(`  AWS_DEFAULT_REGION:          ${region}`);
console.log(`  AWS_BUCKET:                  ${bucket}`);
console.log(`  AWS_ENDPOINT:                ${endpoint}`);
console.log(`  AWS_URL:                     ${publicUrl}`);
console.log(`  AWS_USE_PATH_STYLE_ENDPOINT: ${forcePathStyle}`);
console.log(`  Credentials present:         ${Boolean(accessKeyId && secretAccessKey)}`);
console.log('');

if (!accessKeyId || !secretAccessKey || !bucket) {
  console.error('❌ Missing required AWS S3 credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or AWS_BUCKET).');
  process.exit(1);
}

const client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  forcePathStyle,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

try {
  console.log('1. Checking bucket access (ListObjectsV2 with maxKeys=1)...');
  const listRes = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 1,
    })
  );
  console.log('  ✅ Bucket accessed successfully!');
  console.log(`  Existing key count preview: ${listRes.KeyCount ?? 0}`);

  console.log('\n2. Testing presigned PUT upload URL generation...');
  const testKey = `test/s3-scaffold-${Date.now()}.txt`;
  const putCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: testKey,
    ContentType: 'text/plain',
  });
  const presignedPutUrl = await getSignedUrl(client, putCommand, { expiresIn: 300 });
  console.log('  ✅ Presigned PUT URL generated successfully:');
  console.log(`  ${presignedPutUrl.substring(0, 80)}...`);

  console.log('\n3. Testing presigned GET download/preview URL generation...');
  const getCommand = new GetObjectCommand({
    Bucket: bucket,
    Key: testKey,
  });
  const presignedGetUrl = await getSignedUrl(client, getCommand, { expiresIn: 300 });
  console.log('  ✅ Presigned GET URL generated successfully:');
  console.log(`  ${presignedGetUrl.substring(0, 80)}...`);

  console.log('\n4. Testing direct write, read, and delete of test file...');
  const testContent = `S3 direct scaffold verification at ${new Date().toISOString()}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    })
  );
  console.log('  ✅ PutObject succeeded.');

  const getRes = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: testKey,
    })
  );
  const fetchedBody = await getRes.Body.transformToString();
  console.log(`  ✅ GetObject succeeded! Read: "${fetchedBody}"`);

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: testKey,
    })
  );
  console.log('  ✅ DeleteObject succeeded. Test key cleaned up.');

  console.log('\n🎉 S3 connection & operations verified completely!');
} catch (err) {
  console.error('\n❌ S3 test error:', err.message || err);
  if (err.$metadata) {
    console.error('Metadata:', err.$metadata);
  }
  process.exit(1);
}

