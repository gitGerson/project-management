import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { publishCardEvent } from './card-publisher';
import type {
  CardDTO,
  CreateCardInput,
  UpdateCardInput,
  MoveCardInput,
  CardPermissionsDTO,
} from '../types';

export class CardService {
  /**
   * Evaluates hybrid access rules for card operations based on RBAC and board contextual roles.
   */
  async evaluateCardHybridAccess(
    userId: number,
    boardId: number,
    cardOwnerId?: number
  ): Promise<{
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    memberRole: 'owner' | 'member' | 'monitor' | 'guest' | null;
  }> {
    const [hasViewAll, hasCreatePerm, hasReadPerm, hasUpdatePerm, hasDeletePerm, member] =
      await Promise.all([
        hasPermission(userId, PERMISSIONS.BOARDS_VIEW_ALL),
        hasPermission(userId, PERMISSIONS.CARDS_CREATE),
        hasPermission(userId, PERMISSIONS.CARDS_READ),
        hasPermission(userId, PERMISSIONS.CARDS_UPDATE),
        hasPermission(userId, PERMISSIONS.CARDS_DELETE),
        prisma.boardMember.findUnique({
          where: {
            boardId_userId: {
              boardId,
              userId,
            },
          },
          select: {
            role: true,
          },
        }),
      ]);

    const role = (member?.role as 'owner' | 'member' | 'monitor' | 'guest') || null;
    const isOwner = role === 'owner';
    const isMember = role === 'member';
    const isAssigned = role !== null;
    const isCardCreator = cardOwnerId !== undefined && cardOwnerId === userId;

    // Super Admin / Global View-All has full system override
    if (hasViewAll) {
      return {
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        memberRole: role,
      };
    }

    // Unassigned users cannot access non-public boards
    if (!isAssigned) {
      return {
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        memberRole: null,
      };
    }

    // Board Owner has full control over all cards in their board
    if (isOwner) {
      return {
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        memberRole: 'owner',
      };
    }

    // Standard board member
    if (isMember) {
      return {
        canRead: true,
        canCreate: hasCreatePerm,
        canUpdate: hasUpdatePerm || isCardCreator,
        canDelete: hasDeletePerm || isCardCreator,
        memberRole: 'member',
      };
    }

    // Monitor / Guest roles have read-only access
    return {
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      memberRole: role,
    };
  }

  /**
   * Get card permissions for a board
   */
  async getBoardCardPermissions(userId: number, boardId: number): Promise<CardPermissionsDTO> {
    const access = await this.evaluateCardHybridAccess(userId, boardId);
    return {
      canCreate: access.canCreate,
      canUpdate: access.canUpdate,
      canDelete: access.canDelete,
    };
  }

  /**
   * Fetch all cards for a board ordered deterministically by rank asc, id asc
   */
  async getCardsByBoardId(boardId: number, userId: number): Promise<CardDTO[]> {
    const access = await this.evaluateCardHybridAccess(userId, boardId);
    if (!access.canRead) {
      throw new Error('Forbidden. You do not have access to view cards on this board.');
    }

    const cards = await prisma.card.findMany({
      where: {
        boardId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePicture: true,
          },
        },
      },
      orderBy: [{ rank: 'asc' }, { id: 'asc' }],
    });

    return cards.map((c) => ({
      id: c.id,
      boardId: c.boardId,
      listId: c.listId,
      ownerId: c.ownerId,
      title: c.title,
      description: c.description,
      status: c.status,
      rank: c.rank,
      sortOrder: c.sortOrder,
      version: c.version,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      owner: c.owner
        ? {
            id: c.owner.id,
            name: c.owner.name,
            username: c.owner.username,
            profilePicture: c.owner.profilePicture,
          }
        : undefined,
    }));
  }

  /**
   * Create a new card in a list using fractional-indexing rank
   */
  async createCard(userId: number, input: CreateCardInput): Promise<CardDTO> {
    const access = await this.evaluateCardHybridAccess(userId, input.boardId);
    if (!access.canCreate) {
      throw new Error('Forbidden. You do not have permission to create cards on this board.');
    }

    // Verify list belongs to this board
    const list = await prisma.list.findUnique({
      where: { id: input.listId },
      select: { id: true, boardId: true },
    });
    if (!list || list.boardId !== input.boardId) {
      throw new Error('Invalid list. Target list does not exist on this board.');
    }

    // Calculate rank via fractional-indexing
    const position = input.position ?? 'top';
    let newRank: string;

    if (position === 'top') {
      const firstCard = await prisma.card.findFirst({
        where: { listId: input.listId },
        orderBy: [{ rank: 'asc' }, { id: 'asc' }],
        select: { rank: true },
      });
      newRank = generateKeyBetween(null, firstCard?.rank ?? null);
    } else {
      const lastCard = await prisma.card.findFirst({
        where: { listId: input.listId },
        orderBy: [{ rank: 'desc' }, { id: 'desc' }],
        select: { rank: true },
      });
      newRank = generateKeyBetween(lastCard?.rank ?? null, null);
    }

    const card = await prisma.card.create({
      data: {
        boardId: input.boardId,
        listId: input.listId,
        ownerId: userId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: 'active',
        rank: newRank,
        version: 1,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    const result: CardDTO = {
      id: card.id,
      boardId: card.boardId,
      listId: card.listId,
      ownerId: card.ownerId,
      title: card.title,
      description: card.description,
      status: card.status,
      rank: card.rank,
      sortOrder: card.sortOrder,
      version: card.version,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
      owner: card.owner
        ? {
            id: card.owner.id,
            name: card.owner.name,
            username: card.owner.username,
            profilePicture: card.owner.profilePicture,
          }
        : undefined,
    };

    await publishCardEvent({
      type: 'card.created',
      op: 'card.created',
      boardId: card.boardId,
      listId: card.listId,
      actorId: userId,
      card: result,
    });

    return result;
  }

  /**
   * Update a card's title, description, or status
   */
  async updateCard(userId: number, cardId: number, input: UpdateCardInput): Promise<CardDTO> {
    const existing = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, boardId: true, listId: true, ownerId: true },
    });

    if (!existing) {
      throw new Error(`Card with ID ${cardId} not found.`);
    }

    const access = await this.evaluateCardHybridAccess(userId, existing.boardId, existing.ownerId);
    if (!access.canUpdate) {
      throw new Error('Forbidden. You do not have permission to edit this card.');
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && {
          description: input.description ? input.description.trim() : null,
        }),
        ...(input.status !== undefined && { status: input.status.trim() }),
        version: { increment: 1 },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    const result: CardDTO = {
      id: updated.id,
      boardId: updated.boardId,
      listId: updated.listId,
      ownerId: updated.ownerId,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      rank: updated.rank,
      sortOrder: updated.sortOrder,
      version: updated.version,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      owner: updated.owner
        ? {
            id: updated.owner.id,
            name: updated.owner.name,
            username: updated.owner.username,
            profilePicture: updated.owner.profilePicture,
          }
        : undefined,
    };

    await publishCardEvent({
      type: 'card.updated',
      op: 'card.updated',
      boardId: updated.boardId,
      listId: updated.listId,
      actorId: userId,
      card: result,
    });

    return result;
  }

  /**
   * Delete a card from a list
   */
  async deleteCard(userId: number, cardId: number): Promise<boolean> {
    const existing = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, boardId: true, listId: true, ownerId: true },
    });

    if (!existing) {
      throw new Error(`Card with ID ${cardId} not found.`);
    }

    const access = await this.evaluateCardHybridAccess(userId, existing.boardId, existing.ownerId);
    if (!access.canDelete) {
      throw new Error('Forbidden. You do not have permission to delete this card.');
    }

    await prisma.card.delete({
      where: { id: cardId },
    });

    await publishCardEvent({
      type: 'card.deleted',
      op: 'card.deleted',
      boardId: existing.boardId,
      listId: existing.listId,
      cardId,
      actorId: userId,
    });

    return true;
  }

  /**
   * Move a card (reordering within list or moving across lists) using fractional indexing.
   * Follows docs/KANBAN_ORDERING.md:
   * - Intent-based move payload (previousCardId, nextCardId)
   * - Atomic single-row mutation with version increment
   * - Auto rebalancing when rank string length exceeds 64 characters
   */
  async moveCard(userId: number, input: MoveCardInput): Promise<CardDTO> {
    const { cardId, targetListId, previousCardId, nextCardId } = input;

    // Load card to get boardId
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, boardId: true, listId: true, ownerId: true, version: true },
    });

    if (!card) {
      throw new Error(`Card with ID ${cardId} not found.`);
    }

    const access = await this.evaluateCardHybridAccess(userId, card.boardId, card.ownerId);
    if (!access.canUpdate) {
      throw new Error('Forbidden. You do not have permission to move cards on this board.');
    }

    // Verify target list
    const targetList = await prisma.list.findUnique({
      where: { id: targetListId },
      select: { id: true, boardId: true },
    });

    if (!targetList || targetList.boardId !== card.boardId) {
      throw new Error('Target list does not exist on this board.');
    }

    const sourceListId = card.listId;

    // Execute atomic move in Prisma transaction
    const updatedCard = await prisma.$transaction(async (tx) => {
      // Load fresh neighbors in target list
      let prevRank: string | null = null;
      let nextRank: string | null = null;

      if (previousCardId) {
        const prevCard = await tx.card.findUnique({
          where: { id: previousCardId },
          select: { rank: true, listId: true },
        });
        if (prevCard && prevCard.listId === targetListId) {
          prevRank = prevCard.rank;
        }
      }

      if (nextCardId) {
        const nxtCard = await tx.card.findUnique({
          where: { id: nextCardId },
          select: { rank: true, listId: true },
        });
        if (nxtCard && nxtCard.listId === targetListId) {
          nextRank = nxtCard.rank;
        }
      }

      // Safety check: if prevRank >= nextRank (e.g. historical collation inversion),
      // rebalance target list cards first to guarantee strictly increasing ranks
      if (prevRank && nextRank && prevRank >= nextRank) {
        const allCardsInList = await tx.card.findMany({
          where: { listId: targetListId },
          orderBy: [{ rank: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });
        const rebalancedKeys = generateNKeysBetween(null, null, allCardsInList.length);
        for (let i = 0; i < allCardsInList.length; i++) {
          await tx.card.update({
            where: { id: allCardsInList[i].id },
            data: { rank: rebalancedKeys[i] },
          });
        }
        const prevIdx = allCardsInList.findIndex((c) => c.id === previousCardId);
        prevRank = prevIdx !== -1 ? rebalancedKeys[prevIdx] : null;
        const nextIdx = allCardsInList.findIndex((c) => c.id === nextCardId);
        nextRank = nextIdx !== -1 ? rebalancedKeys[nextIdx] : null;
      }

      // Generate new key between neighbors
      const newRank = generateKeyBetween(prevRank, nextRank);

      // Single-row mutation: update listId, rank, and increment version
      const updated = await tx.card.update({
        where: { id: cardId },
        data: {
          listId: targetListId,
          rank: newRank,
          version: { increment: 1 },
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
              profilePicture: true,
            },
          },
        },
      });

      // Occasional rebalancing if rank length exceeds threshold (> 64 characters)
      if (newRank.length > 64) {
        const allCardsInList = await tx.card.findMany({
          where: { listId: targetListId },
          orderBy: [{ rank: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });

        const rebalancedKeys = generateNKeysBetween(null, null, allCardsInList.length);
        for (let i = 0; i < allCardsInList.length; i++) {
          await tx.card.update({
            where: { id: allCardsInList[i].id },
            data: { rank: rebalancedKeys[i] },
          });
        }
        updated.rank = rebalancedKeys[allCardsInList.findIndex((c) => c.id === cardId)];
      }

      return updated;
    });

    const result: CardDTO = {
      id: updatedCard.id,
      boardId: updatedCard.boardId,
      listId: updatedCard.listId,
      ownerId: updatedCard.ownerId,
      title: updatedCard.title,
      description: updatedCard.description,
      status: updatedCard.status,
      rank: updatedCard.rank,
      sortOrder: updatedCard.sortOrder,
      version: updatedCard.version,
      createdAt: updatedCard.createdAt.toISOString(),
      updatedAt: updatedCard.updatedAt.toISOString(),
      owner: updatedCard.owner
        ? {
            id: updatedCard.owner.id,
            name: updatedCard.owner.name,
            username: updatedCard.owner.username,
            profilePicture: updatedCard.owner.profilePicture,
          }
        : undefined,
    };

    await publishCardEvent({
      type: 'card.moved',
      op: 'card.moved',
      boardId: card.boardId,
      cardId,
      sourceListId,
      targetListId,
      rank: result.rank,
      version: result.version,
      previousCardId,
      nextCardId,
      actorId: userId,
      card: result,
    });

    return result;
  }
}

export const cardService = new CardService();

