import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/access';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { boardService } from '@/modules/boards/services/board.service';
import { cardService } from '@/modules/cards/services/card.service';
import { decodeCardHash } from '@/modules/cards';

export const instant = false;

interface CardShareRouteProps {
  params: Promise<{
    hash: string;
  }>;
}

export default async function CardShareRoute({ params }: CardShareRouteProps) {
  const { hash } = await params;
  const cardId = decodeCardHash(hash);

  if (!cardId) {
    notFound();
  }

  // Enforce authentication
  const session = await getSession();
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/c/${hash}`)}`);
  }

  // Lookup target card
  const card = await cardService.getCardById(cardId);
  if (!card) {
    notFound();
  }

  // Lookup board and check user authorization
  const [board, permissions] = await Promise.all([
    boardService.getBoardById(card.boardId, session.userId),
    getUserPermissions(session.userId),
  ]);

  if (!board) {
    notFound();
  }

  const hasViewAll = permissions.includes(PERMISSIONS.BOARDS_VIEW_ALL);
  const isMember = Boolean(board.currentUserRole);

  if (!hasViewAll && !isMember) {
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
            Sorry, you do not have permission to access or view this card.
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

  // Redirect to the board with card modal open
  redirect(`/board/${board.slug}?cardId=${card.id}`);
}

