import mysql from 'mysql2/promise';

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const user = process.env.DB_USERNAME || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_DATABASE || 'project_management';

console.log('Testing MySQL connection with settings:');
console.log(`  Host:     ${host}`);
console.log(`  Port:     ${port}`);
console.log(`  User:     ${user}`);
console.log(`  Database: ${database}`);
console.log('');

try {
  // First test connection without database in case database has not been created yet
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  console.log('✅ Successfully connected to MySQL server!');

  const [versionRows] = await connection.query('SELECT VERSION() AS version');
  console.log(`  Server Version: ${versionRows[0].version}`);

  // Check if database exists
  const [dbRows] = await connection.query(
    'SHOW DATABASES LIKE ?',
    [database]
  );

  if (dbRows.length > 0) {
    console.log(`✅ Database "${database}" exists.`);
  } else {
    console.log(`⚠️  Database "${database}" does not exist yet.`);
    console.log(`   You can create it by running: CREATE DATABASE \`${database}\`;`);
  }

  await connection.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Connection failed:');
  console.error(`   ${error.message}`);
  if (error.code) {
    console.error(`   Error code: ${error.code}`);
  }
  process.exit(1);
}

