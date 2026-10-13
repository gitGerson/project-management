import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import type {
  ListDTO,
  CreateListInput,
  UpdateListInput,
  ListPermissionsDTO,
} from '../types';

export class ListService {
  /**
   * Evaluates hybrid access rules combining global RBAC permissions and contextual board membership.
   */
  async evaluateHybridAccess(
    userId: number,
    boardId: number
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
        hasPermission(userId, PERMISSIONS.LISTS_CREATE),
        hasPermission(userId, PERMISSIONS.LISTS_READ),
        hasPermission(userId, PERMISSIONS.LISTS_UPDATE),
        hasPermission(userId, PERMISSIONS.LISTS_DELETE),
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

    // Board Owner has full control over their board's lists
    if (isOwner) {
      return {
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        memberRole: 'owner',
      };
    }

    // Standard board member access (enforced by RBAC permissions)
    if (isMember) {
      return {
        canRead: hasReadPerm || true, // Members can always view their board
        canCreate: hasCreatePerm,
        canUpdate: hasUpdatePerm,
        canDelete: hasDeletePerm,
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
   * Get list permissions for the current user in a specific board
   */
  async getBoardListPermissions(userId: number, boardId: number): Promise<ListPermissionsDTO> {
    const access = await this.evaluateHybridAccess(userId, boardId);
    return {
      canCreate: access.canCreate,
      canUpdate: access.canUpdate,
      canDelete: access.canDelete,
    };
  }

  /**
   * Generates a unique list code within a board (replicates v1 KanbanListMutationService logic).
   */
  async resolveCode(
    boardId: number,
    name: string,
    providedCode?: string | null,
    ignoreId?: number | null
  ): Promise<string> {
    const raw = (providedCode?.trim() || name.trim())
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '_')
      .toUpperCase();
    const base = raw.length > 0 ? raw.slice(0, 80) : 'LIST';

    let code = base;
    let suffix = 2;

    while (true) {
      const existing = await prisma.list.findFirst({
        where: {
          boardId,
          code,
          ...(ignoreId ? { id: { not: ignoreId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        break;
      }

      code = `${base}_${suffix}`;
      suffix++;
    }

    return code;
  }

  /**
   * Fetch all lists for a specific board ordered by position
   */
  async getListsByBoardId(boardId: number, userId: number, includeInactive = false): Promise<ListDTO[]> {
    const access = await this.evaluateHybridAccess(userId, boardId);
    if (!access.canRead) {
      throw new Error('Forbidden. You do not have access to view lists on this board.');
    }

    const lists = await prisma.list.findMany({
      where: {
        boardId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { position: 'asc' },
    });

    return lists.map((l) => ({
      id: l.id,
      boardId: l.boardId,
      title: l.title,
      name: l.title,
      code: l.code,
      position: l.position,
      sortOrder: l.position,
      isActive: l.isActive,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }));
  }

  /**
   * Create a new list in a board
   */
  async createList(userId: number, input: CreateListInput): Promise<ListDTO> {
    const access = await this.evaluateHybridAccess(userId, input.boardId);
    if (!access.canCreate) {
      throw new Error('Forbidden. You do not have permission to create lists on this board.');
    }

    let position = input.position;
    if (position === undefined) {
      const highestPositionList = await prisma.list.findFirst({
        where: { boardId: input.boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (highestPositionList?.position ?? 0) + 65536;
    }

    const code = await this.resolveCode(input.boardId, input.title, input.code);

    const list = await prisma.list.create({
      data: {
        boardId: input.boardId,
        title: input.title.trim(),
        code,
        position,
        isActive: input.isActive ?? true,
      },
    });

    return {
      id: list.id,
      boardId: list.boardId,
      title: list.title,
      name: list.title,
      code: list.code,
      position: list.position,
      sortOrder: list.position,
      isActive: list.isActive,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    };
  }

  /**
   * Update a list's title, code, position, or active status
   */
  async updateList(userId: number, listId: number, input: UpdateListInput): Promise<ListDTO> {
    const existing = await prisma.list.findUnique({
      where: { id: listId },
      select: { id: true, boardId: true, title: true, code: true },
    });

    if (!existing) {
      throw new Error(`List with ID ${listId} not found.`);
    }

    const access = await this.evaluateHybridAccess(userId, existing.boardId);
    if (!access.canUpdate) {
      throw new Error('Forbidden. You do not have permission to edit this list.');
    }

    let nextCode: string | undefined = undefined;
    if (input.code !== undefined && input.code.trim() !== '') {
      nextCode = await this.resolveCode(existing.boardId, input.title ?? existing.title, input.code, listId);
    }

    const updated = await prisma.list.update({
      where: { id: listId },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(nextCode !== undefined && { code: nextCode }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    return {
      id: updated.id,
      boardId: updated.boardId,
      title: updated.title,
      name: updated.title,
      code: updated.code,
      position: updated.position,
      sortOrder: updated.position,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Delete a list from a board
   */
  async deleteList(userId: number, listId: number): Promise<boolean> {
    const existing = await prisma.list.findUnique({
      where: { id: listId },
      select: { id: true, boardId: true },
    });

    if (!existing) {
      throw new Error(`List with ID ${listId} not found.`);
    }

    const access = await this.evaluateHybridAccess(userId, existing.boardId);
    if (!access.canDelete) {
      throw new Error('Forbidden. You do not have permission to delete this list.');
    }

    await prisma.list.delete({
      where: { id: listId },
    });

    return true;
  }
}

export const listService = new ListService();

