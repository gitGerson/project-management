'use client';

import React, { useState, useMemo } from 'react';
import type { ChatGroupDTO } from '../types';
import { Search, Layout, MessageSquare, X } from 'lucide-react';

interface ChatGroupListProps {
  groups: ChatGroupDTO[];
  loading: boolean;
  onSelectGroup: (group: ChatGroupDTO) => void;
  onClose: () => void;
  isConnected?: boolean;
}

export const ChatGroupList: React.FC<ChatGroupListProps> = ({
  groups,
  loading,
  onSelectGroup,
  onClose,
  isConnected = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase().trim();
    return groups.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        (g.subtitle && g.subtitle.toLowerCase().includes(q)) ||
        (g.lastComment && g.lastComment.content.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  const formatTimestamp = (dateString?: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-white text-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 tracking-tight">
              Live Chats
            </h2>
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
              }`}
              title={isConnected ? 'Live WebSocket Connected' : 'Connecting...'}
            />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Group chats for your active boards
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          title="Close chat"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/70">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats or boards..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100/80 scrollbar-thin">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-11 h-11 bg-gray-100 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3 border border-gray-100">
              <MessageSquare className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              No chats found
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
              {searchQuery
                ? 'Try a different search keyword'
                : 'Join or create boards to participate in group discussions'}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const hasUnread = group.unreadCount > 0;
            return (
              <button
                key={`${group.scopeType}:${group.scopeId}`}
                type="button"
                onClick={() => onSelectGroup(group)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-gray-50 cursor-pointer ${
                  hasUnread ? 'bg-emerald-50/25' : 'bg-white'
                }`}
              >
                {/* Avatar / Icon */}
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#15803d] font-semibold text-sm">
                    <Layout className="w-5 h-5 text-[#15803d]" />
                  </div>
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4
                      className={`text-sm truncate ${
                        hasUnread
                          ? 'font-bold text-gray-900'
                          : 'font-medium text-gray-800'
                      }`}
                    >
                      {group.title}
                    </h4>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                      {formatTimestamp(group.lastComment?.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs truncate max-w-[210px] ${
                        hasUnread
                          ? 'text-gray-900 font-semibold'
                          : 'text-gray-500'
                      }`}
                    >
                      {group.lastComment ? (
                        <>
                          <span className="text-[#15803d] font-medium">
                            {group.lastComment.authorName}:
                          </span>{' '}
                          {group.lastComment.content}
                        </>
                      ) : (
                        <span className="italic text-gray-400">No messages yet</span>
                      )}
                    </p>

                    {hasUnread && (
                      <span className="shrink-0 px-1.5 py-0.2 min-w-[18px] text-center text-[10px] font-bold text-white bg-emerald-600 rounded-full shadow-xs">
                        {group.unreadCount > 99 ? '99+' : group.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
