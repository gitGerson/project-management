'use client';

import { useEffect, useRef } from 'react';
import { realtimeClient } from '@/modules/chat/hooks/useRealtimeChat';
import type { ListDTO } from '../types';

export interface UseRealtimeListsOptions {
  onListCreated?: (list: ListDTO) => void;
  onListUpdated?: (list: ListDTO) => void;
  onListDeleted?: (listId: number) => void;
  onListsReordered?: (listIds: number[]) => void;
}

/**
 * Hook to subscribe to real-time Kanban list updates for a specific board.
 * Listens on WebSocket channel room `kanban:${boardId}`.
 */
export function useRealtimeLists(
  boardId: number,
  options: UseRealtimeListsOptions
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!boardId) return;

    realtimeClient.ensureConnected();

    const unsubscribe = realtimeClient.subscribeRawRoom(`kanban:${boardId}`, (data) => {
      const type = data.type || data.op;
      if (!type) return;

      if (type === 'list.created' && data.list) {
        optionsRef.current.onListCreated?.(data.list);
      } else if (type === 'list.updated' && data.list) {
        optionsRef.current.onListUpdated?.(data.list);
      } else if (type === 'list.deleted' && data.listId) {
        optionsRef.current.onListDeleted?.(Number(data.listId));
      } else if (type === 'list.reordered' && Array.isArray(data.listIds)) {
        optionsRef.current.onListsReordered?.(data.listIds);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [boardId]);
}

