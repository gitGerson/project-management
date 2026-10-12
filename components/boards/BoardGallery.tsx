'use client';

import React, { useState } from 'react';
import { BoardCard, type BoardData } from './BoardCard';
import { CreateBoardCard } from './CreateBoardCard';
import { CreateBoardModal } from './CreateBoardModal';
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

  const canCreate = permissions ? permissions.includes(PERMISSIONS.BOARDS_CREATE) : true;
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

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {/* Render all existing board cards */}
        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            onTogglePin={handleTogglePin}
            onDelete={canDelete ? handleDeleteBoard : undefined}
          />
        ))}

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
    </>
  );
}

