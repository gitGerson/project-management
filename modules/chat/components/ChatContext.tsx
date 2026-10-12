'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface ChatContextType {
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

interface ChatProviderProps {
  children: React.ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const openChat = useCallback(() => setIsChatOpen(true), []);
  const closeChat = useCallback(() => setIsChatOpen(false), []);
  const toggleChat = useCallback(() => setIsChatOpen((prev) => !prev), []);

  const value = useMemo(
    () => ({
      isChatOpen,
      openChat,
      closeChat,
      toggleChat,
      unreadCount,
      setUnreadCount,
    }),
    [isChatOpen, openChat, closeChat, toggleChat, unreadCount]
  );

  return (
    <ChatContext.Provider value={value}>
      <div
        className={`min-h-screen w-full transition-[margin] duration-300 ease-in-out ${
          isChatOpen ? 'lg:mr-[400px] lg:w-[calc(100%-400px)]' : 'mr-0'
        }`}
      >
        {children}
      </div>
    </ChatContext.Provider>
  );
}

