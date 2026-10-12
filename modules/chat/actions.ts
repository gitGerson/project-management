'use server';

import { getSession, createSessionToken } from '@/lib/auth';
import { commentService } from './services/comment.service';
import { sendCommentSchema } from './schemas/comment.schema';
import type {
  ActionResponse,
  ChatGroupDTO,
  CommentDTO,
  SendCommentInput,
  MentionUserDTO,
} from './types';

export async function listUserChatGroupsAction(): Promise<ActionResponse<ChatGroupDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const groups = await commentService.listUserChatGroups(session.userId);
    return { success: true, data: groups };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to fetch chat groups' };
  }
}

export async function listCommentsAction(
  scopeType: string,
  scopeId: number,
  limit?: number
): Promise<ActionResponse<CommentDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const comments = await commentService.listComments(scopeType, scopeId, session.userId, limit);
    return { success: true, data: comments };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to fetch comments' };
  }
}

export async function sendCommentAction(
  input: SendCommentInput
): Promise<ActionResponse<CommentDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = sendCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const comment = await commentService.sendComment(session.userId, {
      ...parsed.data,
      tempId: input.tempId,
    });
    return { success: true, data: comment };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to send message' };
  }
}

export async function listMentionCandidatesAction(
  scopeType: string,
  scopeId: number
): Promise<ActionResponse<MentionUserDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const candidates = await commentService.listMentionCandidates(scopeType, scopeId);
    return { success: true, data: candidates };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to load mention candidates' };
  }
}

export async function markChatAsReadAction(
  scopeType: string,
  scopeId: number
): Promise<ActionResponse<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    await commentService.markAsRead(session.userId, scopeType, scopeId);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, message: err.message || 'Failed to mark chat as read' };
  }
}

export async function getCurrentChatUserAction(): Promise<ActionResponse<{ userId: number; username: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized' };
  }
  return { success: true, data: { userId: session.userId, username: session.username } };
}

export async function getChatWsTokenAction(): Promise<ActionResponse<string>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized' };
  }
  const token = await createSessionToken({
    userId: session.userId,
    username: session.username,
  });
  return { success: true, data: token };
}
