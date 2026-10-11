import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

// Replicate scrypt hash / verify logic to test outside of next/headers
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function verifyPassword(password, hash) {
  const [salt, key] = hash.split(':');
  if (!salt || !key) return false;
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      const keyBuffer = Buffer.from(key, 'hex');
      const match = crypto.timingSafeEqual(keyBuffer, derivedKey);
      resolve(match);
    });
  });
}

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const user = process.env.DB_USERNAME || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_DATABASE || 'project_management';
const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
const prismaUrl = `mysql://${auth}@${host}:${port}/${database}`;

const prisma = new PrismaClient({
  datasources: { db: { url: prismaUrl } },
});

console.log('Testing Auth module end-to-end...\n');

try {
  const testUsername = `testuser_${Date.now()}`;
  const testEmail = `${testUsername}@example.com`;
  const rawPassword = 'SecretPassword123!';
  const hashedPassword = await hashPassword(rawPassword);

  // 1. Create user
  console.log(`1. Registering user "${testUsername}"...`);
  const createdUser = await prisma.user.create({
    data: {
      username: testUsername,
      password: hashedPassword,
      name: 'John Doe',
      email: testEmail,
      phone: '+1 555-0199',
    },
  });
  console.log(`   ✅ User created with ID: ${createdUser.id}`);
  console.log(`   Username: ${createdUser.username}`);
  console.log(`   Name:     ${createdUser.name}`);
  console.log(`   Email:    ${createdUser.email}`);
  console.log(`   Phone:    ${createdUser.phone}`);

  // 2. Test valid login
  console.log('\n2. Testing authentication with correct password...');
  const foundUser = await prisma.user.findUnique({
    where: { username: testUsername },
  });
  const isMatch = await verifyPassword(rawPassword, foundUser.password);
  if (!isMatch) throw new Error('Password verification failed for valid password!');
  console.log('   ✅ Valid password successfully verified!');

  // 3. Test invalid login
  console.log('\n3. Testing authentication with wrong password...');
  const isWrongMatch = await verifyPassword('WrongPassword!', foundUser.password);
  if (isWrongMatch) throw new Error('Wrong password was accepted!');
  console.log('   ✅ Wrong password correctly rejected!');

  // 4. Cleanup test user
  console.log('\n4. Cleaning up test user...');
  await prisma.user.delete({ where: { id: createdUser.id } });
  console.log('   ✅ Test user cleaned up.');

  console.log('\n🎉 Auth module verification completed successfully!');
  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Auth test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
}

