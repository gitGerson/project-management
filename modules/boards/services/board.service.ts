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
      include:
        viewerUserId !== undefined
          ? {
              members: {
                where: {
                  userId: viewerUserId,
                },
                select: {
                  role: true,
                },
              },
            }
          : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return boards.map((b) => {
      const userRole = (b as unknown as { members?: Array<{ role: string }> }).members?.[0]?.role as
        | ('owner' | 'member' | 'monitor' | 'guest')
        | undefined;

      return {
        id: b.id,
        name: b.name,
        description: b.description,
        image: b.image,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        currentUserRole: userRole || null,
        canEdit: userRole === 'owner',
      };
    });
  }

  async getBoardById(id: number, viewerUserId?: number): Promise<BoardDTO | null> {
    const board = await prisma.board.findUnique({
      where: { id },
      include:
        viewerUserId !== undefined
          ? {
              members: {
                where: {
                  userId: viewerUserId,
                },
                select: {
                  role: true,
                },
              },
            }
          : undefined,
    });

    if (!board) return null;

    const userRole = (board as unknown as { members?: Array<{ role: string }> }).members?.[0]?.role as
      | ('owner' | 'member' | 'monitor' | 'guest')
      | undefined;

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      image: board.image,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
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
}

export const boardService = new BoardService();

