import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

// Replicate scrypt hash logic
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function escapeLdapFilter(input) {
  return input.replace(/[\0\(\)\*\\]/g, (char) => {
    switch (char) {
      case '\0': return '\\00';
      case '(': return '\\28';
      case ')': return '\\29';
      case '*': return '\\2a';
      case '\\': return '\\5c';
      default: return char;
    }
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

console.log('Testing LDAP filter escaping and database synchronization logic...\n');

try {
  // Test 1: LDAP filter escaping
  console.log('1. Testing RFC 4515 LDAP filter escaping...');
  const unsafeInput = 'admin*(|(password=*))\\test\0';
  const escaped = escapeLdapFilter(unsafeInput);
  if (escaped.includes('*') || escaped.includes('(') || escaped.includes(')')) {
    throw new Error('LDAP filter escaping failed!');
  }
  console.log(`   Input:   ${unsafeInput}`);
  console.log(`   Escaped: ${escaped}`);
  console.log('   ✅ LDAP filter injection prevention verified!\n');

  // Test 2: Simulating LDAP User Sync (First-time login)
  const timestamp = Date.now();
  const mockLdapUser = {
    username: `ldap_user_${timestamp}`,
    name: 'Tong Tji Test User',
    email: `ldap_${timestamp}@tongtji.com`,
    phone: '+62 812 3456 7890',
    guid: `guid-${timestamp}`,
    domain: 'default',
  };
  const testPassword = 'LdapSecurePassword123!';
  const hashedPassword = await hashPassword(testPassword);

  console.log(`2. Testing first-time LDAP user sync for "${mockLdapUser.username}"...`);
  const createdUser = await prisma.user.create({
    data: {
      username: mockLdapUser.username,
      password: hashedPassword,
      name: mockLdapUser.name,
      email: mockLdapUser.email,
      phone: mockLdapUser.phone,
      guid: mockLdapUser.guid,
      domain: mockLdapUser.domain,
    },
  });

  console.log(`   ✅ User created in DB with ID: ${createdUser.id}`);
  console.log(`   GUID:   ${createdUser.guid}`);
  console.log(`   Domain: ${createdUser.domain}`);
  console.log(`   Name:   ${createdUser.name}`);
  console.log(`   Email:  ${createdUser.email}`);

  // Test 3: Simulating subsequent LDAP login (Existing user sync)
  console.log('\n3. Testing subsequent LDAP login (updating existing record)...');
  const updatedName = 'Tong Tji Test User (Updated)';
  const updatedUser = await prisma.user.update({
    where: { id: createdUser.id },
    data: {
      name: updatedName,
      password: hashedPassword,
    },
  });

  if (updatedUser.name !== updatedName) {
    throw new Error('User update sync failed!');
  }
  console.log(`   ✅ Existing user profile and password synchronized successfully!`);

  // Test 4: Cleanup test record
  console.log('\n4. Cleaning up test user record...');
  await prisma.user.delete({ where: { id: createdUser.id } });
  console.log('   ✅ Test user successfully removed.');

  console.log('\n🎉 LDAP auth synchronization tests completed successfully!');
  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
}

