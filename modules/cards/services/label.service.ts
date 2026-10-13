import { prisma } from '@/lib/prisma';
import { cardService } from './card.service';
import { publishCardEvent } from './card-publisher';
import type {
  LabelDTO,
  CreateLabelInput,
  UpdateLabelInput,
  ToggleCardLabelInput,
  CardDTO,
} from '../types';

export class LabelService {
  /**
   * Fetch all labels available on a board
   */
  async getBoardLabels(boardId: number, userId: number): Promise<LabelDTO[]> {
    const access = await cardService.evaluateCardHybridAccess(userId, boardId);
    if (!access.canRead) {
      throw new Error('Forbidden. You do not have permission to view labels on this board.');
    }

    const labels = await prisma.label.findMany({
      where: { boardId },
      orderBy: { id: 'asc' },
    });

    return labels.map((l) => ({
      id: l.id,
      boardId: l.boardId,
      title: l.title,
      color: l.color,
    }));
  }

  /**
   * Create a new label on a board
   */
  async createLabel(userId: number, input: CreateLabelInput): Promise<LabelDTO> {
    const access = await cardService.evaluateCardHybridAccess(userId, input.boardId);
    if (!access.canUpdate && !access.canCreate) {
      throw new Error('Forbidden. You do not have permission to create labels on this board.');
    }

    const label = await prisma.label.create({
      data: {
        boardId: input.boardId,
        title: input.title?.trim() || null,
        color: input.color?.trim() || null,
      },
    });

    return {
      id: label.id,
      boardId: label.boardId,
      title: label.title,
      color: label.color,
    };
  }

  /**
   * Update an existing label
   */
  async updateLabel(
    userId: number,
    labelId: number,
    input: UpdateLabelInput
  ): Promise<LabelDTO> {
    const existing = await prisma.label.findUnique({
      where: { id: labelId },
    });

    if (!existing) {
      throw new Error(`Label with ID ${labelId} not found.`);
    }

    const access = await cardService.evaluateCardHybridAccess(userId, existing.boardId);
    if (!access.canUpdate) {
      throw new Error('Forbidden. You do not have permission to update labels on this board.');
    }

    const updated = await prisma.label.update({
      where: { id: labelId },
      data: {
        ...(input.title !== undefined && { title: input.title?.trim() || null }),
        ...(input.color !== undefined && { color: input.color?.trim() || null }),
      },
    });

    // Notify cards that use this label via card.updated
    const cardsUsingLabel = await prisma.cardLabel.findMany({
      where: { labelId },
      select: { cardId: true },
    });

    for (const cl of cardsUsingLabel) {
      cardService.getCardById(cl.cardId).then((cardDto) => {
        if (cardDto) {
          publishCardEvent({
            type: 'card.updated',
            op: 'card.updated',
            boardId: cardDto.boardId,
            listId: cardDto.listId,
            actorId: userId,
            card: cardDto,
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return {
      id: updated.id,
      boardId: updated.boardId,
      title: updated.title,
      color: updated.color,
    };
  }

  /**
   * Delete a label from the board (and remove it from all cards)
   */
  async deleteLabel(userId: number, labelId: number): Promise<boolean> {
    const existing = await prisma.label.findUnique({
      where: { id: labelId },
    });

    if (!existing) {
      throw new Error(`Label with ID ${labelId} not found.`);
    }

    const access = await cardService.evaluateCardHybridAccess(userId, existing.boardId);
    if (!access.canDelete && !access.canUpdate) {
      throw new Error('Forbidden. You do not have permission to delete labels on this board.');
    }

    const cardsUsingLabel = await prisma.cardLabel.findMany({
      where: { labelId },
      select: { cardId: true },
    });

    await prisma.label.delete({
      where: { id: labelId },
    });

    for (const cl of cardsUsingLabel) {
      cardService.getCardById(cl.cardId).then((cardDto) => {
        if (cardDto) {
          publishCardEvent({
            type: 'card.updated',
            op: 'card.updated',
            boardId: cardDto.boardId,
            listId: cardDto.listId,
            actorId: userId,
            card: cardDto,
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return true;
  }

  /**
   * Toggle a label on a card (attach if not present, detach if present)
   */
  async toggleCardLabel(
    userId: number,
    input: ToggleCardLabelInput
  ): Promise<{ added: boolean; card: CardDTO }> {
    const { cardId, labelId } = input;

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, boardId: true, listId: true, ownerId: true },
    });

    if (!card) {
      throw new Error(`Card with ID ${cardId} not found.`);
    }

    const access = await cardService.evaluateCardHybridAccess(userId, card.boardId, card.ownerId);
    if (!access.canUpdate) {
      throw new Error('Forbidden. You do not have permission to edit this card.');
    }

    const label = await prisma.label.findUnique({
      where: { id: labelId },
    });

    if (!label || label.boardId !== card.boardId) {
      throw new Error('Label does not exist on this board.');
    }

    const existingCardLabel = await prisma.cardLabel.findUnique({
      where: {
        cardId_labelId: {
          cardId,
          labelId,
        },
      },
    });

    let added = false;
    if (existingCardLabel) {
      await prisma.cardLabel.delete({
        where: {
          cardId_labelId: {
            cardId,
            labelId,
          },
        },
      });
      added = false;
    } else {
      await prisma.cardLabel.create({
        data: {
          cardId,
          labelId,
        },
      });
      added = true;
    }

    // Increment card version
    await prisma.card.update({
      where: { id: cardId },
      data: { version: { increment: 1 } },
    });

    const updatedCardDto = await cardService.getCardById(cardId);
    if (!updatedCardDto) {
      throw new Error('Failed to retrieve updated card');
    }

    await publishCardEvent({
      type: 'card.updated',
      op: 'card.updated',
      boardId: updatedCardDto.boardId,
      listId: updatedCardDto.listId,
      actorId: userId,
      card: updatedCardDto,
    });

    return {
      added,
      card: updatedCardDto,
    };
  }
}

export const labelService = new LabelService();

