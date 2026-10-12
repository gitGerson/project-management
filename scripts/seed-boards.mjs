import { PrismaClient } from '@prisma/client';

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

const DEFAULT_BOARDS = [
  {
    name: 'Tong Tji Go Digital',
    description: 'Digital transformation workspace for Tong Tji team operations and digital initiatives.',
    image: 'gradient:bg-gradient-to-br from-emerald-600 to-teal-800',
  },
  {
    name: 'IT Operational',
    description: 'Day-to-day IT support, infrastructure monitoring, and system maintenance.',
    image: 'gradient:bg-gradient-to-br from-amber-500 to-orange-600',
  },
  {
    name: 'Plan Program It Untuk R...',
    description: 'Long-term IT program planning and roadmap milestones.',
    image: null,
  },
];

async function seedBoards() {
  console.log('Seeding default board records into MySQL...');

  for (const board of DEFAULT_BOARDS) {
    const existing = await prisma.board.findFirst({
      where: { name: board.name },
    });

    if (!existing) {
      const created = await prisma.board.create({
        data: board,
      });
      console.log(` Created board: "${created.name}" (ID: ${created.id})`);
    } else {
      console.log(` Board "${board.name}" already exists (ID: ${existing.id})`);
    }
  }

  console.log('\n Board seeding completed successfully!');
  await prisma.$disconnect();
}

seedBoards().catch((err) => {
  console.error('Board seeding failed:', err);
  process.exit(1);
});

