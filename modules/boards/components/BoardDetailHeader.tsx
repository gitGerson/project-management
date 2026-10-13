'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Settings,
  MessageSquare,
  Maximize,
  Minimize,
} from 'lucide-react';
import type { BoardDTO } from '../types';
import type { BoardMemberDTO } from '@/modules/board-members/types';
import { BoardModal } from '@/components/boards/BoardModal';
import { ProfileDropdown } from '@/components/layout/ProfileDropdown';
import { ProfileSettingsModal } from '@/components/layout/ProfileSettingsModal';
import { useChat } from '@/modules/chat';

interface BoardDetailHeaderProps {
  board: BoardDTO;
  members: BoardMemberDTO[];
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
    phone?: string | null;
    profilePicture?: string | null;
    roles?: string[];
  } | null;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function BoardDetailHeader({
  board,
  members,
  user,
  canEdit = false,
  canDelete = false,
}: BoardDetailHeaderProps) {
  const [boardOverride, setBoardOverride] = useState<BoardDTO | null>(null);
  const currentBoard = boardOverride ?? board;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'addon'>('profile');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isChatOpen, toggleChat, unreadCount } = useChat();

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err);
    }
  };

  const displayName = user?.name || user?.username || 'User';
  const userInitials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <header className="w-full bg-white border-b border-gray-200/90 shadow-xs px-4 sm:px-6 py-2.5 sticky top-0 z-30">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-3">
          {/* Left: Back Link & Board Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="p-2 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Back to all boards"
              aria-label="Back to boards"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <Link href="/" className="hidden sm:inline-flex items-center shrink-0">
              <Image
                src="/assets/logo.png"
                alt="Tong Tji Logo"
                width={76}
                height={28}
                className="h-7 w-auto object-contain"
                priority
              />
            </Link>

            <div className="h-4 w-px bg-gray-200 hidden sm:block shrink-0" />

            {/* Board Title */}
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                {currentBoard.name}
              </h1>
              {currentBoard.currentUserRole && (
                <span className="hidden md:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200/80 shrink-0">
                  {currentBoard.currentUserRole}
                </span>
              )}
            </div>
          </div>

          {/* Right: Members, Chat, Settings & Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Members Avatars Stack */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-gray-100 text-gray-600 transition cursor-pointer"
              title="View board members"
              aria-label="Board members"
            >
              <div className="flex -space-x-1.5 overflow-hidden py-0.5">
                {members.slice(0, 3).map((m) => (
                  <div
                    key={m.userId}
                    className="w-6 h-6 rounded-full ring-2 ring-white bg-[#364574] text-white flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden"
                    title={`${m.user.name} (${m.role})`}
                  >
                    {m.user.profilePicture ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={m.user.profilePicture}
                        alt={m.user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>
                        {(m.user.name || 'U')
                          .trim()
                          .split(/\s+/)
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-xs font-semibold text-gray-700 hidden sm:inline ml-0.5">
                {members.length}
              </span>
            </button>

            {/* Board Chat Toggle Button */}
            <button
              type="button"
              onClick={toggleChat}
              className={`p-2 rounded-xl border border-gray-200 text-xs font-medium flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isChatOpen
                  ? 'bg-emerald-50 border-emerald-300 text-[#15803d] font-semibold'
                  : 'bg-white hover:bg-gray-50 text-gray-700'
              }`}
              title="Open board chat"
              aria-label="Board chat"
            >
              <div className="relative flex items-center">
                <MessageSquare className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 px-1 py-0.2 min-w-[14px] h-[14px] text-[8px] font-bold text-white bg-emerald-600 rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="hidden md:inline">Chat</span>
            </button>

            {/* Board Settings / Edit Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition active:scale-95 cursor-pointer"
              title="Board settings & details"
              aria-label="Board settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden lg:flex p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition active:scale-95 cursor-pointer"
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>

            {/* User Profile Avatar Dropdown */}
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="w-8 h-8 rounded-full bg-[#364574] text-white flex items-center justify-center text-xs font-bold hover:opacity-95 transition cursor-pointer shadow-xs"
                aria-label="User menu"
              >
                {user?.profilePicture ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={user.profilePicture}
                    alt={displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{userInitials}</span>
                )}
              </button>

              <ProfileDropdown
                user={user}
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                onOpenProfileSettings={() => {
                  setIsProfileOpen(false);
                  setProfileModalTab('profile');
                  setIsProfileModalOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Board Details / Edit Modal */}
      {isModalOpen && (
        <BoardModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          board={currentBoard}
          canEdit={canEdit}
          canDelete={canDelete}
          onUpdate={(updated) => {
            setBoardOverride(updated);
          }}
        />
      )}

      {/* User Profile Settings Modal */}
      <ProfileSettingsModal
        user={user}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
      />
    </>
  );
}
