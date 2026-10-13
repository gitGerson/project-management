'use server';

import { getSession } from '@/lib/auth';
import { cardService } from './services/card.service';
import {
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
} from './schemas/card.schema';
import type {
  ActionResponse,
  CardDTO,
  CreateCardInput,
  UpdateCardInput,
  MoveCardInput,
  CardPermissionsDTO,
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

