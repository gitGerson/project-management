'use client';

import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
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
        setGroups(res.data);
        const totalUnread = res.data.reduce((sum, g) => sum + g.unreadCount, 0);
        setUnreadCount(totalUnread);
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
      if (e.key === 'Escape' && isChatOpen) {
        if (activeGroup) {
          setActiveGroup(null);
        } else {
          closeChat();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, activeGroup, closeChat]);

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
        className={`fixed top-0 right-0 bottom-0 w-full sm:w-[460px] h-screen z-50 bg-white border-l border-gray-200 shadow-[-4px_0_24px_rgba(0,0,0,0.06)] flex flex-col transition-transform duration-350 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] will-change-transform transform ${
          isChatOpen
            ? 'translate-x-0 pointer-events-auto'
            : 'translate-x-full pointer-events-none invisible'
        }`}
        aria-label="Board Chat Panel"
        aria-hidden={!isChatOpen}
      >
        {activeGroup ? (
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
          />
        ) : (
          <ChatGroupList
            groups={groups}
            loading={loading}
            isConnected={isConnected}
            onSelectGroup={(group) => setActiveGroup(group)}
            onClose={closeChat}
          />
        )}
      </aside>
    </>,
    document.body
  );
};
