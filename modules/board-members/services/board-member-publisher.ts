import { redis } from '@/lib/redis';

export interface BoardMemberEventPayload {
  boardId: number;
  action: 'assigned' | 'unassigned' | 'role_updated' | 'synced' | 'deleted';
  affectedUserIds?: number[];
  occurredAt?: string;
}

/**
 * Publish board membership change events to Redis Pub/Sub.
 * Broadcasts to 'board:members' channel and 'chat:global' channel
 * so connected WebSocket clients can update board cards and chat groups in real-time.
 */
export async function publishBoardMemberEvent(event: BoardMemberEventPayload): Promise<void> {
  try {
    const payload = JSON.stringify({
      type: 'board.members.updated',
      boardId: event.boardId,
      action: event.action,
      affectedUserIds: event.affectedUserIds || [],
      occurredAt: event.occurredAt || new Date().toISOString(),
    });

    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }

    // 1. Publish to board:members channel
    await redis.publish('board:members', payload);

    // 2. Also publish to chat:global channel for instantaneous chat list refresh
    await redis.publish('chat:global', payload);
  } catch (error) {
    // Non-blocking: log warning so database persistence succeeds even if Redis is unreachable
    console.warn('Realtime publisher notice (board:members):', error instanceof Error ? error.message : error);
  }
}

