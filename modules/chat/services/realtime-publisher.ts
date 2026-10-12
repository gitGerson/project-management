import { redis } from '@/lib/redis';
import type { CommentDTO } from '../types';

export async function publishCommentEvent(
  scopeType: string,
  scopeId: number,
  comment: CommentDTO
): Promise<void> {
  try {
    const channel = `chat:${scopeType}:${scopeId}`;
    const payload = JSON.stringify({
      type: 'chat.message.created',
      scopeType,
      scopeId,
      comment,
      occurredAt: new Date().toISOString(),
    });

    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    await redis.publish(channel, payload);
    // Also publish to global notifications channel for chat list snippet / unread updates
    await redis.publish('chat:global', payload);
  } catch (error) {
    // Non-blocking: log warning so database persistence succeeds even if Redis is unreachable
    console.warn('Realtime publisher notice (Redis):', error instanceof Error ? error.message : error);
  }
}

