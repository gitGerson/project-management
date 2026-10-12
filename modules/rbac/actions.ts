'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { rbacService } from '@/modules/rbac/services/rbac.service';
import { createRoleSchema, updateRoleSchema, assignUserRolesSchema } from '@/modules/rbac/schemas/rbac.schema';
import type { ActionResponse, RoleDTO, PermissionDTO } from '@/modules/rbac/types';

export async function createRoleAction(data: {
  name: string;
  description?: string;
  permissionIds?: number[];
}): Promise<ActionResponse<RoleDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.ROLES_MANAGE);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to manage roles.' };
  }

  const parsed = createRoleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const role = await rbacService.createRole(parsed.data);
    revalidatePath('/roles');
    return { success: true, message: 'Role created successfully', data: role };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to create role' };
  }
}

export async function updateRoleAction(
  id: number,
  data: {
    name?: string;
    description?: string;
    permissionIds?: number[];
  }
): Promise<ActionResponse<RoleDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.ROLES_MANAGE);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to manage roles.' };
  }

  const parsed = updateRoleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await rbacService.updateRole(id, parsed.data);
    revalidatePath('/roles');
    return { success: true, message: 'Role updated successfully', data: updated };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to update role' };
  }
}

export async function deleteRoleAction(id: number): Promise<ActionResponse> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.ROLES_MANAGE);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to delete roles.' };
  }

  try {
    await rbacService.deleteRole(id);
    revalidatePath('/roles');
    return { success: true, message: 'Role deleted successfully' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to delete role' };
  }
}

export async function assignUserRolesAction(
  userId: number,
  roleIds: number[]
): Promise<ActionResponse<string[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.USERS_MANAGE);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to manage user roles.' };
  }

  const parsed = assignUserRolesSchema.safeParse({ userId, roleIds });
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const newRoles = await rbacService.assignUserRoles(userId, roleIds);
    revalidatePath('/users');
    return { success: true, message: 'User roles assigned successfully', data: newRoles };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to assign roles' };
  }
}

export async function listRolesAction(): Promise<ActionResponse<RoleDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const roles = await rbacService.listRoles();
    return { success: true, data: roles };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to list roles' };
  }
}

export async function listPermissionsAction(): Promise<ActionResponse<PermissionDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const permissions = await rbacService.listPermissions();
    return { success: true, data: permissions };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to list permissions' };
  }
}

