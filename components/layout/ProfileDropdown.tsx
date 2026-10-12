'use client';

import React, { useEffect, useRef } from 'react';
import { UserPen, Power, Moon, Network, Bell, Maximize, Minimize, Pin } from 'lucide-react';
import { logoutAction } from '@/modules/auth/actions';
import type { PinnedBoardItem } from './PinnedBoardDropdown';

interface ProfileDropdownProps {
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
    phone?: string | null;
    profilePicture?: string | null;
    roles?: string[];
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenProfileSettings?: () => void;
  pinnedBoards?: PinnedBoardItem[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function ProfileDropdown({
  user,
  isOpen,
  onClose,
  onOpenProfileSettings,
  pinnedBoards = [],
  isFullscreen = false,
  onToggleFullscreen,
}: ProfileDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isPinnedExpanded, setIsPinnedExpanded] = React.useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectBoard = (boardId: number) => {
    onClose();
    window.dispatchEvent(new CustomEvent('open-board', { detail: { boardId } }));
  };

  // Calculate initials (e.g., Gerson Manuel Sugianto -> GM)
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const displayName = user?.name || user?.username || 'User';
  const initials = getInitials(displayName);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2.5 z-50 text-gray-800"
      role="menu"
      aria-orientation="vertical"
    >
      {/* User Info Header */}
      <div className="px-4 py-2 flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#364574] text-white flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden">
            {user?.profilePicture ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.profilePicture}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <span
            className="w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white absolute bottom-0 right-0 shadow-xs"
            title="Online"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate uppercase tracking-tight">
            {displayName}
          </h4>
          <p className="text-[11px] text-gray-400 truncate">
            {user?.email || ''}
          </p>
          <div className="mt-1">
            <span className="inline-block bg-[#dcfce7] text-[#15803d] text-[10px] font-semibold px-2 py-0.5 rounded capitalize">
              {user?.roles && user.roles.length > 0
                ? user.roles[0].replace(/_/g, ' ')
                : 'Viewer'}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile-Only Actions Section */}
      <div className="md:hidden">
        <div className="h-px bg-gray-100 my-1" />
        <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Quick Actions
        </div>
        <div className="px-2 py-0.5 space-y-0.5">
          {/* Notifications */}
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-gray-500" />
              <span>Notifications</span>
            </div>
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              3
            </span>
          </button>

          {/* Pinned Boards Mobile Menu */}
          <div>
            <button
              type="button"
              onClick={() => setIsPinnedExpanded((prev) => !prev)}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Pin className={`w-4 h-4 ${pinnedBoards.length > 0 ? 'text-amber-500 fill-amber-500' : 'text-gray-500'}`} />
                <span>Pinned Boards</span>
              </div>
              <span className="text-[10px] font-semibold text-gray-400">
                {pinnedBoards.length}
              </span>
            </button>
            {isPinnedExpanded && (
              <div className="ml-4 pl-2 border-l border-gray-100 my-1 space-y-0.5">
                {pinnedBoards.length === 0 ? (
                  <p className="text-[11px] text-gray-400 px-2 py-1">No pinned boards yet</p>
                ) : (
                  pinnedBoards.map((board) => (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => handleSelectBoard(board.id)}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 text-xs text-gray-700 rounded transition cursor-pointer"
                    >
                      <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                      <span className="truncate">{board.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Full Screen */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onToggleFullscreen?.();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-gray-500" />
            ) : (
              <Maximize className="w-4 h-4 text-gray-500" />
            )}
            <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
          </button>

          {/* TreeView / Network */}
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
          >
            <Network className="w-4 h-4 text-gray-500" />
            <span>TreeView</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
          >
            <Moon className="w-4 h-4 text-gray-500" />
            <span>Toggle Dark Mode</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-gray-100 my-1" />

      {/* Menu Actions */}
      <div className="px-2 py-0.5 space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenProfileSettings?.();
          }}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
        >
          <UserPen className="w-4 h-4 text-gray-500" />
          <span>Profile Settings</span>
        </button>
      </div>

      <div className="h-px bg-gray-100 my-1" />

      {/* Log Out */}
      <div className="px-2 py-0.5">
        <form action={logoutAction} className="m-0">
          <button
            type="submit"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
          >
            <Power className="w-4 h-4 text-gray-500" />
            <span>Log Out</span>
          </button>
        </form>
      </div>

      <div className="h-px bg-gray-100 my-1" />

      {/* Copyright */}
      <div className="px-4 py-1 text-center text-[11px] text-gray-400 select-none">
        © {new Date().getFullYear()} , Tong Tji IT RnD Team
      </div>
    </div>
  );
}
