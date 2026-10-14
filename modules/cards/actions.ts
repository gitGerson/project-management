'use server';

import { getSession } from '@/lib/auth';
import { cardService } from './services/card.service';
import { labelService } from './services/label.service';
import { cardMemberService } from './services/card-member.service';
import { boardMemberService } from '@/modules/board-members/services/board-member.service';
import type { BoardMemberDTO } from '@/modules/board-members/types';
import {
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
} from './schemas/card.schema';
import {
  createLabelSchema,
  updateLabelSchema,
  toggleCardLabelSchema,
} from './schemas/label.schema';
import { toggleCardMemberSchema } from './schemas/member.schema';
import { createCardAttachmentSchema } from './schemas/attachment.schema';
import type {
  ActionResponse,
  CardDTO,
  CreateCardInput,
  UpdateCardInput,
  MoveCardInput,
  CardPermissionsDTO,
  LabelDTO,
  CreateLabelInput,
  UpdateLabelInput,
  ToggleCardLabelInput,
  ToggleCardMemberInput,
  CardAttachmentDTO,
  CreateCardAttachmentInput,
} from './types';

export async function getBoardCardsAction(boardId: number): Promise<ActionResponse<CardDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const cards = await cardService.getCardsByBoardId(boardId, session.userId);
    return { success: true, data: cards };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to fetch cards' };
  }
}

export async function getBoardCardPermissionsAction(
  boardId: number
): Promise<ActionResponse<CardPermissionsDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const perms = await cardService.getBoardCardPermissions(session.userId, boardId);
    return { success: true, data: perms };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to fetch card permissions' };
  }
}

export async function createCardAction(
  input: CreateCardInput
): Promise<ActionResponse<CardDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const card = await cardService.createCard(session.userId, parsed.data);
    return { success: true, data: card };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to create card' };
  }
}

export async function updateCardAction(
  cardId: number,
  input: UpdateCardInput
): Promise<ActionResponse<CardDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await cardService.updateCard(session.userId, cardId, parsed.data);
    return { success: true, data: updated };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to update card' };
  }
}

export async function deleteCardAction(cardId: number): Promise<ActionResponse<boolean>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    await cardService.deleteCard(session.userId, cardId);
    return { success: true, data: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to delete card' };
  }
}

export async function moveCardAction(
  input: MoveCardInput
): Promise<ActionResponse<CardDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const moved = await cardService.moveCard(session.userId, parsed.data);
    return { success: true, data: moved };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to move card' };
  }
}

export async function getBoardLabelsAction(
  boardId: number
): Promise<ActionResponse<LabelDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const labels = await labelService.getBoardLabels(boardId, session.userId);
    return { success: true, data: labels };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to fetch board labels' };
  }
}

export async function createLabelAction(
  input: CreateLabelInput
): Promise<ActionResponse<LabelDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = createLabelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const label = await labelService.createLabel(session.userId, parsed.data);
    return { success: true, data: label };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to create label' };
  }
}

export async function updateLabelAction(
  labelId: number,
  input: UpdateLabelInput
): Promise<ActionResponse<LabelDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = updateLabelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const label = await labelService.updateLabel(session.userId, labelId, parsed.data);
    return { success: true, data: label };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to update label' };
  }
}

export async function deleteLabelAction(
  labelId: number
): Promise<ActionResponse<boolean>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    await labelService.deleteLabel(session.userId, labelId);
    return { success: true, data: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to delete label' };
  }
}

export async function toggleCardLabelAction(
  input: ToggleCardLabelInput
): Promise<ActionResponse<{ added: boolean; card: CardDTO }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = toggleCardLabelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await labelService.toggleCardLabel(session.userId, parsed.data);
    return { success: true, data: result };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to toggle card label' };
  }
}

export async function toggleCardMemberAction(
  input: ToggleCardMemberInput
): Promise<ActionResponse<{ added: boolean; card: CardDTO }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = toggleCardMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await cardMemberService.toggleCardMember(session.userId, parsed.data);
    return { success: true, data: result };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to toggle card member' };
  }
}

export async function getBoardMembersForCardAction(
  boardId: number
): Promise<ActionResponse<BoardMemberDTO[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  try {
    const members = await boardMemberService.listMembersByBoardId(boardId);
    return { success: true, data: members };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to fetch board members' };
  }
}

export async function addCardAttachmentAction(
  input: CreateCardAttachmentInput
): Promise<ActionResponse<CardAttachmentDTO>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  const parsed = createCardAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const attachment = await cardService.addAttachment(session.userId, parsed.data);
    return { success: true, data: attachment };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to add attachment' };
  }
}

export async function deleteCardAttachmentAction(
  cardId: number,
  attachmentId: number
): Promise<ActionResponse<{ id: number }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized. Please sign in.' };
  }

  if (!cardId || !attachmentId) {
    return { success: false, message: 'Invalid card or attachment ID' };
  }

  try {
    await cardService.deleteAttachment(session.userId, cardId, attachmentId);
    return { success: true, data: { id: attachmentId } };
  } catch (err) {
    const error = err as Error;
    return { success: false, message: error.message || 'Failed to delete attachment' };
  }
}



