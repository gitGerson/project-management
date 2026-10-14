import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { publishCardEvent } from './card-publisher';
import { parseCommentContent } from '@/modules/chat/utils/comment-parser';
import type {
  CardDTO,
  CardAttachmentDTO,
  CreateCardAttachmentInput,
  CreateCardInput,
  UpdateCardInput,
  MoveCardInput,
  CardPermissionsDTO,
} from '../types';

export const CARD_DEFAULT_INCLUDE = {
  owner: {
    select: {
      id: true,
      name: true,
      username: true,
      profilePicture: true,
    },
  },
  cardLabels: {
    include: {
      label: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  members: {
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
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  attachments: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          profilePicture: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
};

export type CardWithRelations = Prisma.CardGetPayload<{
  include: typeof CARD_DEFAULT_INCLUDE;
}>;

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
    const [hasViewAll, hasCreatePerm, , hasUpdatePerm, hasDeletePerm, member] =
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
   * Helper to map Prisma card with owner and cardLabels to CardDTO
   */
  mapCardToDTO(card: CardWithRelations): CardDTO {
    return {
      id: card.id,
      boardId: card.boardId,
      listId: card.listId,
      ownerId: card.ownerId,
      title: card.title,
      description: card.description,
      status: card.status,
      rank: card.rank,
      sortOrder: card.sortOrder,
      coverUrl: card.coverUrl || null,
      startDate: card.startDate
        ? card.startDate instanceof Date
          ? card.startDate.toISOString()
          : card.startDate
        : null,
      dueDate: card.dueDate
        ? card.dueDate instanceof Date
          ? card.dueDate.toISOString()
          : card.dueDate
        : null,
      version: card.version,
      createdAt: card.createdAt instanceof Date ? card.createdAt.toISOString() : card.createdAt,
      updatedAt: card.updatedAt instanceof Date ? card.updatedAt.toISOString() : card.updatedAt,
      owner: card.owner
        ? {
            id: card.owner.id,
            name: card.owner.name,
            username: card.owner.username,
            profilePicture: card.owner.profilePicture,
          }
        : undefined,
      labels: card.cardLabels
        ? card.cardLabels.map((cl) => ({
            id: cl.label.id,
            boardId: cl.label.boardId,
            title: cl.label.title,
            color: cl.label.color,
          }))
        : [],
      members: card.members
        ? card.members.map((cm) => ({
            id: cm.id,
            cardId: cm.cardId,
            userId: cm.userId,
            createdAt: cm.createdAt instanceof Date ? cm.createdAt.toISOString() : cm.createdAt,
            user: {
              id: cm.user.id,
              name: cm.user.name,
              username: cm.user.username,
              email: cm.user.email,
              profilePicture: cm.user.profilePicture,
            },
          }))
        : [],
      attachments: (card as unknown as { attachments?: Array<{
        id: number;
        cardId: number;
        userId: number;
        fileName: string;
        fileUrl: string;
        fileSize: number;
        fileType: string;
        createdAt: Date | string;
        updatedAt: Date | string;
        user?: { id: number; name: string; username: string; profilePicture: string | null };
      }> }).attachments
        ? ((card as unknown as { attachments: Array<{
            id: number;
            cardId: number;
            userId: number;
            fileName: string;
            fileUrl: string;
            fileSize: number;
            fileType: string;
            createdAt: Date | string;
            updatedAt: Date | string;
            user?: { id: number; name: string; username: string; profilePicture: string | null };
          }> }).attachments).map((att) => ({
            id: att.id,
            cardId: att.cardId,
            userId: att.userId,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileSize: att.fileSize,
            fileType: att.fileType,
            createdAt: att.createdAt instanceof Date ? att.createdAt.toISOString() : String(att.createdAt),
            updatedAt: att.updatedAt instanceof Date ? att.updatedAt.toISOString() : String(att.updatedAt),
            user: att.user
              ? {
                  id: att.user.id,
                  name: att.user.name,
                  username: att.user.username,
                  profilePicture: att.user.profilePicture,
                }
              : undefined,
          }))
        : [],
    };
  }

  /**
   * Fetch a single card by ID with owner and labels
   */
  async getCardById(cardId: number): Promise<CardDTO | null> {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: CARD_DEFAULT_INCLUDE,
    });

    return card ? this.mapCardToDTO(card) : null;
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
      include: CARD_DEFAULT_INCLUDE,
      orderBy: [{ rank: 'asc' }, { id: 'asc' }],
    });

    return cards.map((c) => this.mapCardToDTO(c));
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
        startDate: input.startDate ? new Date(input.startDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        coverUrl: input.coverUrl ? input.coverUrl.trim() : null,
        status: 'active',
        rank: newRank,
        version: 1,
      },
      include: CARD_DEFAULT_INCLUDE,
    });

    const result = this.mapCardToDTO(card);

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

    if (input.ownerId !== undefined && input.ownerId !== existing.ownerId) {
      const isCardMember = await prisma.cardMember.findUnique({
        where: {
          card_members_card_id_user_id_unique: {
            cardId,
            userId: input.ownerId,
          },
        },
      });

      if (!isCardMember) {
        throw new Error('Selected owner must be an assigned member of this card.');
      }
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && {
          description: input.description ? input.description.trim() : null,
        }),
        ...(input.coverUrl !== undefined && {
          coverUrl: input.coverUrl ? input.coverUrl.trim() : null,
        }),
        ...(input.status !== undefined && { status: input.status.trim() }),
        ...(input.startDate !== undefined && {
          startDate: input.startDate ? new Date(input.startDate) : null,
        }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        }),
        ...(input.ownerId !== undefined && { ownerId: input.ownerId }),
        version: { increment: 1 },
      },
      include: CARD_DEFAULT_INCLUDE,
    });

    if (input.description !== undefined && input.description) {
      await this.syncCardAttachmentsFromContent(cardId);
    }

    const fullUpdatedCard =
      input.description !== undefined && input.description
        ? await this.getCardById(cardId)
        : null;

    const result = fullUpdatedCard || this.mapCardToDTO(updated);

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
        include: CARD_DEFAULT_INCLUDE,
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

    const result = this.mapCardToDTO(updatedCard);

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

  /**
   * Add an attachment to a card
   */
  async addAttachment(
    userId: number,
    input: CreateCardAttachmentInput
  ): Promise<CardAttachmentDTO> {
    const card = await prisma.card.findUnique({
      where: { id: input.cardId },
      select: { id: true, boardId: true, ownerId: true },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    const access = await this.evaluateCardHybridAccess(userId, card.boardId, card.ownerId);
    if (!access.canUpdate) {
      throw new Error('Forbidden. You do not have permission to attach files to this card.');
    }

    const attachment = await prisma.cardAttachment.create({
      data: {
        cardId: input.cardId,
        userId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileSize: input.fileSize,
        fileType: input.fileType,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            profilePicture: true,
          },
        },
      },
    });

    const attachmentDTO: CardAttachmentDTO = {
      id: attachment.id,
      cardId: attachment.cardId,
      userId: attachment.userId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileSize: attachment.fileSize,
      fileType: attachment.fileType,
      createdAt: attachment.createdAt.toISOString(),
      updatedAt: attachment.updatedAt.toISOString(),
      user: attachment.user
        ? {
            id: attachment.user.id,
            name: attachment.user.name,
            username: attachment.user.username,
            profilePicture: attachment.user.profilePicture,
          }
        : undefined,
    };

    // Re-fetch and broadcast card updated event
    const fullCard = await this.getCardById(card.id);
    if (fullCard) {
      await publishCardEvent({
        type: 'card.updated',
        op: 'card.updated',
        boardId: card.boardId,
        listId: fullCard.listId,
        actorId: userId,
        card: fullCard,
      });
    }

    return attachmentDTO;
  }

  /**
   * Delete an attachment from a card
   */
  async deleteAttachment(
    userId: number,
    cardId: number,
    attachmentId: number
  ): Promise<boolean> {
    const attachment = await prisma.cardAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        card: {
          select: { id: true, boardId: true, ownerId: true },
        },
      },
    });

    if (!attachment || attachment.cardId !== cardId) {
      throw new Error('Attachment not found');
    }

    const access = await this.evaluateCardHybridAccess(
      userId,
      attachment.card.boardId,
      attachment.card.ownerId
    );

    const isAttachmentOwner = attachment.userId === userId;
    if (!access.canDelete && !access.canUpdate && !isAttachmentOwner) {
      throw new Error('Forbidden. You do not have permission to delete this attachment.');
    }

    await prisma.cardAttachment.delete({
      where: { id: attachmentId },
    });

    // If the deleted attachment was embedded in the description, remove its HTML tag
    const cardRecord = await prisma.card.findUnique({
      where: { id: cardId },
      select: { description: true },
    });
    if (cardRecord?.description && cardRecord.description.includes(attachment.fileUrl)) {
      let updatedDesc = cardRecord.description;
      const escapedUrl = attachment.fileUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const imgRegex = new RegExp(`<img\\b[^>]*src=["']${escapedUrl}["'][^>]*\\/?>`, 'gi');
      updatedDesc = updatedDesc.replace(imgRegex, '');
      const linkRegex = new RegExp(`<a\\b[^>]*href=["']${escapedUrl}["'][^>]*>[\\s\\S]*?<\\/a>`, 'gi');
      updatedDesc = updatedDesc.replace(linkRegex, '');
      updatedDesc = updatedDesc.replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '').trim();

      await prisma.card.update({
        where: { id: cardId },
        data: { description: updatedDesc || null },
      });
    }

    // Re-fetch and broadcast card updated event
    const fullCard = await this.getCardById(cardId);
    if (fullCard) {
      await publishCardEvent({
        type: 'card.updated',
        op: 'card.updated',
        boardId: attachment.card.boardId,
        listId: fullCard.listId,
        actorId: userId,
        card: fullCard,
      });
    }

    return true;
  }

  /**
   * Sync and extract any attachments uploaded in card description or comments
   * that do not yet exist in the card_attachments table.
   */
  async syncCardAttachmentsFromContent(cardId: number): Promise<void> {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, ownerId: true, description: true },
    });
    if (!card) return;

    const existingAttachments = await prisma.cardAttachment.findMany({
      where: { cardId },
      select: { fileUrl: true },
    });
    const seenUrls = new Set(existingAttachments.map((a) => a.fileUrl));

    const itemsToCreate: Array<{
      cardId: number;
      userId: number;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      fileType: string;
    }> = [];

    // 1. Extract from description
    if (card.description) {
      // 1a. Images in description: <img ... src="..." ...>
      const imgRegex = /<img\b[^>]*src=["']([^"']+)["'][^>]*\/?>/gi;
      let imgMatch: RegExpExecArray | null;
      while ((imgMatch = imgRegex.exec(card.description)) !== null) {
        const fullTag = imgMatch[0];
        const src = imgMatch[1];
        if (src && !seenUrls.has(src)) {
          seenUrls.add(src);
          const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
          const rawFileName = altMatch && altMatch[1] ? altMatch[1].trim() : '';
          const urlFileName = src.split('/').pop()?.split('?')[0] || '';
          const cleanName = rawFileName || urlFileName || 'image.png';

          itemsToCreate.push({
            cardId,
            userId: card.ownerId,
            fileName: cleanName,
            fileUrl: src,
            fileSize: 0,
            fileType: 'image/png',
          });
        }
      }

      // 1b. Files in description: <a ... href="..." ...>📎 FileName (Size)</a>
      const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkRegex.exec(card.description)) !== null) {
        const href = linkMatch[1];
        const linkText = linkMatch[2] ? linkMatch[2].replace(/<[^>]+>/g, '').trim() : '';
        if (href && !seenUrls.has(href)) {
          const isAttachment =
            linkMatch[0].includes('attachment-file-badge') ||
            href.includes('card-attachments') ||
            href.includes('/uploads/') ||
            href.includes('/chat/upload');

          if (isAttachment) {
            seenUrls.add(href);
            let fileName = href.split('/').pop()?.split('?')[0] || 'attachment';
            let fileSize = 0;
            const textMatch = linkText.match(/📎\s*(.*?)\s*(?:\((.*?)\))?$/);
            if (textMatch) {
              if (textMatch[1]) fileName = textMatch[1].trim();
              if (textMatch[2]) {
                const sizeStr = textMatch[2].toUpperCase().trim();
                const num = parseFloat(sizeStr);
                if (!isNaN(num)) {
                  if (sizeStr.includes('GB')) fileSize = Math.round(num * 1024 * 1024 * 1024);
                  else if (sizeStr.includes('MB')) fileSize = Math.round(num * 1024 * 1024);
                  else if (sizeStr.includes('KB')) fileSize = Math.round(num * 1024);
                  else fileSize = Math.round(num);
                }
              }
            }

            const ext = fileName.split('.').pop()?.toLowerCase();
            let fileType = 'application/octet-stream';
            if (ext === 'pdf') fileType = 'application/pdf';
            else if (ext === 'xlsx' || ext === 'xls')
              fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            else if (ext === 'docx' || ext === 'doc')
              fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            else if (ext === 'zip' || ext === '7z' || ext === 'rar') fileType = 'application/zip';
            else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || ''))
              fileType = `image/${ext}`;

            itemsToCreate.push({
              cardId,
              userId: card.ownerId,
              fileName,
              fileUrl: href,
              fileSize,
              fileType,
            });
          }
        }
      }
    }

    // 2. Extract from comments
    const comments = await prisma.comment.findMany({
      where: { commentableType: 'card', commentableId: cardId },
      select: { id: true, userId: true, content: true },
    });

    for (const cm of comments) {
      const parsed = parseCommentContent(cm.content);
      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const att of parsed.attachments) {
          if (att.url && !seenUrls.has(att.url)) {
            seenUrls.add(att.url);
            itemsToCreate.push({
              cardId,
              userId: cm.userId,
              fileName: att.fileName || 'attachment',
              fileUrl: att.url,
              fileSize: att.fileSize || 0,
              fileType: att.mimeType || (att.isImage ? 'image/png' : 'application/octet-stream'),
            });
          }
        }
      }
    }

    // 3. Batch insert new items if any
    if (itemsToCreate.length > 0) {
      for (const item of itemsToCreate) {
        await prisma.cardAttachment.create({
          data: item,
        });
      }
    }
  }
}

export const cardService = new CardService();

