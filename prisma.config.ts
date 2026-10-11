import fs from 'node:fs';
import { defineConfig } from '@prisma/config';

// Load Laravel env variables from .env.local or .env
if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
} else if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

const host = process.env.DB_HOST || '127.0.0.1';
const port = process.env.DB_PORT || '3306';
const user = encodeURIComponent(process.env.DB_USERNAME || 'root');
const password = process.env.DB_PASSWORD ? `:${encodeURIComponent(process.env.DB_PASSWORD)}` : '';
const database = process.env.DB_DATABASE || 'project_management';

// Construct standard MySQL URL dynamically from Laravel DB_* configuration
const url = `mysql://${user}${password}@${host}:${port}/${database}`;
process.env.DATABASE_URL = url;

export default defineConfig({
  schema: './prisma/schema.prisma',
  engine: 'classic',
  datasource: {
    url,
  },
});
