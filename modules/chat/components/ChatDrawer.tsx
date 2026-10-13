'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, ArrowLeft, X } from 'lucide-react';
import type { ChatGroupDTO } from '../types';
import { listUserChatGroupsAction, getCurrentChatUserAction } from '../actions';
import { useRealtimeChat } from '../hooks/useRealtimeChat';
import { useChat } from './ChatContext';
import { ChatGroupList } from './ChatGroupList';
import { ChatConversationView } from './ChatConversationView';

const emptySubscribe = () => () => {};

export const ChatDrawer: React.FC = () => {
  const { isChatOpen, closeChat, setUnreadCount } = useChat();
  const [activeGroup, setActiveGroup] = useState<ChatGroupDTO | null>(null);
  const [revokedNotice, setRevokedNotice] = useState<{ boardTitle?: string } | null>(null);
  const [groups, setGroups] = useState<ChatGroupDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userId: number; username: string } | null>(null);

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Fetch current user once
  useEffect(() => {
    getCurrentChatUserAction().then((res) => {
      if (res.success && res.data) {
        setCurrentUser(res.data);
      }
    });
  }, []);

  // Fetch groups list
  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUserChatGroupsAction();
      if (res.success && res.data) {
        const data = res.data;
        setGroups(data);
        const totalUnread = data.reduce((sum, g) => sum + g.unreadCount, 0);
        setUnreadCount(totalUnread);
        setActiveGroup((prev) => {
          if (!prev || prev.scopeType !== 'board') return prev;
          const stillHasAccess = data.some((g) => g.scopeId === prev.scopeId);
          if (!stillHasAccess) {
            setRevokedNotice({ boardTitle: prev.title });
            return null;
          }
          return prev;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [setUnreadCount]);

  // Load groups on mount
  useEffect(() => {
    let mounted = true;
    listUserChatGroupsAction().then((res) => {
      if (!mounted) return;
      if (res.success && res.data) {
        setGroups(res.data);
        const totalUnread = res.data.reduce((sum, g) => sum + g.unreadCount, 0);
        setUnreadCount(totalUnread);
      }
    });
    return () => {
      mounted = false;
    };
  }, [setUnreadCount]);

  // Real-time listener for global refresh (new comment anywhere in user's scope)
  const { isConnected } = useRealtimeChat({
    onRefreshList: () => {
      loadGroups();
    },
  });

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (revokedNotice) {
          setRevokedNotice(null);
          setActiveGroup(null);
        } else if (isChatOpen) {
          if (activeGroup) {
            setActiveGroup(null);
          } else {
            closeChat();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, activeGroup, revokedNotice, closeChat]);

  if (!isMounted) return null;

  return createPortal(
    <>
      {/* Mobile backdrop only - on desktop content is pushed seamlessly */}
      {isChatOpen && (
        <div
          onClick={closeChat}
          className="fixed inset-0 bg-black/20 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300 pointer-events-auto"
          aria-hidden="true"
        />
      )}

      {/* Slide-over panel with smooth slide-in / slide-out animation matching tabbed modal */}
      <aside
        className={`fixed top-0 right-0 bottom-0 w-full sm:w-[460px] h-screen z-50 bg-white border-l border-gray-200 shadow-[-4px_0_24px_rgba(0,0,0,0.06)] flex flex-col transition-transform duration-350 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] will-change-transform overflow-hidden ${
          isChatOpen
            ? 'translate-x-0 pointer-events-auto'
            : 'translate-x-full pointer-events-none invisible'
        }`}
        aria-label="Board Chat Panel"
        aria-hidden={!isChatOpen}
      >
        {revokedNotice ? (
          <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* Header */}
            <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setRevokedNotice(null);
                    setActiveGroup(null);
                    loadGroups();
                  }}
                  className="p-1.5 -ml-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors cursor-pointer shrink-0"
                  title="Back to chat list"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">
                    {revokedNotice.boardTitle || 'Group Chat'}
                  </h3>
                  <p className="text-xs text-gray-500">Board Chat</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRevokedNotice(null);
                  setActiveGroup(null);
                  closeChat();
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors shrink-0 cursor-pointer"
                title="Close chat"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* In-Panel Revoked Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                <ShieldAlert className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1.5">
                Access Revoked
              </h3>
              <p className="text-xs text-gray-600 mb-6 max-w-[260px] leading-relaxed">
                Sorry, your access has been revoked.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRevokedNotice(null);
                  setActiveGroup(null);
                  loadGroups();
                }}
                className="py-2.5 px-5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Back to Chats
              </button>
            </div>
          </div>
        ) : activeGroup ? (
          <ChatConversationView
            group={activeGroup}
            currentUserId={currentUser?.userId || 0}
            currentUserName={currentUser?.username || 'Me'}
            onBack={() => {
              setActiveGroup(null);
              loadGroups();
            }}
            onClose={closeChat}
            onRefreshParentList={loadGroups}
            onAccessRevoked={() => {
              setRevokedNotice({ boardTitle: activeGroup.title });
              setActiveGroup(null);
            }}
          />
        ) : (
          <ChatGroupList
            groups={groups}
            loading={loading}
            isConnected={isConnected}
            onSelectGroup={(group) => {
              setRevokedNotice(null);
              setActiveGroup(group);
            }}
            onClose={closeChat}
          />
        )}
      </aside>
    </>,
    document.body
  );
};
