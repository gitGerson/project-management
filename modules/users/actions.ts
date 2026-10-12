'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { userManagementService } from '@/modules/users/services/user-management.service';
import { userFilterSchema, updateManagedUserSchema } from '@/modules/users/schemas/user.schema';
import type {
  ActionResponse,
  PaginatedResult,
  UserListItemDTO,
  UserDetailDTO,
  UserFilterInput,
} from '@/modules/users/types';

export async function listUsersAction(
  filter: UserFilterInput
): Promise<ActionResponse<PaginatedResult<UserListItemDTO>>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.USERS_READ);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to view users.' };
  }

  const parsed = userFilterSchema.safeParse(filter);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await userManagementService.listUsers(parsed.data);
    return { success: true, data: result };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to list users' };
  }
}

export async function getUserDetailAction(id: number): Promise<ActionResponse<UserDetailDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.USERS_READ);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to view user details.' };
  }

  try {
    const user = await userManagementService.getUserById(id);
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return { success: true, data: user };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to get user' };
  }
}

export async function updateManagedUserAction(
  id: number,
  data: { name?: string; phone?: string | null; roleIds?: number[] }
): Promise<ActionResponse<UserListItemDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.USERS_MANAGE);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to manage users.' };
  }

  const parsed = updateManagedUserSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await userManagementService.updateUser(id, parsed.data);
    revalidatePath('/users');
    return { success: true, message: 'User updated successfully', data: updated };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to update user' };
  }
}

