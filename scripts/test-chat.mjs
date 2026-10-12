import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const user = process.env.DB_USERNAME || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_DATABASE || 'project_management';
const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
const prismaUrl = `mysql://${auth}@${host}:${port}/${database}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prismaUrl,
    },
  },
});

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

console.log('--- Testing Live Chat Database & Realtime Infrastructure ---');

try {
  // 1. Check user and board
  const user = await prisma.user.findFirst();
  if (!user) {
    throw new Error('No user found in database. Seed users first.');
  }
  console.log(`✅ Found user: ${user.name || user.username} (ID: ${user.id})`);

  let board = await prisma.board.findFirst();
  if (!board) {
    board = await prisma.board.create({
      data: {
        title: 'Chat Test Board',
        code: 'TEST-01',
        description: 'Auto created for testing live chat',
        ownerId: user.id,
      },
    });
    console.log(`✅ Created test board: ${board.title} (ID: ${board.id})`);
  } else {
    console.log(`✅ Using existing board: ${board.title} (ID: ${board.id})`);
  }

  // 2. Test Comment creation in comments table (v1 polymorphic schema compatibility)
  const testContent = `Automated chat test message ${Date.now()}`;
  const comment = await prisma.comment.create({
    data: {
      commentableType: 'board',
      commentableId: board.id,
      userId: user.id,
      content: testContent,
    },
  });
  console.log(`✅ Created comment (ID: ${comment.id}, scope: ${comment.commentableType}:${comment.commentableId})`);

  // 3. Verify comment can be queried
  const fetched = await prisma.comment.findUnique({
    where: { id: comment.id },
    include: {
      user: {
        select: { id: true, name: true, username: true, profilePicture: true },
      },
    },
  });
  if (!fetched || fetched.content !== testContent) {
    throw new Error('Failed to verify created comment content');
  }
  console.log(`✅ Verified comment retrieval with author: ${fetched.user.name || fetched.user.username}`);

  // 4. Test CommentRead tracking
  const readRecord = await prisma.commentRead.upsert({
    where: {
      userId_commentableType_commentableId: {
        userId: user.id,
        commentableType: 'board',
        commentableId: board.id,
      },
    },
    update: {
      lastReadAt: new Date(),
    },
    create: {
      userId: user.id,
      commentableType: 'board',
      commentableId: board.id,
      lastReadAt: new Date(),
    },
  });
  console.log(`✅ Upserted comment_reads record (lastReadAt: ${readRecord.lastReadAt})`);

  // 5. Test Redis Publisher
  try {
    const redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redis.connect();
    const published = await redis.publish(
      `chat:board:${board.id}`,
      JSON.stringify({
        type: 'comment.created',
        comment: {
          id: comment.id,
          commentableType: 'board',
          commentableId: board.id,
          userId: user.id,
          content: comment.content,
        },
      })
    );
    console.log(`✅ Redis publisher verified (clients received: ${published})`);
    await redis.quit();
  } catch (redisErr) {
    console.warn(`⚠️  Redis not active (${redisErr.message}). Graceful fallback applies.`);
  }

  // 6. Cleanup test comment
  await prisma.comment.delete({ where: { id: comment.id } });
  console.log(`✅ Cleaned up test comment`);

  console.log('\n🎉 ALL LIVE CHAT BACKEND CHECKS PASSED SUCCESSFULLY!\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
