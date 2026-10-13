import { redis } from '@/lib/redis';
import type { ListDTO } from '../types';

export interface ListCreatedEvent {
  type: 'list.created';
  op: 'list.created';
  boardId: number;
  actorId?: number;
  list: ListDTO;
  occurredAt?: string;
}

export interface ListUpdatedEvent {
  type: 'list.updated';
  op: 'list.updated';
  boardId: number;
  actorId?: number;
  list: ListDTO;
  occurredAt?: string;
}

export interface ListDeletedEvent {
  type: 'list.deleted';
  op: 'list.deleted';
  boardId: number;
  actorId?: number;
  listId: number;
  occurredAt?: string;
}

export interface ListReorderedEvent {
  type: 'list.reordered';
  op: 'list.reordered';
  boardId: number;
  actorId?: number;
  listIds: number[];
  occurredAt?: string;
}

export type ListRealtimeEvent =
  | ListCreatedEvent
  | ListUpdatedEvent
  | ListDeletedEvent
  | ListReorderedEvent;

/**
 * Publishes kanban list mutation events to Redis Pub/Sub.
 * Channel: board:kanban:${boardId}
 */
export async function publishListEvent(event: ListRealtimeEvent): Promise<void> {
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
      `Realtime publisher notice (board:kanban:${event.boardId}):`,
      error instanceof Error ? error.message : error
    );
  }
}

