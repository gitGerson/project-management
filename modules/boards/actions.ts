'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { hasPermission, hasAnyPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { boardService } from './services/board.service';
import { boardMemberService } from '@/modules/board-members/services/board-member.service';
import { createBoardSchema, updateBoardSchema } from './schemas/board.schema';
import type { ActionResponse, BoardDTO, CreateBoardInput, UpdateBoardInput } from './types';

export async function listBoardsAction(): Promise<ActionResponse<BoardDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasAnyPermission(session.userId, [
    PERMISSIONS.BOARDS_READ,
    PERMISSIONS.BOARDS_VIEW_ALL,
  ]);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to view boards.' };
  }

  // If user has BOARDS_VIEW_ALL, they see all boards.
  // Otherwise, they only see boards where they are an assigned member.
  const hasViewAll = await hasPermission(session.userId, PERMISSIONS.BOARDS_VIEW_ALL);

  try {
    const boards = await boardService.listBoards(
      hasViewAll ? undefined : session.userId,
      session.userId
    );
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
    const board = await boardService.createBoard(parsed.data, session.userId);
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

  const hasGlobalUpdate = await hasPermission(session.userId, PERMISSIONS.BOARDS_UPDATE);
  const isOwner = await boardMemberService.isBoardOwner(id, session.userId);
  if (!hasGlobalUpdate && !isOwner) {
    return { success: false, message: 'Forbidden. You do not have permission to edit this board.' };
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

  const hasGlobalDelete = await hasPermission(session.userId, PERMISSIONS.BOARDS_DELETE);
  const isOwner = await boardMemberService.isBoardOwner(id, session.userId);
  if (!hasGlobalDelete && !isOwner) {
    return { success: false, message: 'Forbidden. You do not have permission to delete this board.' };
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

export async function togglePinBoardAction(
  boardId: number
): Promise<ActionResponse<{ isPinned: boolean }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const hasViewAll = await hasPermission(session.userId, PERMISSIONS.BOARDS_VIEW_ALL);
  const isMember = await boardMemberService.isBoardMember(boardId, session.userId);
  if (!hasViewAll && !isMember) {
    return { success: false, message: 'Forbidden. You do not have access to this board.' };
  }

  try {
    const result = await boardService.togglePin(session.userId, boardId);
    revalidatePath('/');
    return {
      success: true,
      message: result.isPinned ? 'Board pinned successfully' : 'Board unpinned successfully',
      data: result,
    };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to update pin status' };
  }
}

export async function getUserPinnedBoardsAction(): Promise<
  ActionResponse<Array<{ id: number; name: string }>>
> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const pinnedBoards = await boardService.getUserPinnedBoards(session.userId);
    return { success: true, data: pinnedBoards };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to fetch pinned boards' };
  }
}

