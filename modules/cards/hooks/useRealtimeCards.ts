'use client';

import { useEffect, useRef } from 'react';
import { realtimeClient } from '@/modules/chat/hooks/useRealtimeChat';
import type { CardDTO } from '../types';

export interface UseRealtimeCardsOptions {
  onCardCreated?: (card: CardDTO) => void;
  onCardUpdated?: (card: CardDTO) => void;
  onCardDeleted?: (cardId: number, listId: number) => void;
  onCardMoved?: (payload: {
    card: CardDTO;
    sourceListId: number;
    targetListId: number;
    rank: string;
    version: number;
  }) => void;
}

/**
 * Hook to subscribe to real-time Kanban card updates for a specific board.
 * Listens on WebSocket channel room `kanban:${boardId}`.
 */
export function useRealtimeCards(
  boardId: number,
  options: UseRealtimeCardsOptions
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!boardId) return;

    realtimeClient.ensureConnected();

    const unsubscribe = realtimeClient.subscribeRawRoom(`kanban:${boardId}`, (data) => {
      const type = data.type || data.op;
      if (!type) return;

      if (type === 'card.created' && data.card) {
        optionsRef.current.onCardCreated?.(data.card);
      } else if (type === 'card.updated' && data.card) {
        optionsRef.current.onCardUpdated?.(data.card);
      } else if (type === 'card.deleted' && data.cardId) {
        optionsRef.current.onCardDeleted?.(Number(data.cardId), Number(data.listId));
      } else if (type === 'card.moved' && data.card) {
        optionsRef.current.onCardMoved?.({
          card: data.card,
          sourceListId: Number(data.sourceListId),
          targetListId: Number(data.targetListId),
          rank: data.rank,
          version: Number(data.version),
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [boardId]);
}

