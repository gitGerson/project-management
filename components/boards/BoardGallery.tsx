'use client';

import React, { useState } from 'react';
import { Lock, Kanban } from 'lucide-react';
import { BoardCard, type BoardData } from './BoardCard';
import { CreateBoardCard } from './CreateBoardCard';
import { CreateBoardModal } from './CreateBoardModal';
import { BoardModal } from './BoardModal';
import { deleteBoardAction } from '@/modules/boards/actions';
import { PERMISSIONS } from '@/modules/rbac/constants';
import type { BoardDTO } from '@/modules/boards/types';

interface BoardGalleryProps {
  initialBoards: BoardDTO[];
  permissions?: string[];
}

export function BoardGallery({ initialBoards, permissions }: BoardGalleryProps) {
  const [boards, setBoards] = useState<BoardData[]>(initialBoards);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<BoardData | null>(null);

  const canRead = permissions
    ? permissions.includes(PERMISSIONS.BOARDS_READ) || permissions.includes(PERMISSIONS.BOARDS_VIEW_ALL)
    : true;
  const canCreate = permissions ? permissions.includes(PERMISSIONS.BOARDS_CREATE) : true;
  const canEdit = permissions ? permissions.includes(PERMISSIONS.BOARDS_UPDATE) : true;
  const canDelete = permissions ? permissions.includes(PERMISSIONS.BOARDS_DELETE) : true;

  const handleTogglePin = (id: number) => {
    setBoards((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isPinned: !b.isPinned } : b))
    );
  };

  const handleBoardCreated = (newBoard: BoardDTO) => {
    setBoards((prev) => [newBoard, ...prev]);
  };

  const handleDeleteBoard = async (id: number) => {
    const target = boards.find((b) => b.id === id);
    if (!target) return;

    if (!confirm(`Are you sure you want to delete board "${target.name}"?`)) {
      return;
    }

    // Optimistic removal
    setBoards((prev) => prev.filter((b) => b.id !== id));

    try {
      const res = await deleteBoardAction(id);
      if (!res.success) {
        alert(res.message || 'Failed to delete board');
        // Rollback
        setBoards((prev) => [...prev, target]);
      }
    } catch {
      alert('Error deleting board');
      setBoards((prev) => [...prev, target]);
    }
  };

  const handleOpenBoard = (board: BoardData) => {
    setSelectedBoard(board);
  };

  const handleBoardUpdated = (updated: BoardDTO) => {
    setBoards((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
    );
    setSelectedBoard((prev) =>
      prev && prev.id === updated.id ? { ...prev, ...updated } : prev
    );
  };

  // RBAC guard: User lacks boards.read or boards.view_all permission
  if (!canRead) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/90 p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs my-8">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto mb-3 shadow-2xs">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
          Board Access Restricted
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed">
          You do not have permission to view workspace boards. Contact your administrator to request access.
        </p>
      </div>
    );
  }

  // Empty state when user has read access but no boards exist and cannot create
  if (boards.length === 0 && !canCreate) {
    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/90 p-8 sm:p-12 text-center max-w-md mx-auto shadow-xs my-8">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
          <Kanban className="w-5 h-5 text-gray-500" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
          No Boards Available
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          There are currently no active boards assigned to your account.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {boards.map((board) => {
          const isBoardEditable = canEdit || board.currentUserRole === 'owner' || Boolean(board.canEdit);
          return (
            <BoardCard
              key={board.id}
              board={board}
              onTogglePin={handleTogglePin}
              onOpen={handleOpenBoard}
              canView={canRead}
              canEdit={isBoardEditable}
            />
          );
        })}

        {/* Create new board dashed card matching reference image - only if user has boards.create */}
        {canCreate && (
          <CreateBoardCard onClick={() => setIsCreateModalOpen(true)} />
        )}
      </div>

      {/* Dedicated Create Board Modal */}
      {canCreate && (
        <CreateBoardModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleBoardCreated}
        />
      )}

      {/* Board View & Inline Edit Modal */}
      {selectedBoard && (
        <BoardModal
          isOpen={Boolean(selectedBoard)}
          onClose={() => setSelectedBoard(null)}
          board={selectedBoard}
          canEdit={canEdit || selectedBoard.currentUserRole === 'owner' || Boolean(selectedBoard.canEdit)}
          canDelete={canDelete || selectedBoard.currentUserRole === 'owner'}
          onUpdate={handleBoardUpdated}
          onDelete={handleDeleteBoard}
        />
      )}
    </>
  );
}

