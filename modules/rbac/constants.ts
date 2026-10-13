export const PERMISSIONS = {
  // Board permissions requested
  BOARDS_CREATE: 'boards.create',
  BOARDS_READ: 'boards.read',
  BOARDS_UPDATE: 'boards.update',
  BOARDS_DELETE: 'boards.delete',
  BOARDS_VIEW_ALL: 'boards.view_all',

  // List permissions
  LISTS_CREATE: 'lists.create',
  LISTS_READ: 'lists.read',
  LISTS_UPDATE: 'lists.update',
  LISTS_DELETE: 'lists.delete',

  // Card permissions
  CARDS_CREATE: 'cards.create',
  CARDS_READ: 'cards.read',
  CARDS_UPDATE: 'cards.update',
  CARDS_DELETE: 'cards.delete',

  // Administrative / User management permissions
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const INITIAL_PERMISSIONS: { name: string; description: string }[] = [
  {
    name: PERMISSIONS.BOARDS_CREATE,
    description: 'Create new board records',
  },
  {
    name: PERMISSIONS.BOARDS_READ,
    description: 'View assigned board records',
  },
  {
    name: PERMISSIONS.BOARDS_UPDATE,
    description: 'Edit and update board records',
  },
  {
    name: PERMISSIONS.BOARDS_DELETE,
    description: 'Delete board records',
  },
  {
    name: PERMISSIONS.BOARDS_VIEW_ALL,
    description: 'View all board records across the system',
  },
  {
    name: PERMISSIONS.LISTS_CREATE,
    description: 'Create new lists in boards',
  },
  {
    name: PERMISSIONS.LISTS_READ,
    description: 'View lists in accessible boards',
  },
  {
    name: PERMISSIONS.LISTS_UPDATE,
    description: 'Update list titles and positions',
  },
  {
    name: PERMISSIONS.LISTS_DELETE,
    description: 'Delete lists from boards',
  },
  {
    name: PERMISSIONS.CARDS_CREATE,
    description: 'Create new cards in board lists',
  },
  {
    name: PERMISSIONS.CARDS_READ,
    description: 'View cards in accessible board lists',
  },
  {
    name: PERMISSIONS.CARDS_UPDATE,
    description: 'Update and reorder cards in board lists',
  },
  {
    name: PERMISSIONS.CARDS_DELETE,
    description: 'Delete cards from board lists',
  },
  {
    name: PERMISSIONS.USERS_READ,
    description: 'View users list and profiles',
  },
  {
    name: PERMISSIONS.USERS_MANAGE,
    description: 'Manage users and role assignments',
  },
  {
    name: PERMISSIONS.ROLES_MANAGE,
    description: 'Create and configure roles and permissions',
  },
];

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export const INITIAL_ROLES = [
  {
    name: ROLES.SUPER_ADMIN,
    description: 'Full access to all system boards, users, and administrative functions',
    permissions: Object.values(PERMISSIONS),
  },
  {
    name: ROLES.ADMIN,
    description: 'Administrator with board & list & card CRUD, view all boards, and user management',
    permissions: [
      PERMISSIONS.BOARDS_CREATE,
      PERMISSIONS.BOARDS_READ,
      PERMISSIONS.BOARDS_UPDATE,
      PERMISSIONS.BOARDS_DELETE,
      PERMISSIONS.BOARDS_VIEW_ALL,
      PERMISSIONS.LISTS_CREATE,
      PERMISSIONS.LISTS_READ,
      PERMISSIONS.LISTS_UPDATE,
      PERMISSIONS.LISTS_DELETE,
      PERMISSIONS.CARDS_CREATE,
      PERMISSIONS.CARDS_READ,
      PERMISSIONS.CARDS_UPDATE,
      PERMISSIONS.CARDS_DELETE,
      PERMISSIONS.USERS_READ,
    ],
  },
  {
    name: ROLES.MEMBER,
    description: 'Standard team member with ability to create, read, and edit boards, lists, and cards',
    permissions: [
      PERMISSIONS.BOARDS_CREATE,
      PERMISSIONS.BOARDS_READ,
      PERMISSIONS.BOARDS_UPDATE,
      PERMISSIONS.LISTS_CREATE,
      PERMISSIONS.LISTS_READ,
      PERMISSIONS.LISTS_UPDATE,
      PERMISSIONS.CARDS_CREATE,
      PERMISSIONS.CARDS_READ,
      PERMISSIONS.CARDS_UPDATE,
      PERMISSIONS.CARDS_DELETE,
    ],
  },
  {
    name: ROLES.VIEWER,
    description: 'Read-only access to assigned boards, lists, and cards',
    permissions: [PERMISSIONS.BOARDS_READ, PERMISSIONS.LISTS_READ, PERMISSIONS.CARDS_READ],
  },
];

