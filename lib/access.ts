import { rbacRepository } from '@/modules/rbac/repositories/rbac.repository';
import { ROLES } from '@/modules/rbac/constants';

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden: insufficient permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Retrieve all granted permission strings for a user across all assigned roles.
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  const roles = await rbacRepository.getUserRoles(userId);
  // Super admin implicitly holds all permissions
  if (roles.includes(ROLES.SUPER_ADMIN)) {
    const all = await rbacRepository.getAllPermissions();
    return all.map((p) => p.name);
  }

  return rbacRepository.getUserPermissions(userId);
}

/**
 * Retrieve all assigned role names for a user.
 */
export async function getUserRoles(userId: number): Promise<string[]> {
  return rbacRepository.getUserRoles(userId);
}

/**
 * Check if a user possesses a specific permission.
 */
export async function hasPermission(
  userId: number,
  permission: string
): Promise<boolean> {
  const roles = await rbacRepository.getUserRoles(userId);
  if (roles.includes(ROLES.SUPER_ADMIN)) {
    return true;
  }

  const permissions = await rbacRepository.getUserPermissions(userId);
  return permissions.includes(permission);
}

/**
 * Check if a user possesses at least one of the specified permissions.
 */
export async function hasAnyPermission(
  userId: number,
  permissions: string[]
): Promise<boolean> {
  const roles = await rbacRepository.getUserRoles(userId);
  if (roles.includes(ROLES.SUPER_ADMIN)) {
    return true;
  }

  const userPerms = await rbacRepository.getUserPermissions(userId);
  return permissions.some((p) => userPerms.includes(p));
}

/**
 * Check if a user possesses all of the specified permissions.
 */
export async function hasAllPermissions(
  userId: number,
  permissions: string[]
): Promise<boolean> {
  const roles = await rbacRepository.getUserRoles(userId);
  if (roles.includes(ROLES.SUPER_ADMIN)) {
    return true;
  }

  const userPerms = await rbacRepository.getUserPermissions(userId);
  return permissions.every((p) => userPerms.includes(p));
}

/**
 * Check if a user possesses a given role.
 */
export async function hasRole(
  userId: number,
  roleName: string
): Promise<boolean> {
  const roles = await rbacRepository.getUserRoles(userId);
  return roles.includes(roleName);
}

/**
 * Guard assertion: throws ForbiddenError if user lacks permission.
 */
export async function requirePermission(
  userId: number,
  permission: string
): Promise<void> {
  const granted = await hasPermission(userId, permission);
  if (!granted) {
    throw new ForbiddenError(`User lacks required permission: "${permission}"`);
  }
}

