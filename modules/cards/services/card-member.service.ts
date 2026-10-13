import { prisma } from '@/lib/prisma';
import { cardService } from './card.service';
import { publishCardEvent } from './card-publisher';
import type { ToggleCardMemberInput, CardDTO, CardMemberDTO } from '../types';

export class CardMemberService {
  /**
   * List all members assigned to a card
   */
  async listCardMembers(cardId: number): Promise<CardMemberDTO[]> {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, boardId: true },
    });

    if (!card) {
      throw new Error(`Card with ID ${cardId} not found.`);
    }

    const members = await prisma.cardMember.findMany({
      where: { cardId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      cardId: m.cardId,
      userId: m.userId,
      createdAt: m.createdAt.toISOString(),
      user: {
        id: m.user.id,
        name: m.user.name,
        username: m.user.username,
        email: m.user.email,
        profilePicture: m.user.profilePicture,
      },
    }));
  }

  /**
   * Toggle a user's membership on a card (assign if not assigned, unassign if assigned)
   * Enforces the invariant: Target user MUST be an existing member of the card's board.
   */
  async toggleCardMember(
    actorUserId: number,
    input: ToggleCardMemberInput
  ): Promise<{ added: boolean; card: CardDTO }> {
    const { cardId, userId: targetUserId } = input;

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, boardId: true, listId: true, ownerId: true },
    });

    if (!card) {
      throw new Error(`Card with ID ${cardId} not found.`);
    }

    // Evaluate actor's authorization on this card
    const access = await cardService.evaluateCardHybridAccess(actorUserId, card.boardId, card.ownerId);
    if (!access.canUpdate) {
      throw new Error('Forbidden. You do not have permission to modify members on this card.');
    }

    // Invariant Check: Target user MUST be a member of the board
    const isBoardMember = await prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId: card.boardId,
          userId: targetUserId,
        },
      },
    });

    if (!isBoardMember) {
      throw new Error('User is not a member of this board.');
    }

    // Check if membership already exists
    const existing = await prisma.cardMember.findUnique({
      where: {
        card_members_card_id_user_id_unique: {
          cardId,
          userId: targetUserId,
        },
      },
    });

    let added = false;
    if (existing) {
      await prisma.cardMember.delete({
        where: { id: existing.id },
      });
      added = false;
    } else {
      await prisma.cardMember.create({
        data: {
          cardId,
          userId: targetUserId,
        },
      });
      added = true;
    }

    // Fetch refreshed card with all relations
    const updatedCard = await cardService.getCardById(cardId);
    if (!updatedCard) {
      throw new Error('Failed to retrieve updated card.');
    }

    // Broadcast update event to all board viewers in real-time
    await publishCardEvent({
      type: 'card.updated',
      op: 'card.updated',
      boardId: updatedCard.boardId,
      listId: updatedCard.listId,
      actorId: actorUserId,
      card: updatedCard,
    });

    return { added, card: updatedCard };
  }
}

export const cardMemberService = new CardMemberService();
