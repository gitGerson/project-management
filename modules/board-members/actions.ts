'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { hasAnyPermission, hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { boardMemberService } from './services/board-member.service';
import {
  addBoardMemberSchema,
  updateBoardMemberRoleSchema,
  removeBoardMemberSchema,
  syncBoardMembersSchema,
} from './schemas/board-member.schema';
import type {
  ActionResponse,
  BoardMemberDTO,
  BoardMemberUserDTO,
  AddBoardMemberInput,
  UpdateBoardMemberRoleInput,
  SyncBoardMembersInput,
} from './types';

export async function getBoardMembersAction(
  boardId: number
): Promise<ActionResponse<BoardMemberDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasAnyPermission(session.userId, [
    PERMISSIONS.BOARDS_READ,
    PERMISSIONS.BOARDS_VIEW_ALL,
  ]);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to view board members.' };
  }

  try {
    const members = await boardMemberService.listMembersByBoardId(boardId);
    return { success: true, data: members };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to fetch board members' };
  }
}

export async function addBoardMemberAction(
  data: AddBoardMemberInput
): Promise<ActionResponse<BoardMemberDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const hasGlobalManage = await hasAnyPermission(session.userId, [
    PERMISSIONS.BOARDS_UPDATE,
    PERMISSIONS.BOARDS_CREATE,
  ]);
  const isOwner = await boardMemberService.isBoardOwner(data.boardId, session.userId);
  if (!hasGlobalManage && !isOwner) {
    return { success: false, message: 'Forbidden. You do not have permission to add members.' };
  }

  const parsed = addBoardMemberSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const member = await boardMemberService.addMember(parsed.data);
    revalidatePath('/boards');
    return { success: true, data: member, message: 'Board member added successfully' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to add board member' };
  }
}

export async function updateBoardMemberRoleAction(
  data: UpdateBoardMemberRoleInput
): Promise<ActionResponse<BoardMemberDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const hasGlobalUpdate = await hasPermission(session.userId, PERMISSIONS.BOARDS_UPDATE);
  const isOwner = await boardMemberService.isBoardOwner(data.boardId, session.userId);
  if (!hasGlobalUpdate && !isOwner) {
    return { success: false, message: 'Forbidden. You do not have permission to update member roles.' };
  }

  const parsed = updateBoardMemberRoleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const member = await boardMemberService.updateMemberRole(parsed.data);
    revalidatePath('/boards');
    return { success: true, data: member, message: 'Board member role updated successfully' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to update member role' };
  }
}

export async function removeBoardMemberAction(
  boardId: number,
  userId: number
): Promise<ActionResponse<boolean>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const hasGlobalUpdate = await hasPermission(session.userId, PERMISSIONS.BOARDS_UPDATE);
  const isOwner = await boardMemberService.isBoardOwner(boardId, session.userId);
  if (!hasGlobalUpdate && !isOwner) {
    return { success: false, message: 'Forbidden. You do not have permission to remove members.' };
  }

  const parsed = removeBoardMemberSchema.safeParse({ boardId, userId });
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await boardMemberService.removeMember(parsed.data.boardId, parsed.data.userId);
    revalidatePath('/boards');
    return { success: true, data: true, message: 'Board member removed successfully' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to remove board member' };
  }
}

export async function searchAssignableUsersAction(
  query?: string
): Promise<ActionResponse<BoardMemberUserDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const allowed = await hasAnyPermission(session.userId, [
    PERMISSIONS.BOARDS_READ,
    PERMISSIONS.BOARDS_VIEW_ALL,
    PERMISSIONS.BOARDS_UPDATE,
  ]);
  if (!allowed) {
    return { success: false, message: 'Forbidden. You do not have permission to search users.' };
  }

  try {
    const users = await boardMemberService.searchUsers(query);
    return { success: true, data: users };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to search users' };
  }
}

export async function syncBoardMembersAction(
  data: SyncBoardMembersInput
): Promise<ActionResponse<BoardMemberDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const hasGlobalUpdate = await hasPermission(session.userId, PERMISSIONS.BOARDS_UPDATE);
  const isOwner = await boardMemberService.isBoardOwner(data.boardId, session.userId);
  if (!hasGlobalUpdate && !isOwner) {
    return { success: false, message: 'Forbidden. You do not have permission to update board members.' };
  }

  const parsed = syncBoardMembersSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await boardMemberService.syncBoardMembers(parsed.data.boardId, parsed.data.members);
    revalidatePath('/boards');
    return { success: true, data: updated, message: 'Board members updated successfully' };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to update board members' };
  }
}


