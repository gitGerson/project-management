import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { boardMemberService } from '@/modules/board-members/services/board-member.service';
import { publishCommentEvent } from './realtime-publisher';
import { parseCommentContent, serializeCommentContent, stripHtml } from '../utils/comment-parser';
import type {
  ChatGroupDTO,
  CommentDTO,
  SendCommentInput,
  ScopeType,
  MentionUserDTO,
} from '../types';

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

      let lastCommentSnippet = '';
      if (last) {
        const parsed = parseCommentContent(last.content);
        const textOnly = stripHtml(parsed.cleanContent);
        if (textOnly) {
          lastCommentSnippet = textOnly;
        } else if (parsed.attachments.length > 0) {
          lastCommentSnippet = parsed.attachments[0].isImage ? '[Gambar]' : '[Lampiran]';
        } else {
          lastCommentSnippet = 'Pesan';
        }
      }

      groups.push({
        id: `board:${board.id}`,
        scopeType: 'board',
        scopeId: board.id,
        title: board.name,
        subtitle: 'Board Group Chat',
        image: board.image,
        lastComment: last
          ? {
              content: lastCommentSnippet,
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

    return comments.map((c) => {
      const parsed = parseCommentContent(c.content);
      return {
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
        content: parsed.cleanContent,
        rawContent: c.content,
        replyTo: parsed.replyTo,
        attachments: parsed.attachments,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });
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

    const rawText = input.content ? input.content.trim() : '';
    const hasAttachments = Boolean(input.attachments && input.attachments.length > 0);

    if (!rawText && !hasAttachments) {
      throw new Error('Message content or attachment cannot be empty.');
    }

    const serializedContent = serializeCommentContent({
      content: rawText,
      replyTo: input.replyTo,
      attachments: input.attachments,
    });

    const comment = await prisma.comment.create({
      data: {
        commentableType: canonicalScope,
        commentableId: input.commentableId,
        userId,
        content: serializedContent,
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

    const parsed = parseCommentContent(comment.content);

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
      content: parsed.cleanContent,
      rawContent: comment.content,
      replyTo: parsed.replyTo,
      attachments: parsed.attachments,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      tempId: input.tempId,
    };

    // Broadcast in background via Redis to WebSocket subscribers
    await publishCommentEvent(canonicalScope, input.commentableId, dto);

    return dto;
  }

  /**
   * List users that can be mentioned in the given chat scope
   */
  async listMentionCandidates(scopeType: string, scopeId: number): Promise<MentionUserDTO[]> {
    const canonicalScope = normalizeScopeType(scopeType);

    if (canonicalScope === 'board') {
      const members = await prisma.boardMember.findMany({
        where: { boardId: scopeId },
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

      return members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        username: m.user.username,
        profilePicture: m.user.profilePicture,
        initials: getInitials(m.user.name),
      }));
    }

    // Default: fetch active users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        profilePicture: true,
      },
      take: 50,
      orderBy: { name: 'asc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      profilePicture: u.profilePicture,
      initials: getInitials(u.name),
    }));
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
