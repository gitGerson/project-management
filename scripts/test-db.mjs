import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const user = process.env.DB_USERNAME || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_DATABASE || 'project_management';

const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
const prismaUrl = `mysql://${auth}@${host}:${port}/${database}`;

console.log('Testing MySQL and Prisma connection with Laravel env settings:');
console.log(`  DB_CONNECTION: ${process.env.DB_CONNECTION || 'mysql'}`);
console.log(`  DB_HOST:       ${host}`);
console.log(`  DB_PORT:       ${port}`);
console.log(`  DB_USERNAME:   ${user}`);
console.log(`  DB_DATABASE:   ${database}`);
console.log('');

try {
  // 1. Raw MySQL connection test
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  console.log('✅ Successfully connected to MySQL server via mysql2!');

  const [versionRows] = await connection.query('SELECT VERSION() AS version');
  console.log(`  Server Version: ${versionRows[0].version}`);

  const [dbRows] = await connection.query('SHOW DATABASES LIKE ?', [database]);

  if (dbRows.length > 0) {
    console.log(`✅ Database "${database}" exists.`);
  } else {
    console.log(`⚠️  Database "${database}" does not exist yet.`);
  }

  await connection.end();

  // 2. Prisma ORM test
  console.log('\nTesting Prisma ORM connection...');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: prismaUrl,
      },
    },
  });

  const count = await prisma.user.count();
  console.log(`✅ Successfully connected via Prisma ORM!`);
  console.log(`  User table record count: ${count}`);

  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Connection failed:');
  console.error(`   ${error.message}`);
  if (error.code) {
    console.error(`   Error code: ${error.code}`);
  }
  process.exit(1);
}
