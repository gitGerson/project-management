import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getUserPermissions, getUserRoles } from '@/lib/access';
import { authService } from '@/modules/auth/services/auth.service';
import { boardService } from '@/modules/boards/services/board.service';
import { boardMemberService } from '@/modules/board-members/services/board-member.service';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { ChatProvider, ChatDrawer } from '@/modules/chat';
import { BoardDetailHeader } from '@/modules/boards/components/BoardDetailHeader';
import { listService } from '@/modules/lists/services/list.service';
import { BoardKanbanView } from '@/modules/lists';
import { cardService } from '@/modules/cards/services/card.service';

export const instant = false;

interface BoardPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function BoardDetailPage({ params }: BoardPageProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { slug } = await params;

  const [user, permissions, roles, board] = await Promise.all([
    authService.getUserById(session.userId),
    getUserPermissions(session.userId),
    getUserRoles(session.userId),
    boardService.getBoardBySlug(slug, session.userId),
  ]);

  if (!board) {
    notFound();
  }

  // Authorization check: User must have BOARDS_VIEW_ALL or be an assigned member of this board
  const hasViewAll = permissions.includes(PERMISSIONS.BOARDS_VIEW_ALL);
  const isMember = await boardMemberService.isBoardMember(board.id, session.userId);
  const canView = hasViewAll || isMember;

  if (!canView) {
    return (
      <div className="min-h-screen bg-[#f4f5fa] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-200/90 p-8 sm:p-10 max-w-md w-full text-center shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <ShieldAlert className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1.5">
            Access Denied
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
            Sorry, you do not have permission to access or view this board.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Boards</span>
          </Link>
        </div>
      </div>
    );
  }

  const [members, lists, listPermissions, cards, cardPermissions] = await Promise.all([
    boardMemberService.listMembersByBoardId(board.id),
    listService.getListsByBoardId(board.id, session.userId),
    listService.getBoardListPermissions(session.userId, board.id),
    cardService.getCardsByBoardId(board.id, session.userId),
    cardService.getBoardCardPermissions(session.userId, board.id),
  ]);

  const canEdit =
    permissions.includes(PERMISSIONS.BOARDS_UPDATE) ||
    board.currentUserRole === 'owner';
  const canDelete =
    permissions.includes(PERMISSIONS.BOARDS_DELETE) ||
    board.currentUserRole === 'owner';

  const userWithRoles = user ? { ...user, roles } : null;

  return (
    <ChatProvider>
      <div className="min-h-screen bg-[#f4f5fa] flex flex-col selection:bg-green-100 selection:text-green-800">
        {/* Top Board Specific Header */}
        <BoardDetailHeader
          board={board}
          members={members}
          user={userWithRoles}
          canEdit={canEdit}
          canDelete={canDelete}
        />

        {/* Board Main Canvas (Kanban List Columns) */}
        <main className="flex-1 flex flex-col w-full overflow-hidden">
          <BoardKanbanView
            boardId={board.id}
            initialLists={lists}
            permissions={listPermissions}
            initialCards={cards}
            cardPermissions={cardPermissions}
          />
        </main>

        {/* Global Slide-Over Live Chat Drawer for collaboration */}
        <ChatDrawer />
      </div>
    </ChatProvider>
  );
}
