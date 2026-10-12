import { prisma } from '@/lib/prisma';
import type { Role, Permission } from '@prisma/client';

export interface CreateRoleRepoData {
  name: string;
  description?: string;
  permissionIds?: number[];
}

export interface UpdateRoleRepoData {
  name?: string;
  description?: string;
  permissionIds?: number[];
}

export const rbacRepository = {
  /**
   * Get all defined permissions in the system.
   */
  async getAllPermissions(): Promise<Permission[]> {
    return prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Get all roles including their assigned permissions.
   */
  async getAllRoles() {
    return prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  },

  /**
   * Find role by ID.
   */
  async findRoleById(id: number) {
    return prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  },

  /**
   * Find role by unique name.
   */
  async findRoleByName(name: string): Promise<Role | null> {
    return prisma.role.findUnique({
      where: { name },
    });
  },

  /**
   * Create a new role with optional permission assignments.
   */
  async createRole(data: CreateRoleRepoData) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: data.name,
          description: data.description || null,
        },
      });

      if (data.permissionIds && data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((pId) => ({
            roleId: role.id,
            permissionId: pId,
          })),
        });
      }

      return role;
    });
  },

  /**
   * Update role details and sync permissions.
   */
  async updateRole(id: number, data: UpdateRoleRepoData) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description !== undefined ? data.description : undefined,
        },
      });

      if (data.permissionIds !== undefined) {
        // Clear existing permissions and replace with new set
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        if (data.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: data.permissionIds.map((pId) => ({
              roleId: id,
              permissionId: pId,
            })),
          });
        }
      }

      return role;
    });
  },

  /**
   * Delete a role.
   */
  async deleteRole(id: number): Promise<void> {
    await prisma.role.delete({
      where: { id },
    });
  },

  /**
   * Get all role names assigned to a given user.
   */
  async getUserRoles(userId: number): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          select: { name: true },
        },
      },
    });

    return userRoles.map((ur) => ur.role.name);
  },

  /**
   * Get all distinct permission names granted to a user via their assigned roles.
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.name);
      }
    }

    return Array.from(permissionSet);
  },

  /**
   * Synchronize the roles assigned to a user.
   */
  async syncUserRoles(userId: number, roleIds: number[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId },
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId,
            roleId,
          })),
        });
      }
    });
  },
};
