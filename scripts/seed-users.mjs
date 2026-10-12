import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT || '3306';
const user = encodeURIComponent(process.env.DB_USERNAME || 'root');
const password = process.env.DB_PASSWORD ? `:${encodeURIComponent(process.env.DB_PASSWORD)}` : '';
const database = process.env.DB_DATABASE || 'project_management';
const url = `mysql://${user}${password}@${host}:${port}/${database}`;

const prisma = new PrismaClient({
  datasources: {
    db: { url },
  },
});

async function hashPassword(passwordStr) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(passwordStr, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

const SEED_USERS = [
  {
    username: 'superadmin',
    name: 'Super Admin User',
    email: 'superadmin@example.com',
    password: 'password123',
    role: 'super_admin',
    phone: '+62 812 0000 0001',
  },
  {
    username: 'viewer',
    name: 'Viewer User',
    email: 'viewer@example.com',
    password: 'password123',
    role: 'viewer',
    phone: '+62 812 0000 0002',
  },
];

async function seedUsers() {
  console.log('Seeding local users with roles (super_admin, viewer)...\n');

  // Verify roles exist
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.name, r.id]));

  for (const userData of SEED_USERS) {
    const roleId = roleMap.get(userData.role);
    if (!roleId) {
      console.error(`⚠️ Role "${userData.role}" not found in database. Run npm run rbac:seed first.`);
      continue;
    }

    const hashedPassword = await hashPassword(userData.password);

    // Upsert User
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: userData.username }, { email: userData.email }],
      },
    });

    let userId;
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          username: userData.username,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          password: hashedPassword,
        },
      });
      userId = updated.id;
      console.log(`Updated user "${userData.username}" (ID: ${userId})`);
    } else {
      const created = await prisma.user.create({
        data: {
          username: userData.username,
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          password: hashedPassword,
        },
      });
      userId = created.id;
      console.log(`Created user "${userData.username}" (ID: ${userId})`);
    }

    // Assign Role
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      update: {},
      create: {
        userId,
        roleId,
      },
    });

    console.log(`   Assigned role "${userData.role}" to user "${userData.username}"`);
  }

  console.log('\nSeeding completed successfully!');
  console.log('--------------------------------------------------');
  console.log('Default credentials:');
  for (const u of SEED_USERS) {
    console.log(`Username: ${u.username.padEnd(12)} Password: ${u.password.padEnd(12)} Role: ${u.role}`);
  }
  console.log('--------------------------------------------------');
}

seedUsers()
  .catch((err) => {
    console.error('❌ User seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

