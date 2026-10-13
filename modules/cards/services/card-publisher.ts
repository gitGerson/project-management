import { redis } from '@/lib/redis';
import type { CardDTO } from '../types';

export interface CardCreatedEvent {
  type: 'card.created';
  op: 'card.created';
  boardId: number;
  listId: number;
  actorId?: number;
  card: CardDTO;
  occurredAt?: string;
}

export interface CardUpdatedEvent {
  type: 'card.updated';
  op: 'card.updated';
  boardId: number;
  listId: number;
  actorId?: number;
  card: CardDTO;
  occurredAt?: string;
}

export interface CardDeletedEvent {
  type: 'card.deleted';
  op: 'card.deleted';
  boardId: number;
  listId: number;
  cardId: number;
  actorId?: number;
  occurredAt?: string;
}

export interface CardMovedEvent {
  type: 'card.moved';
  op: 'card.moved';
  boardId: number;
  cardId: number;
  sourceListId: number;
  targetListId: number;
  rank: string;
  version: number;
  previousCardId?: number | null;
  nextCardId?: number | null;
  actorId?: number;
  card: CardDTO;
  occurredAt?: string;
}

export type CardRealtimeEvent =
  | CardCreatedEvent
  | CardUpdatedEvent
  | CardDeletedEvent
  | CardMovedEvent;

/**
 * Publishes kanban card mutation events to Redis Pub/Sub.
 * Channel: board:kanban:${boardId}
 */
export async function publishCardEvent(event: CardRealtimeEvent): Promise<void> {
  try {
    const channel = `board:kanban:${event.boardId}`;
    const payload = JSON.stringify({
      ...event,
      occurredAt: event.occurredAt || new Date().toISOString(),
    });

    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }

    await redis.publish(channel, payload);
  } catch (error) {
    // Non-blocking warning so database operations never fail if Redis is down
    console.warn(
      `Realtime card publisher notice (board:kanban:${event.boardId}):`,
      error instanceof Error ? error.message : error
    );
  }
}

