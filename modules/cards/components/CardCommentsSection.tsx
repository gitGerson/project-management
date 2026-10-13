'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type {
  CommentDTO,
  CommentAttachmentDTO,
  CommentReplyDTO,
  MentionUserDTO,
} from '@/modules/chat/types';
import { stripHtml } from '@/modules/chat/utils/comment-parser';
import {
  listCommentsAction,
  sendCommentAction,
  markChatAsReadAction,
  listMentionCandidatesAction,
} from '@/modules/chat/actions';
import { useRealtimeChat } from '@/modules/chat/hooks/useRealtimeChat';
import { ChatMessageItem } from '@/modules/chat/components/ChatMessageItem';
import { ChatInput } from '@/modules/chat/components/ChatInput';
import { MessageSquare, Loader2, Sparkles } from 'lucide-react';

interface CardCommentsSectionProps {
  cardId: number;
  currentUserId: number;
  currentUserName?: string;
  onCommentsCountChange?: (count: number) => void;
}

export const CardCommentsSection: React.FC<CardCommentsSectionProps> = ({
  cardId,
  currentUserId,
  currentUserName = 'Me',
  onCommentsCountChange,
}) => {
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommentReplyDTO | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionUserDTO[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const roomName = `card:${cardId}`;

  // Scroll helper
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'instant',
      });
    }
  }, []);

  // Update parent with count
  useEffect(() => {
    onCommentsCountChange?.(comments.length);
  }, [comments.length, onCommentsCountChange]);

  // Handle incoming real-time comment
  const handleCommentReceived = useCallback(
    (newComment: CommentDTO) => {
      setComments((prev) => {
        // If message with same tempId or id already exists, replace it
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

      // Mark as read immediately since user is actively viewing this card
      markChatAsReadAction('card', cardId).catch(() => {});
      setTimeout(() => scrollToBottom(true), 50);
    },
    [cardId, scrollToBottom]
  );

  // Hook into WebSocket
  useRealtimeChat({
    room: roomName,
    onCommentReceived: handleCommentReceived,
  });

  // Fetch initial comments and mention candidates
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      listCommentsAction('card', cardId),
      listMentionCandidatesAction('card', cardId),
    ])
      .then(([commentsRes, mentionsRes]) => {
        if (!isMounted) return;

        if (commentsRes.success && commentsRes.data) {
          setComments(commentsRes.data);
          markChatAsReadAction('card', cardId).catch(() => {});
          setTimeout(() => scrollToBottom(false), 50);
        } else {
          setError(commentsRes.message || 'Gagal memuat komentar');
        }

        if (mentionsRes.success && mentionsRes.data) {
          setMentionCandidates(mentionsRes.data);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Terjadi kesalahan jaringan');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cardId, scrollToBottom]);

  // Handle reply action
  const handleReply = (comment: CommentDTO) => {
    const strippedText = stripHtml(comment.content || '');
    const rawSnippet =
      strippedText || (comment.attachments?.[0]?.isImage ? 'Gambar' : 'Lampiran');
    const snippet = rawSnippet.length > 60 ? `${rawSnippet.slice(0, 60)}...` : rawSnippet;

    setReplyingTo({
      id: comment.id,
      authorName: comment.author.name || comment.author.username,
      snippet,
    });
  };

  // Handle sending comment
  const handleSendMessage = async (payload: {
    content: string;
    replyTo?: CommentReplyDTO | null;
    attachments?: CommentAttachmentDTO[];
  }) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Optimistic UI
    const optimisticComment: CommentDTO = {
      id: -Date.now(),
      tempId,
      commentableType: 'card',
      commentableId: cardId,
      userId: currentUserId,
      content: payload.content,
      replyTo: payload.replyTo,
      attachments: payload.attachments || [],
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
    setReplyingTo(null);
    setTimeout(() => scrollToBottom(true), 50);

    const res = await sendCommentAction({
      commentableType: 'card',
      commentableId: cardId,
      content: payload.content,
      replyTo: payload.replyTo,
      attachments: payload.attachments,
      tempId,
    });

    if (res.success && res.data) {
      const savedComment = res.data;
      setComments((prev) =>
        prev.map((c) => (c.tempId === tempId ? savedComment : c))
      );
    } else {
      // Rollback optimistic comment
      setComments((prev) => prev.filter((c) => c.tempId !== tempId));
      alert(res.message || 'Failed to send comment');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
          </div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-800">
            Activity & Comments
          </h3>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            {comments.length}
          </span>
        </div>
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3.5 py-3 space-y-1 min-h-0 bg-[#f8fafc]"
      >
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-gray-400">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin mb-2" />
            <p className="text-xs text-gray-500 font-medium">Loading comments...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
            {error}
          </div>
        ) : comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 select-none">
            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200/80 shadow-xs flex items-center justify-center mb-3 text-emerald-600">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-bold text-gray-700">No comments yet</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[220px] leading-relaxed">
              Start a discussion or leave a note for your team on this card.
            </p>
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <ChatMessageItem
                key={comment.id || comment.tempId}
                comment={comment}
                isMine={comment.userId === currentUserId}
                pending={comment.isPending}
                onReply={handleReply}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input section */}
      <div className="shrink-0 bg-white border-t border-gray-100 shadow-xs">
        <ChatInput
          onSendMessage={handleSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          mentionCandidates={mentionCandidates}
          placeholder="Write a comment or mention with @..."
          disabled={loading}
        />
      </div>
    </div>
  );
};

