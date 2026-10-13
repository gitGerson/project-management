'use server';

import { getSession } from '@/lib/auth';
import { listService } from './services/list.service';
import { createListSchema, updateListSchema } from './schemas/list.schema';
import type {
  ActionResponse,
  ListDTO,
  CreateListInput,
  UpdateListInput,
  ListPermissionsDTO,
} from './types';

export async function getBoardListsAction(boardId: number): Promise<ActionResponse<ListDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const lists = await listService.getListsByBoardId(boardId, session.userId);
    return { success: true, data: lists };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to fetch board lists' };
  }
}

export async function getBoardListPermissionsAction(
  boardId: number
): Promise<ActionResponse<ListPermissionsDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const perms = await listService.getBoardListPermissions(session.userId, boardId);
    return { success: true, data: perms };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to fetch list permissions' };
  }
}

export async function createListAction(
  input: CreateListInput
): Promise<ActionResponse<ListDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = createListSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const created = await listService.createList(session.userId, parsed.data);
    return { success: true, data: created };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to create list' };
  }
}

export async function updateListAction(
  listId: number,
  input: UpdateListInput
): Promise<ActionResponse<ListDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = updateListSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await listService.updateList(session.userId, listId, parsed.data);
    return { success: true, data: updated };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to update list' };
  }
}

export async function deleteListAction(listId: number): Promise<ActionResponse<boolean>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    await listService.deleteList(session.userId, listId);
    return { success: true, data: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to delete list' };
  }
}

