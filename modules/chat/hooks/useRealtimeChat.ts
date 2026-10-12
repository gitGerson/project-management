'use client';

import { useEffect, useState, useRef } from 'react';
import type { CommentDTO } from '../types';
import { getChatWsTokenAction } from '../actions';

type CommentHandler = (comment: CommentDTO) => void;
type RefreshHandler = () => void;
type StatusHandler = (connected: boolean) => void;

class RealtimeChatManager {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  public isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  private roomListeners = new Map<string, Set<CommentHandler>>();
  private refreshListeners = new Set<RefreshHandler>();
  private statusListeners = new Set<StatusHandler>();

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

        // Heartbeat ping every 25s
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          this.send({ type: 'ping' });
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
}

export function useRealtimeChat(options: UseRealtimeChatOptions = {}) {
  const { room, onCommentReceived, onRefreshList } = options;
  const [isConnected, setIsConnected] = useState(chatManager.isConnected);

  const onCommentReceivedRef = useRef(onCommentReceived);
  const onRefreshListRef = useRef(onRefreshList);
  useEffect(() => {
    onCommentReceivedRef.current = onCommentReceived;
    onRefreshListRef.current = onRefreshList;
  }, [onCommentReceived, onRefreshList]);

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
