import { prisma } from '@/lib/prisma';
import type { BoardDTO, CreateBoardInput, UpdateBoardInput } from '../types';

export class BoardService {
  async listBoards(filterUserId?: number, viewerUserId?: number): Promise<BoardDTO[]> {
    const boards = await prisma.board.findMany({
      where:
        filterUserId !== undefined
          ? {
              members: {
                some: {
                  userId: filterUserId,
                },
              },
            }
          : undefined,
      include: {
        ...(viewerUserId !== undefined && {
          members: {
            where: {
              userId: viewerUserId,
            },
            select: {
              role: true,
            },
          },
          pinnedByUsers: {
            where: {
              userId: viewerUserId,
            },
            select: {
              userId: true,
              createdAt: true,
            },
          },
        }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const mapped = boards.map((b) => {
      const bObj = b as unknown as {
        members?: Array<{ role: string }>;
        pinnedByUsers?: Array<{ userId: number; createdAt: Date }>;
      };
      const userRole = bObj.members?.[0]?.role as
        | ('owner' | 'member' | 'monitor' | 'guest')
        | undefined;
      const pinnedRecord = bObj.pinnedByUsers?.[0];
      const isPinned = Boolean(pinnedRecord);
      const pinnedAt = pinnedRecord ? pinnedRecord.createdAt : null;

      return {
        id: b.id,
        name: b.name,
        description: b.description,
        image: b.image,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        isPinned,
        pinnedAt,
        currentUserRole: userRole || null,
        canEdit: userRole === 'owner',
      };
    });

    // Recent pinned board is auto moved into the most left. Other pinned is moved right.
    mapped.sort((a, b) => {
      if (a.isPinned && b.isPinned) {
        const timeA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
        const timeB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
        return timeB - timeA; // Recent pinned first
      }
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return mapped;
  }

  async getBoardById(id: number, viewerUserId?: number): Promise<BoardDTO | null> {
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        ...(viewerUserId !== undefined && {
          members: {
            where: {
              userId: viewerUserId,
            },
            select: {
              role: true,
            },
          },
          pinnedByUsers: {
            where: {
              userId: viewerUserId,
            },
            select: {
              userId: true,
              createdAt: true,
            },
          },
        }),
      },
    });

    if (!board) return null;

    const bObj = board as unknown as {
      members?: Array<{ role: string }>;
      pinnedByUsers?: Array<{ userId: number; createdAt: Date }>;
    };
    const userRole = bObj.members?.[0]?.role as
      | ('owner' | 'member' | 'monitor' | 'guest')
      | undefined;
    const pinnedRecord = bObj.pinnedByUsers?.[0];
    const isPinned = Boolean(pinnedRecord);
    const pinnedAt = pinnedRecord ? pinnedRecord.createdAt : null;

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      image: board.image,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      isPinned,
      pinnedAt,
      currentUserRole: userRole || null,
      canEdit: userRole === 'owner',
    };
  }

  async createBoard(data: CreateBoardInput, creatorUserId?: number): Promise<BoardDTO> {
    return await prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          image: data.image || null,
        },
      });

      if (creatorUserId) {
        await tx.boardMember.create({
          data: {
            boardId: board.id,
            userId: creatorUserId,
            role: 'owner',
          },
        });
      }

      return {
        id: board.id,
        name: board.name,
        description: board.description,
        image: board.image,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      };
    });
  }

  async updateBoard(id: number, data: UpdateBoardInput): Promise<BoardDTO> {
    const existing = await prisma.board.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Board with ID ${id} not found`);
    }

    const board = await prisma.board.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() || null }),
        ...(data.image !== undefined && { image: data.image || null }),
      },
    });

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      image: board.image,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    };
  }

  async deleteBoard(id: number): Promise<boolean> {
    const existing = await prisma.board.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Board with ID ${id} not found`);
    }

    await prisma.board.delete({
      where: { id },
    });

    return true;
  }

  async getUserPinnedBoards(userId: number): Promise<Array<{ id: number; name: string }>> {
    const pinned = await prisma.userPinnedBoard.findMany({
      where: { userId },
      include: {
        board: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return pinned.map((p) => ({
      id: p.board.id,
      name: p.board.name,
    }));
  }

  async togglePin(userId: number, boardId: number): Promise<{ isPinned: boolean }> {
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      throw new Error(`Board with ID ${boardId} not found`);
    }

    const existingPin = await prisma.userPinnedBoard.findUnique({
      where: {
        userId_boardId: {
          userId,
          boardId,
        },
      },
    });

    if (existingPin) {
      await prisma.userPinnedBoard.delete({
        where: {
          userId_boardId: {
            userId,
            boardId,
          },
        },
      });
      return { isPinned: false };
    }

    // Check maximum limit of 3 pinned boards per user
    const currentCount = await prisma.userPinnedBoard.count({
      where: { userId },
    });

    if (currentCount >= 3) {
      throw new Error('You can only pin up to 3 boards. Please unpin a board first.');
    }

    await prisma.userPinnedBoard.create({
      data: {
        userId,
        boardId,
      },
    });

    return { isPinned: true };
  }
}

export const boardService = new BoardService();

