'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Moon, Network, Bell, Maximize, Minimize } from 'lucide-react';
import { ProfileDropdown } from './ProfileDropdown';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { PinnedBoardDropdown, type PinnedBoardItem } from './PinnedBoardDropdown';

interface HeaderProps {
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
    phone?: string | null;
    profilePicture?: string | null;
    roles?: string[];
  } | null;
  pinnedBoards?: PinnedBoardItem[];
}

export function Header({ user, pinnedBoards = [] }: HeaderProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'addon'>('profile');
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Compute initials (e.g. GM)
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const displayName = user?.name || user?.username || 'User';
  const initials = getInitials(displayName);

  return (
    <header className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-4">
      <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100 px-4 sm:px-6 py-2.5 flex items-center justify-between relative">
        {/* Left: Brand Logo */}
        <div className="flex items-center">
          <Link href="/" className="inline-flex items-center transition hover:opacity-90">
            <Image
              src="/assets/logo.png"
              alt="Tong Tji Logo"
              width={112}
              height={42}
              className="h-9 w-auto object-contain"
              style={{ width: 'auto' }}
              priority
            />
          </Link>
        </div>

        {/* Center: App Name */}
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-wider text-gray-700 uppercase">
            BOARDS
          </h1>
        </div>

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle Button - hidden on mobile, available in Profile Dropdown */}
          <button
            type="button"
            className="hidden md:flex w-9 h-9 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 items-center justify-center transition active:scale-95 cursor-pointer"
            aria-label="Toggle dark mode"
          >
            <Moon className="w-4 h-4" />
          </button>

          {/* TreeView / Network Button - hidden on mobile, available in Profile Dropdown */}
          <button
            type="button"
            className="hidden md:flex w-9 h-9 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 items-center justify-center transition active:scale-95 cursor-pointer"
            aria-label="Open TreeView"
          >
            <Network className="w-4 h-4" />
          </button>

          {/* Full Screen Toggle Button - hidden on mobile, available in Profile Dropdown */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden md:flex w-9 h-9 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 items-center justify-center transition active:scale-95 cursor-pointer"
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </button>

          {/* Pinned Board Dropdown Button - hidden on mobile, available in Profile Dropdown */}
          <div className="hidden md:block">
            <PinnedBoardDropdown pinnedBoards={pinnedBoards} />
          </div>

          {/* Inbox / Notification Button with Badge - hidden on mobile, available in Profile Dropdown */}
          <button
            type="button"
            className="hidden md:flex w-9 h-9 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 items-center justify-center transition active:scale-95 relative cursor-pointer"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
              3
            </span>
          </button>

          {/* Profile Dropdown Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#364574] text-white font-bold text-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-green-500 transition active:scale-95 cursor-pointer shadow-xs"
              aria-label="User menu"
              aria-expanded={isProfileOpen}
            >
              {user?.profilePicture ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.profilePicture}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
              <span className="w-3 h-3 bg-green-500 rounded-full border-2 border-white absolute bottom-0 right-0 shadow-xs z-10" />
            </button>

            <ProfileDropdown
              user={user}
              isOpen={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
              pinnedBoards={pinnedBoards}
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

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        user={user}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
      />
    </header>
  );
}

