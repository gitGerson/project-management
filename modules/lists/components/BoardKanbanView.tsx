'use client';

import React, { useState } from 'react';
import type { ListDTO, ListPermissionsDTO } from '../types';
import { BoardColumn } from './BoardColumn';
import { CreateListForm } from './CreateListForm';
import {
  createListAction,
  updateListAction,
  deleteListAction,
} from '../actions';
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

  const handleCreateList = async (title: string): Promise<boolean> => {
    const res = await createListAction({ boardId, title });
    if (res.success && res.data) {
      setLists((prev) => [...prev, res.data!]);
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

  return (
    <div
      className="flex-1 w-full overflow-x-auto p-4 sm:p-6 flex items-start gap-4 scrollbar-thin select-none"
      aria-label="Kanban board lists"
    >
      {/* Existing Lists */}
      {lists.map((list) => (
        <BoardColumn
          key={list.id}
          list={list}
          canUpdate={permissions.canUpdate}
          canDelete={permissions.canDelete}
          onUpdateTitle={handleUpdateTitle}
          onDeleteList={handleDeleteList}
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
  );
}
