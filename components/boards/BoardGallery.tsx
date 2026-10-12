'use client';

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Lock, Kanban } from 'lucide-react';
import { BoardCard, type BoardData } from './BoardCard';
import { CreateBoardCard } from './CreateBoardCard';
import { CreateBoardModal } from './CreateBoardModal';
import { BoardModal } from './BoardModal';
import { deleteBoardAction, togglePinBoardAction } from '@/modules/boards/actions';
import { PERMISSIONS } from '@/modules/rbac/constants';
import type { BoardDTO } from '@/modules/boards/types';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface BoardGalleryProps {
  initialBoards: BoardDTO[];
  permissions?: string[];
}

function sortBoards(items: BoardData[]): BoardData[] {
  return [...items].sort((a, b) => {
    if (a.isPinned && b.isPinned) {
      const timeA = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const timeB = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      return timeB - timeA; // Recent pinned first (most left)
    }
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

function dispatchPinnedBoards(boardList: BoardData[]) {
  if (typeof window === 'undefined') return;
  const pinnedItems = boardList
    .filter((b) => b.isPinned)
    .map((b) => ({ id: b.id, name: b.name }));
  window.dispatchEvent(
    new CustomEvent('pinned-boards-updated', { detail: { pinnedBoards: pinnedItems } })
  );
}

export function BoardGallery({ initialBoards, permissions }: BoardGalleryProps) {
  const [boards, setBoards] = useState<BoardData[]>(() => sortBoards(initialBoards));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<BoardData | null>(null);

  // References for FLIP animation (First, Last, Invert, Play)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevRects = useRef<Map<number, DOMRect>>(new Map());

  const snapshotCardRects = useCallback(() => {
    const rects = new Map<number, DOMRect>();
    cardRefs.current.forEach((el, id) => {
      if (el) {
        rects.set(id, el.getBoundingClientRect());
      }
    });
    prevRects.current = rects;
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (prevRects.current.size === 0) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      prevRects.current.clear();
      return;
    }

    cardRefs.current.forEach((el, id) => {
      if (!el) return;
      const prev = prevRects.current.get(id);
      if (!prev) return;

      const current = el.getBoundingClientRect();
      const deltaX = prev.left - current.left;
      const deltaY = prev.top - current.top;

      if (deltaX !== 0 || deltaY !== 0) {
        el.style.zIndex = '10';
        const anim = el.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: 'translate(0, 0)' },
          ],
          {
            duration: 420,
            easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
          }
        );
        anim.onfinish = () => {
          el.style.zIndex = '';
        };
      }
    });

    prevRects.current.clear();
  }, [boards]);

  const [prevInitialBoards, setPrevInitialBoards] = useState(initialBoards);
  if (prevInitialBoards !== initialBoards) {
    setPrevInitialBoards(initialBoards);
    setBoards(sortBoards(initialBoards));
  }

  useEffect(() => {
    const handleOpenBoardEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ boardId: number }>;
      if (customEvent.detail?.boardId) {
        const target = boards.find((b) => b.id === customEvent.detail.boardId);
        if (target) {
          setSelectedBoard(target);
        }
      }
    };

    window.addEventListener('open-board', handleOpenBoardEvent);
    return () => {
      window.removeEventListener('open-board', handleOpenBoardEvent);
    };
  }, [boards]);

  const canRead = permissions
    ? permissions.includes(PERMISSIONS.BOARDS_READ) || permissions.includes(PERMISSIONS.BOARDS_VIEW_ALL)
    : true;
  const canCreate = permissions ? permissions.includes(PERMISSIONS.BOARDS_CREATE) : true;
  const canEdit = permissions ? permissions.includes(PERMISSIONS.BOARDS_UPDATE) : true;
  const canDelete = permissions ? permissions.includes(PERMISSIONS.BOARDS_DELETE) : true;

  const handleTogglePin = async (id: number) => {
    const target = boards.find((b) => b.id === id);
    if (!target) return;

    // Check client-side limit if trying to pin
    const currentlyPinnedCount = boards.filter((b) => b.isPinned).length;
    if (!target.isPinned && currentlyPinnedCount >= 3) {
      alert('You can only pin up to 3 boards. Please unpin a board first.');
      return;
    }

    const wasPinned = Boolean(target.isPinned);
    const wasPinnedAt = target.pinnedAt;
    const nextPinned = !wasPinned;
    const nextPinnedAt = nextPinned ? new Date() : null;

    // Snapshot card rects for smooth FLIP animation
    snapshotCardRects();

    // Optimistically toggle and re-order so the recent pinned board is moved to the most left
    setBoards((prev) => {
      const updated = prev.map((b) =>
        b.id === id ? { ...b, isPinned: nextPinned, pinnedAt: nextPinnedAt } : b
      );
      const sorted = sortBoards(updated);
      dispatchPinnedBoards(sorted);
      return sorted;
    });

    setSelectedBoard((prev) =>
      prev && prev.id === id ? { ...prev, isPinned: nextPinned, pinnedAt: nextPinnedAt } : prev
    );

    try {
      const res = await togglePinBoardAction(id);
      if (!res.success) {
        alert(res.message || 'Failed to update pin status');
        // Rollback with animation
        snapshotCardRects();
        setBoards((prev) => {
          const rolledBack = prev.map((b) =>
            b.id === id ? { ...b, isPinned: wasPinned, pinnedAt: wasPinnedAt } : b
          );
          const sorted = sortBoards(rolledBack);
          dispatchPinnedBoards(sorted);
          return sorted;
        });
        setSelectedBoard((prev) =>
          prev && prev.id === id ? { ...prev, isPinned: wasPinned, pinnedAt: wasPinnedAt } : prev
        );
      }
    } catch {
      alert('Network error while toggling pin');
      snapshotCardRects();
      setBoards((prev) => {
        const rolledBack = prev.map((b) =>
          b.id === id ? { ...b, isPinned: wasPinned, pinnedAt: wasPinnedAt } : b
        );
        const sorted = sortBoards(rolledBack);
        dispatchPinnedBoards(sorted);
        return sorted;
      });
      setSelectedBoard((prev) =>
        prev && prev.id === id ? { ...prev, isPinned: wasPinned, pinnedAt: wasPinnedAt } : prev
      );
    }
  };

  const handleBoardCreated = (newBoard: BoardDTO) => {
    snapshotCardRects();
    setBoards((prev) => {
      const sorted = sortBoards([newBoard, ...prev]);
      dispatchPinnedBoards(sorted);
      return sorted;
    });
  };

  const handleDeleteBoard = async (id: number) => {
    const target = boards.find((b) => b.id === id);
    if (!target) return;

    if (!confirm(`Are you sure you want to delete board "${target.name}"?`)) {
      return;
    }

    // Optimistic removal with animation
    snapshotCardRects();
    setBoards((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      dispatchPinnedBoards(filtered);
      return filtered;
    });

    try {
      const res = await deleteBoardAction(id);
      if (!res.success) {
        alert(res.message || 'Failed to delete board');
        // Rollback
        snapshotCardRects();
        setBoards((prev) => {
          const rolledBack = sortBoards([...prev, target]);
          dispatchPinnedBoards(rolledBack);
          return rolledBack;
        });
      }
    } catch {
      alert('Error deleting board');
      snapshotCardRects();
      setBoards((prev) => {
        const rolledBack = sortBoards([...prev, target]);
        dispatchPinnedBoards(rolledBack);
        return rolledBack;
      });
    }
  };

  const handleOpenBoard = (board: BoardData) => {
    setSelectedBoard(board);
  };

  const handleBoardUpdated = (updated: BoardDTO) => {
    setBoards((prev) => {
      const sorted = sortBoards(prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
      dispatchPinnedBoards(sorted);
      return sorted;
    });
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-4">
        {boards.map((board) => {
          const isBoardEditable = canEdit || board.currentUserRole === 'owner' || Boolean(board.canEdit);
          return (
            <div
              key={board.id}
              ref={(el) => {
                if (el) {
                  cardRefs.current.set(board.id, el);
                } else {
                  cardRefs.current.delete(board.id);
                }
              }}
              className="will-change-transform"
            >
              <BoardCard
                board={board}
                onTogglePin={handleTogglePin}
                onOpen={handleOpenBoard}
                canView={canRead}
                canEdit={isBoardEditable}
              />
            </div>
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

