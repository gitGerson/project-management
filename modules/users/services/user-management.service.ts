import { userManagementRepository } from '@/modules/users/repositories/user-management.repository';
import type {
  UserFilterInput,
  PaginatedResult,
  UserListItemDTO,
  UserDetailDTO,
} from '@/modules/users/types';

export const userManagementService = {
  /**
   * List users with pagination and search.
   */
  async listUsers(filter: UserFilterInput): Promise<PaginatedResult<UserListItemDTO>> {
    const res = await userManagementRepository.listUsers(filter);

    const items: UserListItemDTO[] = res.users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      phone: u.phone,
      profilePicture: u.profilePicture,
      domain: u.domain,
      roles: u.userRoles.map((ur) => ur.role.name),
      createdAt: u.createdAt,
    }));

    return {
      data: items,
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    };
  },

  /**
   * Get comprehensive user details with assigned roles and resolved permissions.
   */
  async getUserById(id: number): Promise<UserDetailDTO | null> {
    const user = await userManagementRepository.getUserDetail(id);
    if (!user) return null;

    const roles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
    }));

    const permissionSet = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.name);
      }
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture,
      domain: user.domain,
      roles,
      permissions: Array.from(permissionSet),
      createdAt: user.createdAt,
    };
  },

  /**
   * Update user details and roles.
   */
  async updateUser(
    id: number,
    data: { name?: string; phone?: string | null; roleIds?: number[] }
  ): Promise<UserListItemDTO> {
    const updated = await userManagementRepository.updateUserWithRoles(id, data);
    if (!updated) {
      throw new Error('User not found');
    }

    return {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      profilePicture: updated.profilePicture,
      domain: updated.domain,
      roles: updated.userRoles.map((ur) => ur.role.name),
      createdAt: updated.createdAt,
    };
  },
};

