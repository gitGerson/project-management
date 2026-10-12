'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { boardService } from './services/board.service';
import { createBoardSchema, updateBoardSchema } from './schemas/board.schema';
import type { ActionResponse, BoardDTO, CreateBoardInput, UpdateBoardInput } from './types';

export async function listBoardsAction(): Promise<ActionResponse<BoardDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.BOARDS_READ);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to view boards.' };
  }

  try {
    const boards = await boardService.listBoards();
    return { success: true, data: boards };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to fetch boards' };
  }
}

export async function createBoardAction(data: CreateBoardInput): Promise<ActionResponse<BoardDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.BOARDS_CREATE);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to create boards.' };
  }

  const parsed = createBoardSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const board = await boardService.createBoard(parsed.data);
    revalidatePath('/');
    return { success: true, message: 'Board created successfully', data: board };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to create board' };
  }
}

export async function updateBoardAction(
  id: number,
  data: UpdateBoardInput
): Promise<ActionResponse<BoardDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.BOARDS_UPDATE);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to edit boards.' };
  }

  const parsed = updateBoardSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const board = await boardService.updateBoard(id, parsed.data);
    revalidatePath('/');
    return { success: true, message: 'Board updated successfully', data: board };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to update board' };
  }
}

export async function deleteBoardAction(id: number): Promise<ActionResponse<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasPermission(session.userId, PERMISSIONS.BOARDS_DELETE);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to delete boards.' };
  }

  try {
    await boardService.deleteBoard(id);
    revalidatePath('/');
    return { success: true, message: 'Board deleted successfully' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to delete board' };
  }
}

