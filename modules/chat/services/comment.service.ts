import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { boardMemberService } from '@/modules/board-members/services/board-member.service';
import { publishCommentEvent } from './realtime-publisher';
import type { ChatGroupDTO, CommentDTO, SendCommentInput, ScopeType } from '../types';

export function normalizeScopeType(type: string): ScopeType {
  const lower = type.toLowerCase().trim();
  if (lower.includes('card')) return 'card';
  if (lower.includes('checklist')) return 'checklist';
  return 'board';
}

export function getMorphTypes(scopeType: string): string[] {
  const norm = normalizeScopeType(scopeType);
  if (norm === 'board') return ['board', 'App\\Models\\Board'];
  if (norm === 'card') return ['card', 'App\\Models\\Card'];
  if (norm === 'checklist') return ['checklist', 'App\\Models\\Checklist'];
  return [norm];
}

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export class CommentService {
  /**
   * List all chat conversation groups accessible by user (initially Boards, extensible to Cards & Checklists)
   */
  async listUserChatGroups(userId: number): Promise<ChatGroupDTO[]> {
    const hasViewAll = await hasPermission(userId, PERMISSIONS.BOARDS_VIEW_ALL);

    // Fetch accessible boards
    const boards = await prisma.board.findMany({
      where: hasViewAll
        ? undefined
        : {
            members: {
              some: {
                userId,
              },
            },
          },
      select: {
        id: true,
        name: true,
        image: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (boards.length === 0) {
      return [];
    }

    const boardIds = boards.map((b) => b.id);
    const boardMorphs = getMorphTypes('board');

    // Fetch last comment for each board
    const recentComments = await prisma.comment.findMany({
      where: {
        commentableType: { in: boardMorphs },
        commentableId: { in: boardIds },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });

    // Group latest comment by board id
    const latestCommentByBoard = new Map<number, (typeof recentComments)[0]>();
    for (const c of recentComments) {
      if (!latestCommentByBoard.has(c.commentableId)) {
        latestCommentByBoard.set(c.commentableId, c);
      }
    }

    // Fetch user's read receipts
    const readReceipts = await prisma.commentRead.findMany({
      where: {
        userId,
        commentableType: 'board',
        commentableId: { in: boardIds },
      },
    });

    const readMap = new Map<number, Date>();
    for (const r of readReceipts) {
      readMap.set(r.commentableId, r.lastReadAt);
    }

    // Build ChatGroupDTO for each board
    const groups: ChatGroupDTO[] = [];

    for (const board of boards) {
      const last = latestCommentByBoard.get(board.id);
      const lastRead = readMap.get(board.id) || new Date(0);

      // Count unread messages (comments after user's lastReadAt not authored by user)
      const unreadCount = recentComments.filter(
        (c) =>
          c.commentableId === board.id &&
          c.userId !== userId &&
          new Date(c.createdAt).getTime() > lastRead.getTime()
      ).length;

      const groupUpdatedAt = last ? last.createdAt.toISOString() : board.updatedAt.toISOString();

      groups.push({
        id: `board:${board.id}`,
        scopeType: 'board',
        scopeId: board.id,
        title: board.name,
        subtitle: 'Board Group Chat',
        image: board.image,
        lastComment: last
          ? {
              content: last.content,
              authorName: last.user?.name || 'User',
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unreadCount,
        updatedAt: groupUpdatedAt,
      });
    }

    // Sort by most recent activity first
    groups.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return groups;
  }

  /**
   * List comments inside a conversation room
   */
  async listComments(
    scopeType: string,
    scopeId: number,
    userId: number,
    limit = 50
  ): Promise<CommentDTO[]> {
    const canonicalScope = normalizeScopeType(scopeType);

    // Authorization check
    if (canonicalScope === 'board') {
      const hasViewAll = await hasPermission(userId, PERMISSIONS.BOARDS_VIEW_ALL);
      const isMember = await boardMemberService.isBoardMember(scopeId, userId);
      if (!hasViewAll && !isMember) {
        throw new Error('Forbidden. You do not have access to this board chat.');
      }
    }

    const morphTypes = getMorphTypes(canonicalScope);

    const comments = await prisma.comment.findMany({
      where: {
        commentableType: { in: morphTypes },
        commentableId: scopeId,
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
      orderBy: {
        id: 'asc',
      },
      take: limit,
    });

    return comments.map((c) => ({
      id: c.id,
      commentableType: canonicalScope,
      commentableId: c.commentableId,
      userId: c.userId,
      author: {
        id: c.user.id,
        name: c.user.name,
        username: c.user.username,
        profilePicture: c.user.profilePicture,
        initials: getInitials(c.user.name),
      },
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /**
   * Post a new comment / live chat message
   */
  async sendComment(userId: number, input: SendCommentInput): Promise<CommentDTO> {
    const canonicalScope = normalizeScopeType(input.commentableType);

    // Authorization check
    if (canonicalScope === 'board') {
      const hasViewAll = await hasPermission(userId, PERMISSIONS.BOARDS_VIEW_ALL);
      const isMember = await boardMemberService.isBoardMember(input.commentableId, userId);
      if (!hasViewAll && !isMember) {
        throw new Error('Forbidden. You do not have permission to post in this chat.');
      }
    }

    const trimmed = input.content.trim();
    if (!trimmed) {
      throw new Error('Message content cannot be empty.');
    }

    const comment = await prisma.comment.create({
      data: {
        commentableType: canonicalScope,
        commentableId: input.commentableId,
        userId,
        content: trimmed,
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

    // Mark as read immediately for the sender
    await prisma.commentRead.upsert({
      where: {
        userId_commentableType_commentableId: {
          userId,
          commentableType: canonicalScope,
          commentableId: input.commentableId,
        },
      },
      create: {
        userId,
        commentableType: canonicalScope,
        commentableId: input.commentableId,
        lastReadAt: new Date(),
      },
      update: {
        lastReadAt: new Date(),
      },
    });

    const dto: CommentDTO = {
      id: comment.id,
      commentableType: canonicalScope,
      commentableId: comment.commentableId,
      userId: comment.userId,
      author: {
        id: comment.user.id,
        name: comment.user.name,
        username: comment.user.username,
        profilePicture: comment.user.profilePicture,
        initials: getInitials(comment.user.name),
      },
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      tempId: input.tempId,
    };

    // Broadcast in background via Redis to WebSocket subscribers
    await publishCommentEvent(canonicalScope, input.commentableId, dto);

    return dto;
  }

  /**
   * Mark room as read for user
   */
  async markAsRead(userId: number, scopeType: string, scopeId: number): Promise<void> {
    const canonicalScope = normalizeScopeType(scopeType);

    await prisma.commentRead.upsert({
      where: {
        userId_commentableType_commentableId: {
          userId,
          commentableType: canonicalScope,
          commentableId: scopeId,
        },
      },
      create: {
        userId,
        commentableType: canonicalScope,
        commentableId: scopeId,
        lastReadAt: new Date(),
      },
      update: {
        lastReadAt: new Date(),
      },
    });
  }
}

export const commentService = new CommentService();

