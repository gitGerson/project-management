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

const PERMISSIONS = [
  // Board permissions
  { name: 'boards.create', description: 'Create new board records' },
  { name: 'boards.read', description: 'View assigned board records' },
  { name: 'boards.update', description: 'Edit and update board records' },
  { name: 'boards.delete', description: 'Delete board records' },
  { name: 'boards.view_all', description: 'View all board records across the system' },

  // List permissions
  { name: 'lists.create', description: 'Create new lists in boards' },
  { name: 'lists.read', description: 'View lists in accessible boards' },
  { name: 'lists.update', description: 'Update list titles and positions' },
  { name: 'lists.delete', description: 'Delete lists from boards' },

  // Management permissions
  { name: 'users.read', description: 'View users list and profiles' },
  { name: 'users.manage', description: 'Manage users and role assignments' },
  { name: 'roles.manage', description: 'Configure roles and permissions' },
];

const ROLES = [
  {
    name: 'super_admin',
    description: 'Full system administrator with unrestricted access',
    permissions: PERMISSIONS.map((p) => p.name),
  },
  {
    name: 'admin',
    description: 'Board administrator with full board & list CRUD, view all, and user viewing',
    permissions: [
      'boards.create',
      'boards.read',
      'boards.update',
      'boards.delete',
      'boards.view_all',
      'lists.create',
      'lists.read',
      'lists.update',
      'lists.delete',
      'users.read',
    ],
  },
  {
    name: 'member',
    description: 'Standard member with ability to create, read, and edit boards and lists',
    permissions: [
      'boards.create',
      'boards.read',
      'boards.update',
      'lists.create',
      'lists.read',
      'lists.update',
    ],
  },
  {
    name: 'viewer',
    description: 'Read-only access to boards and lists',
    permissions: ['boards.read', 'lists.read'],
  },
];

async function seed() {
  console.log('Seeding RBAC permissions and default roles...');

  // 1. Seed Permissions
  console.log(`1. Upserting ${PERMISSIONS.length} permissions...`);
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: {
        name: perm.name,
        description: perm.description,
      },
    });
    console.log(`   - ${perm.name}`);
  }

  // 2. Fetch created permissions map
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map(allPerms.map((p) => [p.name, p.id]));

  // 3. Seed Roles & RolePermissions
  console.log(`\n2. Upserting ${ROLES.length} roles and role permissions...`);
  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: {
        name: roleDef.name,
        description: roleDef.description,
      },
    });

    const targetPermissionIds = roleDef.permissions
      .map((pName) => permMap.get(pName))
      .filter((id) => typeof id === 'number');

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    if (targetPermissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: targetPermissionIds.map((pId) => ({
          roleId: role.id,
          permissionId: pId,
        })),
      });
    }

    console.log(`   - Role "${role.name}" (${targetPermissionIds.length} permissions)`);
  }

  // 4. Assign super_admin role to initial users (including 'admin')
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'super_admin' } });
  if (superAdminRole) {
    const initialUsers = await prisma.user.findMany({
      where: {
        OR: [
          { id: 1 },
          { username: 'admin' },
          { username: 'gerson' },
        ],
      },
    });

    for (const u of initialUsers) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: u.id,
            roleId: superAdminRole.id,
          },
        },
        update: {},
        create: {
          userId: u.id,
          roleId: superAdminRole.id,
        },
      });
      console.log(`   - Assigned "super_admin" to user #${u.id} (${u.username})`);
    }
  }

  console.log('\n✅ RBAC seeder completed successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

