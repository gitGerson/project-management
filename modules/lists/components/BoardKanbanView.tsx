'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import type { ListDTO, ListPermissionsDTO } from '../types';
import { BoardColumn } from './BoardColumn';
import { CreateListForm } from './CreateListForm';
import {
  createListAction,
  updateListAction,
  deleteListAction,
  reorderListsAction,
} from '../actions';
import { useRealtimeLists } from '../hooks/useRealtimeLists';
import { Layers } from 'lucide-react';

interface BoardKanbanViewProps {
  boardId: number;
  initialLists: ListDTO[];
  permissions: ListPermissionsDTO;
}

export function BoardKanbanView({
  boardId,
  initialLists,
  permissions,
}: BoardKanbanViewProps) {
  const [lists, setLists] = useState<ListDTO[]>(initialLists);
  const [activeListId, setActiveListId] = useState<number | null>(null);

  // Setup accessible dnd-kit sensors with 5px drag activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Real-time synchronization for Kanban lists across all members
  useRealtimeLists(boardId, {
    onListCreated: (newList) => {
      setLists((prev) => {
        if (prev.some((l) => l.id === newList.id)) {
          return prev.map((l) => (l.id === newList.id ? { ...l, ...newList } : l));
        }
        return [...prev, newList].sort((a, b) => a.position - b.position);
      });
    },
    onListUpdated: (updatedList) => {
      setLists((prev) =>
        prev.map((l) =>
          l.id === updatedList.id ? { ...l, ...updatedList } : l
        )
      );
    },
    onListDeleted: (deletedListId) => {
      setLists((prev) => prev.filter((l) => l.id !== deletedListId));
    },
    onListsReordered: (orderedListIds) => {
      // While actively dragging, preserve the active user interaction to avoid jump under pointer
      if (activeListId !== null) return;
      setLists((prev) => {
        const map = new Map(prev.map((l) => [l.id, l]));
        const reordered = orderedListIds
          .map((id) => map.get(id))
          .filter(Boolean) as ListDTO[];
        const remainder = prev.filter((l) => !orderedListIds.includes(l.id));
        return [...reordered, ...remainder];
      });
    },
  });

  // Sync initialLists when changed from parent without losing local updates
  React.useEffect(() => {
    setLists((prev) => {
      const map = new Map<number, ListDTO>();
      for (const l of initialLists) map.set(l.id, l);
      for (const l of prev) {
        if (!map.has(l.id)) map.set(l.id, l);
      }
      return Array.from(map.values()).sort((a, b) => a.position - b.position);
    });
  }, [initialLists]);

  const handleCreateList = async (title: string): Promise<boolean> => {
    const res = await createListAction({ boardId, title });
    if (res.success && res.data) {
      setLists((prev) => {
        if (prev.some((l) => l.id === res.data!.id)) {
          return prev.map((l) => (l.id === res.data!.id ? { ...l, ...res.data! } : l));
        }
        return [...prev, res.data!].sort((a, b) => a.position - b.position);
      });
      return true;
    }
    alert(res.message || 'Failed to create list');
    return false;
  };

  const handleUpdateTitle = async (listId: number, newTitle: string): Promise<boolean> => {
    // Optimistic update
    setLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, title: newTitle } : l))
    );

    const res = await updateListAction(listId, { title: newTitle });
    if (!res.success) {
      // Revert if failed
      alert(res.message || 'Failed to update list title');
      setLists(initialLists);
      return false;
    }
    return true;
  };

  const handleDeleteList = async (listId: number): Promise<boolean> => {
    // Optimistic remove
    setLists((prev) => prev.filter((l) => l.id !== listId));

    const res = await deleteListAction(listId);
    if (!res.success) {
      alert(res.message || 'Failed to delete list');
      setLists(initialLists);
      return false;
    }
    return true;
  };

  // Deduplicate lists by ID to guarantee unique React keys under any concurrent updates
  const uniqueLists = React.useMemo(() => {
    const seen = new Set<number>();
    return lists.filter((list) => {
      if (seen.has(list.id)) return false;
      seen.add(list.id);
      return true;
    });
  }, [lists]);

  // Active list item for DragOverlay preview
  const activeList = React.useMemo(
    () => (activeListId ? uniqueLists.find((l) => l.id === activeListId) || null : null),
    [activeListId, uniqueLists]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveListId(Number(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveListId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = uniqueLists.findIndex((l) => l.id === active.id);
    const newIndex = uniqueLists.findIndex((l) => l.id === over.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(uniqueLists, oldIndex, newIndex);
    // 1. Optimistic local update
    setLists(reordered);

    // 2. Persist to authoritative server transaction and broadcast
    const newOrderedIds = reordered.map((l) => l.id);
    const res = await reorderListsAction(boardId, newOrderedIds);
    if (!res.success) {
      alert(res.message || 'Failed to save column reordering');
      setLists(initialLists);
    }
  };

  // Accessible non-drag reordering action (Move Left / Move Right)
  const handleMoveColumn = async (listId: number, direction: 'left' | 'right') => {
    const currentIndex = uniqueLists.findIndex((l) => l.id === listId);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= uniqueLists.length) return;

    const reordered = arrayMove(uniqueLists, currentIndex, targetIndex);
    setLists(reordered);

    const newOrderedIds = reordered.map((l) => l.id);
    const res = await reorderListsAction(boardId, newOrderedIds);
    if (!res.success) {
      alert(res.message || 'Failed to reorder columns');
      setLists(initialLists);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveListId(null)}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
    >
      <SortableContext
        items={uniqueLists.map((l) => l.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div
          className="flex-1 w-full overflow-x-auto p-4 sm:p-6 flex items-start gap-4 scrollbar-thin select-none"
          aria-label="Kanban board lists"
        >
          {/* Existing Lists */}
          {uniqueLists.map((list, index) => (
            <BoardColumn
              key={list.id}
              list={list}
              canUpdate={permissions.canUpdate}
              canDelete={permissions.canDelete}
              onUpdateTitle={handleUpdateTitle}
              onDeleteList={handleDeleteList}
              onMoveLeft={
                permissions.canUpdate && index > 0
                  ? () => handleMoveColumn(list.id, 'left')
                  : undefined
              }
              onMoveRight={
                permissions.canUpdate && index < uniqueLists.length - 1
                  ? () => handleMoveColumn(list.id, 'right')
                  : undefined
              }
            />
          ))}

          {/* Add New List Form */}
          {permissions.canCreate && (
            <CreateListForm boardId={boardId} onCreateList={handleCreateList} />
          )}

          {/* Empty State when no lists and cannot create */}
          {lists.length === 0 && !permissions.canCreate && (
            <div className="w-[300px] shrink-0 bg-white rounded-2xl border border-gray-200/90 p-8 text-center shadow-xs mx-auto my-12">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
                <Layers className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">No lists available</h3>
              <p className="text-xs text-gray-500 mt-1">
                This board does not contain any lists yet.
              </p>
            </div>
          )}
        </div>
      </SortableContext>

      {/* Accessible visual drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeList ? (
          <div className="rotate-1 opacity-95 scale-102 pointer-events-none shadow-2xl">
            <BoardColumn
              list={activeList}
              canUpdate={false}
              canDelete={false}
              onUpdateTitle={async () => false}
              onDeleteList={async () => false}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

