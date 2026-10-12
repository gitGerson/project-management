import { prisma } from '@/lib/prisma';
import type { BoardDTO, CreateBoardInput, UpdateBoardInput } from '../types';

export class BoardService {
  async listBoards(): Promise<BoardDTO[]> {
    const boards = await prisma.board.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return boards.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      image: b.image,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
  }

  async getBoardById(id: number): Promise<BoardDTO | null> {
    const board = await prisma.board.findUnique({
      where: { id },
    });

    if (!board) return null;

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      image: board.image,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    };
  }

  async createBoard(data: CreateBoardInput): Promise<BoardDTO> {
    const board = await prisma.board.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        image: data.image || null,
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

