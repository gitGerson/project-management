import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { UserFilterInput } from '@/modules/users/types';

export const userManagementRepository = {
  /**
   * List users with optional search, role filter, and pagination.
   */
  async listUsers(filter: UserFilterInput) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { name: { contains: q } },
        { username: { contains: q } },
        { email: { contains: q } },
      ];
    }

    if (filter.roleId) {
      where.userRoles = {
        some: {
          roleId: filter.roleId,
        },
      };
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          userRoles: {
            include: {
              role: {
                select: { id: true, name: true, description: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      users,
    };
  },

  /**
   * Find single user with roles and permissions.
   */
  async getUserDetail(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  /**
   * Update user details and optionally sync roles in transaction.
   */
  async updateUserWithRoles(
    id: number,
    data: { name?: string; phone?: string | null; roleIds?: number[] }
  ) {
    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.UserUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.phone !== undefined) updateData.phone = data.phone;

      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id },
          data: updateData,
        });
      }

      if (data.roleIds !== undefined) {
        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        if (data.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: data.roleIds.map((rId) => ({
              userId: id,
              roleId: rId,
            })),
          });
        }
      }

      return tx.user.findUnique({
        where: { id },
        include: {
          userRoles: {
            include: {
              role: {
                select: { id: true, name: true, description: true },
              },
            },
          },
        },
      });
    });
  },
};

