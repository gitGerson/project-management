'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { ChatGroupDTO, CommentDTO } from '../types';
import { listCommentsAction, sendCommentAction, markChatAsReadAction } from '../actions';
import { useRealtimeChat } from '../hooks/useRealtimeChat';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInput } from './ChatInput';
import { ArrowLeft, X, MessageSquare, Layout } from 'lucide-react';

interface ChatConversationViewProps {
  group: ChatGroupDTO;
  currentUserId: number;
  currentUserName?: string;
  onBack: () => void;
  onClose: () => void;
  onRefreshParentList?: () => void;
}

export const ChatConversationView: React.FC<ChatConversationViewProps> = ({
  group,
  currentUserId,
  currentUserName = 'Me',
  onBack,
  onClose,
  onRefreshParentList,
}) => {
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const roomName = `${group.scopeType}:${group.scopeId}`;

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'instant',
      });
    }
  }, []);

  // Handle incoming real-time comment
  const handleCommentReceived = useCallback(
    (newComment: CommentDTO) => {
      setComments((prev) => {
        // If message with same tempId or id already exists, update it
        const index = prev.findIndex(
          (c) =>
            (newComment.tempId && c.tempId === newComment.tempId) ||
            c.id === newComment.id
        );
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = newComment;
          return updated;
        }
        return [...prev, newComment];
      });

      // Mark as read immediately since user is actively in this room
      markChatAsReadAction(group.scopeType, group.scopeId).catch(() => {});
      if (onRefreshParentList) {
        onRefreshParentList();
      }

      setTimeout(() => scrollToBottom(true), 50);
    },
    [group.scopeType, group.scopeId, onRefreshParentList, scrollToBottom]
  );

  // Hook into WebSocket
  useRealtimeChat({
    room: roomName,
    onCommentReceived: handleCommentReceived,
  });

  // Fetch initial comments
  useEffect(() => {
    let isMounted = true;

    listCommentsAction(group.scopeType, group.scopeId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setComments(res.data);
          setError(null);
          // Mark as read
          markChatAsReadAction(group.scopeType, group.scopeId).catch(() => {});
          if (onRefreshParentList) onRefreshParentList();
          setTimeout(() => scrollToBottom(false), 50);
        } else {
          setError(res.message || 'Failed to load comments');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Network error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [group.scopeType, group.scopeId, onRefreshParentList, scrollToBottom]);

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Optimistic comment
    const optimisticComment: CommentDTO = {
      id: -Date.now(),
      tempId,
      commentableType: group.scopeType,
      commentableId: group.scopeId,
      userId: currentUserId,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: currentUserId,
        name: currentUserName,
        username: currentUserName,
        profilePicture: null,
        initials: currentUserName.substring(0, 2).toUpperCase(),
      },
      isPending: true,
    };

    setComments((prev) => [...prev, optimisticComment]);
    setTimeout(() => scrollToBottom(true), 50);

    const res = await sendCommentAction({
      commentableType: group.scopeType,
      commentableId: group.scopeId,
      content,
      tempId,
    });

    if (res.success && res.data) {
      const savedComment = res.data;
      setComments((prev) =>
        prev.map((c) => (c.tempId === tempId ? savedComment : c))
      );
      if (onRefreshParentList) {
        onRefreshParentList();
      }
    } else {
      // Remove on failure
      setComments((prev) => prev.filter((c) => c.tempId !== tempId));
      alert(res.message || 'Failed to send message');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            title="Back to chat list"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#15803d] flex items-center justify-center border border-emerald-100 shrink-0">
            <Layout className="w-4 h-4 text-[#15803d]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-gray-900 truncate">
                {group.title}
              </h3>
              <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-emerald-50 text-[#15803d] border border-emerald-100">
                {group.scopeType}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">
              {group.subtitle ? `${group.subtitle} • ` : ''}Group Chat
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0 cursor-pointer"
          title="Close chat"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Stream */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin bg-[#f8fafc]"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading messages...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500 p-4 text-center">
            <p className="text-xs font-medium">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                listCommentsAction(group.scopeType, group.scopeId).then((res) => {
                  setLoading(false);
                  if (res.success && res.data) setComments(res.data);
                });
              }}
              className="mt-2 text-xs text-emerald-600 underline hover:text-emerald-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-[#15803d] mb-3 border border-emerald-100">
              <MessageSquare className="w-6 h-6 text-[#15803d]" />
            </div>
            <p className="text-sm font-semibold text-gray-800">
              No messages yet
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
              Start the conversation in this {group.scopeType}!
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <ChatMessageItem
              key={comment.tempId || comment.id}
              comment={comment}
              isMine={comment.userId === currentUserId}
              pending={Boolean(comment.isPending || (comment.tempId && comment.id < 0))}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        placeholder={`Message ${group.title}...`}
      />
    </div>
  );
};
