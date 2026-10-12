import { prisma } from '@/lib/prisma';
import { BoardRole } from '@prisma/client';
import type {
  BoardMemberDTO,
  BoardMemberUserDTO,
  AddBoardMemberInput,
  UpdateBoardMemberRoleInput,
  SyncBoardMemberItem,
  BoardMemberRole,
} from '../types';

const ROLE_PRIORITY: Record<BoardMemberRole, number> = {
  owner: 1,
  member: 2,
  monitor: 3,
  guest: 4,
};

export class BoardMemberService {
  async listMembersByBoardId(boardId: number): Promise<BoardMemberDTO[]> {
    const records = await prisma.boardMember.findMany({
      where: { boardId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const members: BoardMemberDTO[] = records.map((record) => ({
      boardId: record.boardId,
      userId: record.userId,
      role: record.role as BoardMemberRole,
      user: {
        id: record.user.id,
        name: record.user.name,
        username: record.user.username,
        email: record.user.email,
        profilePicture: record.user.profilePicture,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));

    // Sort by role hierarchy: owner -> member -> monitor -> guest, then by user name
    members.sort((a, b) => {
      const pA = ROLE_PRIORITY[a.role] ?? 99;
      const pB = ROLE_PRIORITY[b.role] ?? 99;
      if (pA !== pB) return pA - pB;
      return a.user.name.localeCompare(b.user.name);
    });

    return members;
  }

  async getMember(boardId: number, userId: number): Promise<BoardMemberDTO | null> {
    const record = await prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });

    if (!record) return null;

    return {
      boardId: record.boardId,
      userId: record.userId,
      role: record.role as BoardMemberRole,
      user: {
        id: record.user.id,
        name: record.user.name,
        username: record.user.username,
        email: record.user.email,
        profilePicture: record.user.profilePicture,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async isBoardOwner(boardId: number, userId: number): Promise<boolean> {
    const record = await prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });

    return record?.role === 'owner';
  }

  async addMember(data: AddBoardMemberInput): Promise<BoardMemberDTO> {
    const roleValue = (data.role || 'member') as BoardRole;

    const record = await prisma.boardMember.upsert({
      where: {
        boardId_userId: {
          boardId: data.boardId,
          userId: data.userId,
        },
      },
      create: {
        boardId: data.boardId,
        userId: data.userId,
        role: roleValue,
      },
      update: {
        role: roleValue,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });

    return {
      boardId: record.boardId,
      userId: record.userId,
      role: record.role as BoardMemberRole,
      user: {
        id: record.user.id,
        name: record.user.name,
        username: record.user.username,
        email: record.user.email,
        profilePicture: record.user.profilePicture,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async updateMemberRole(data: UpdateBoardMemberRoleInput): Promise<BoardMemberDTO> {
    const existing = await prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId: data.boardId,
          userId: data.userId,
        },
      },
    });

    if (!existing) {
      throw new Error(`Member with userId ${data.userId} not found on board ${data.boardId}`);
    }

    const record = await prisma.boardMember.update({
      where: {
        boardId_userId: {
          boardId: data.boardId,
          userId: data.userId,
        },
      },
      data: {
        role: data.role as BoardRole,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });

    return {
      boardId: record.boardId,
      userId: record.userId,
      role: record.role as BoardMemberRole,
      user: {
        id: record.user.id,
        name: record.user.name,
        username: record.user.username,
        email: record.user.email,
        profilePicture: record.user.profilePicture,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async removeMember(boardId: number, userId: number): Promise<boolean> {
    const existing = await prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
    });

    if (!existing) {
      throw new Error(`Member with userId ${userId} not found on board ${boardId}`);
    }

    await prisma.boardMember.delete({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
    });

    return true;
  }

  async searchUsers(query?: string): Promise<BoardMemberUserDTO[]> {
    const trimmed = query?.trim() || '';
    const users = await prisma.user.findMany({
      where: trimmed
        ? {
            OR: [
              { name: { contains: trimmed } },
              { username: { contains: trimmed } },
              { email: { contains: trimmed } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        profilePicture: true,
      },
      take: 20,
      orderBy: {
        name: 'asc',
      },
    });

    return users;
  }

  async syncBoardMembers(
    boardId: number,
    members: SyncBoardMemberItem[]
  ): Promise<BoardMemberDTO[]> {
    return await prisma.$transaction(async (tx) => {
      const targetUserIds = members.map((m) => m.userId);

      // 1. Remove members not in target list
      await tx.boardMember.deleteMany({
        where: {
          boardId,
          userId: { notIn: targetUserIds },
        },
      });

      // 2. Upsert each member in target list
      for (const m of members) {
        await tx.boardMember.upsert({
          where: {
            boardId_userId: {
              boardId,
              userId: m.userId,
            },
          },
          create: {
            boardId,
            userId: m.userId,
            role: m.role as BoardRole,
          },
          update: {
            role: m.role as BoardRole,
          },
        });
      }

      // 3. Retrieve and return refreshed list
      const records = await tx.boardMember.findMany({
        where: { boardId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              profilePicture: true,
            },
          },
        },
      });

      const updatedList: BoardMemberDTO[] = records.map((record) => ({
        boardId: record.boardId,
        userId: record.userId,
        role: record.role as BoardMemberRole,
        user: {
          id: record.user.id,
          name: record.user.name,
          username: record.user.username,
          email: record.user.email,
          profilePicture: record.user.profilePicture,
        },
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));

      updatedList.sort((a, b) => {
        const pA = ROLE_PRIORITY[a.role] ?? 99;
        const pB = ROLE_PRIORITY[b.role] ?? 99;
        if (pA !== pB) return pA - pB;
        return a.user.name.localeCompare(b.user.name);
      });

      return updatedList;
    });
  }
}

export const boardMemberService = new BoardMemberService();

