'use client';

import { useEffect, useState, useRef } from 'react';
import type { CommentDTO } from '../types';
import { getChatWsTokenAction } from '../actions';

export interface BoardMembersUpdatedEvent {
  type: string;
  boardId: number;
  action?: string;
  affectedUserIds?: number[];
  occurredAt?: string;
}

type CommentHandler = (comment: CommentDTO) => void;
type RefreshHandler = () => void;
type BoardMembersUpdatedHandler = (event: BoardMembersUpdatedEvent) => void;
type StatusHandler = (connected: boolean) => void;

class RealtimeChatManager {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  public isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  private roomListeners = new Map<string, Set<CommentHandler>>();
  private rawRoomListeners = new Map<string, Set<(data: any) => void>>();
  private refreshListeners = new Set<RefreshHandler>();
  private boardMembersListeners = new Set<BoardMembersUpdatedHandler>();
  private statusListeners = new Set<StatusHandler>();

  public subscribeRawRoom(room: string, handler: (data: any) => void): () => void {
    if (!this.rawRoomListeners.has(room)) {
      this.rawRoomListeners.set(room, new Set());
      this.send({ type: 'subscribe', room });
    }
    this.rawRoomListeners.get(room)!.add(handler);

    return () => {
      const set = this.rawRoomListeners.get(room);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.rawRoomListeners.delete(room);
          this.send({ type: 'unsubscribe', room });
        }
      }
    };
  }

  public subscribeRoom(room: string, handler: CommentHandler): () => void {
    if (!this.roomListeners.has(room)) {
      this.roomListeners.set(room, new Set());
      this.send({ type: 'subscribe', room });
    }
    this.roomListeners.get(room)!.add(handler);

    return () => {
      const set = this.roomListeners.get(room);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          this.roomListeners.delete(room);
          this.send({ type: 'unsubscribe', room });
        }
      }
    };
  }

  public onRefresh(handler: RefreshHandler): () => void {
    this.refreshListeners.add(handler);
    return () => {
      this.refreshListeners.delete(handler);
    };
  }

  public onBoardMembersUpdated(handler: BoardMembersUpdatedHandler): () => void {
    this.boardMembersListeners.add(handler);
    return () => {
      this.boardMembersListeners.delete(handler);
    };
  }

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusListeners.add(handler);
    handler(this.isConnected);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  public ensureConnected() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) return;
    this.connect();
  }

  private send(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch {
        // ignore
      }
    }
  }

  private async connect() {
    if (typeof window === 'undefined') return;
    this.isConnecting = true;

    let token = '';
    try {
      const res = await getChatWsTokenAction();
      if (res.success && res.data) {
        token = res.data;
      }
    } catch {
      // ignore
    }

    if (!token) {
      this.isConnecting = false;
      this.scheduleReconnect();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect to same host & port on /ws
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.isConnecting = false;
        this.isConnected = true;
        this.notifyStatus(true);

        // Resubscribe all active rooms on reconnect
        for (const room of this.roomListeners.keys()) {
          this.send({ type: 'subscribe', room });
        }
        for (const room of this.rawRoomListeners.keys()) {
          this.send({ type: 'subscribe', room });
        }

        // Heartbeat ping every 25s
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          this.send({ type: 'ping' });
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Deliver to raw room listeners (e.g. kanban board updates)
          if (data.boardId) {
            const kanbanListeners = this.rawRoomListeners.get(`kanban:${data.boardId}`);
            if (kanbanListeners) {
              for (const handler of kanbanListeners) {
                handler(data);
              }
            }
            const boardListeners = this.rawRoomListeners.get(`board:${data.boardId}`);
            if (boardListeners) {
              for (const handler of boardListeners) {
                handler(data);
              }
            }
          }

          if (
            (data.type === 'chat.message.created' || data.type === 'comment.created') &&
            data.comment
          ) {
            const comment = data.comment as CommentDTO;
            const roomKey = `${comment.commentableType}:${comment.commentableId}`;
            const listeners = this.roomListeners.get(roomKey);
            if (listeners) {
              for (const handler of listeners) {
                handler(comment);
              }
            }
          } else if (data.type === 'chat.list.refresh') {
            for (const handler of this.refreshListeners) {
              handler();
            }
            if (data.boardId || data.action) {
              const eventPayload: BoardMembersUpdatedEvent = {
                type: 'board.members.updated',
                boardId: Number(data.boardId || 0),
                action: data.action,
                affectedUserIds: data.affectedUserIds,
                occurredAt: data.occurredAt,
              };
              for (const handler of this.boardMembersListeners) {
                handler(eventPayload);
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('board-members-updated', { detail: eventPayload })
                );
              }
            }
          } else if (data.type === 'board.members.updated') {
            const eventPayload: BoardMembersUpdatedEvent = {
              type: data.type,
              boardId: Number(data.boardId),
              action: data.action,
              affectedUserIds: data.affectedUserIds,
              occurredAt: data.occurredAt,
            };
            for (const handler of this.boardMembersListeners) {
              handler(eventPayload);
            }
            // Trigger chat list refresh so newly assigned/unassigned board chats immediately show/hide
            for (const handler of this.refreshListeners) {
              handler();
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('board-members-updated', { detail: eventPayload })
              );
            }
          }
        } catch {
          // Ignore
        }
      };

      socket.onclose = () => {
        this.isConnecting = false;
        this.isConnected = false;
        this.notifyStatus(false);
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // onclose will fire
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  private notifyStatus(connected: boolean) {
    for (const handler of this.statusListeners) {
      handler(connected);
    }
  }
}

const chatManager = new RealtimeChatManager();

interface UseRealtimeChatOptions {
  room?: string; // e.g. "board:1"
  onCommentReceived?: (comment: CommentDTO) => void;
  onRefreshList?: () => void;
  onBoardMembersUpdated?: (event: BoardMembersUpdatedEvent) => void;
}

export function useRealtimeChat(options: UseRealtimeChatOptions = {}) {
  const { room, onCommentReceived, onRefreshList, onBoardMembersUpdated } = options;
  const [isConnected, setIsConnected] = useState(chatManager.isConnected);

  const onCommentReceivedRef = useRef(onCommentReceived);
  const onRefreshListRef = useRef(onRefreshList);
  const onBoardMembersUpdatedRef = useRef(onBoardMembersUpdated);

  useEffect(() => {
    onCommentReceivedRef.current = onCommentReceived;
    onRefreshListRef.current = onRefreshList;
    onBoardMembersUpdatedRef.current = onBoardMembersUpdated;
  }, [onCommentReceived, onRefreshList, onBoardMembersUpdated]);

  // Subscribe to connection status
  useEffect(() => {
    chatManager.ensureConnected();
    return chatManager.onStatusChange(setIsConnected);
  }, []);

  // Subscribe to global refresh
  useEffect(() => {
    if (!onRefreshList) return;
    return chatManager.onRefresh(() => {
      onRefreshListRef.current?.();
    });
  }, [onRefreshList]);

  // Subscribe to board members updated
  useEffect(() => {
    if (!onBoardMembersUpdated) return;
    return chatManager.onBoardMembersUpdated((event) => {
      onBoardMembersUpdatedRef.current?.(event);
    });
  }, [onBoardMembersUpdated]);

  // Subscribe to specific room
  useEffect(() => {
    if (!room || !onCommentReceived) return;
    return chatManager.subscribeRoom(room, (comment) => {
      onCommentReceivedRef.current?.(comment);
    });
  }, [room, onCommentReceived]);

  return {
    isConnected,
  };
}

export { chatManager as realtimeClient };

