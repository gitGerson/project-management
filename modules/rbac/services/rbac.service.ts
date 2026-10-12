import { rbacRepository } from '@/modules/rbac/repositories/rbac.repository';
import { prisma } from '@/lib/prisma';
import { INITIAL_PERMISSIONS, INITIAL_ROLES } from '@/modules/rbac/constants';
import type { RoleDTO, PermissionDTO, CreateRoleInput, UpdateRoleInput } from '@/modules/rbac/types';

export const rbacService = {
  /**
   * List all system permissions.
   */
  async listPermissions(): Promise<PermissionDTO[]> {
    const permissions = await rbacRepository.getAllPermissions();
    return permissions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
    }));
  },

  /**
   * List all roles with their assigned permissions.
   */
  async listRoles(): Promise<RoleDTO[]> {
    const roles = await rbacRepository.getAllRoles();
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.createdAt,
      permissions: r.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        description: rp.permission.description,
        createdAt: rp.permission.createdAt,
      })),
    }));
  },

  /**
   * Get role details by ID.
   */
  async getRoleById(id: number): Promise<RoleDTO | null> {
    const role = await rbacRepository.findRoleById(id);
    if (!role) return null;

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        description: rp.permission.description,
        createdAt: rp.permission.createdAt,
      })),
    };
  },

  /**
   * Create a new custom role.
   */
  async createRole(input: CreateRoleInput): Promise<RoleDTO> {
    const existing = await rbacRepository.findRoleByName(input.name);
    if (existing) {
      throw new Error(`Role with name "${input.name}" already exists`);
    }

    const created = await rbacRepository.createRole({
      name: input.name,
      description: input.description,
      permissionIds: input.permissionIds,
    });

    const fullRole = await rbacRepository.findRoleById(created.id);
    if (!fullRole) throw new Error('Role creation failed');

    return {
      id: fullRole.id,
      name: fullRole.name,
      description: fullRole.description,
      createdAt: fullRole.createdAt,
      permissions: fullRole.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        description: rp.permission.description,
        createdAt: rp.permission.createdAt,
      })),
    };
  },

  /**
   * Update existing role.
   */
  async updateRole(id: number, input: UpdateRoleInput): Promise<RoleDTO> {
    const existing = await rbacRepository.findRoleById(id);
    if (!existing) {
      throw new Error('Role not found');
    }

    if (input.name && input.name !== existing.name) {
      const nameConflict = await rbacRepository.findRoleByName(input.name);
      if (nameConflict) {
        throw new Error(`Role name "${input.name}" is already taken`);
      }
    }

    await rbacRepository.updateRole(id, {
      name: input.name,
      description: input.description,
      permissionIds: input.permissionIds,
    });

    const updated = await rbacRepository.findRoleById(id);
    if (!updated) throw new Error('Failed to retrieve updated role');

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      createdAt: updated.createdAt,
      permissions: updated.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        description: rp.permission.description,
        createdAt: rp.permission.createdAt,
      })),
    };
  },

  /**
   * Delete a role.
   */
  async deleteRole(id: number): Promise<void> {
    const role = await rbacRepository.findRoleById(id);
    if (!role) {
      throw new Error('Role not found');
    }

    if (role.name === 'admin' || role.name === 'super_admin') {
      throw new Error('System core roles cannot be deleted');
    }

    await rbacRepository.deleteRole(id);
  },

  /**
   * Assign or sync roles for a user.
   */
  async assignUserRoles(userId: number, roleIds: number[]): Promise<string[]> {
    await rbacRepository.syncUserRoles(userId, roleIds);
    return rbacRepository.getUserRoles(userId);
  },

  /**
   * Idempotent initialization / seeder for initial board permissions and roles.
   */
  async seedDefaultRbac() {
    // 1. Upsert permissions
    for (const p of INITIAL_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { name: p.name },
        update: { description: p.description },
        create: {
          name: p.name,
          description: p.description,
        },
      });
    }

    // 2. Fetch all permission records
    const allPermissions = await prisma.permission.findMany();
    const permMap = new Map(allPermissions.map((p) => [p.name, p.id]));

    // 3. Upsert initial roles with permissions
    for (const r of INITIAL_ROLES) {
      const role = await prisma.role.upsert({
        where: { name: r.name },
        update: { description: r.description },
        create: {
          name: r.name,
          description: r.description,
        },
      });

      // Map permission names to IDs
      const targetIds = r.permissions
        .map((pName) => permMap.get(pName))
        .filter((id): id is number => typeof id === 'number');

      // Re-sync role permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      if (targetIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: targetIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      }
    }

    return { success: true, permissionsCount: allPermissions.length, rolesCount: INITIAL_ROLES.length };
  },
};
