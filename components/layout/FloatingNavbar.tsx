'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Kanban, Pin, ChevronUp, Settings } from 'lucide-react';
import { ManagementSettingsModal } from './ManagementSettingsModal';

interface PinnedBoardItem {
  id: number;
  name: string;
  href: string;
}

const DEFAULT_PINNED_BOARDS: PinnedBoardItem[] = [
  { id: 1, name: 'Tong Tji Go Digital', href: '#' },
  { id: 2, name: 'IT Operational', href: '#' },
];

export function FloatingNavbar() {
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const pinnedMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pinnedMenuRef.current && !pinnedMenuRef.current.contains(event.target as Node)) {
        setIsPinnedOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPinnedOpen(false);
      }
    }

    if (isPinnedOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPinnedOpen]);

  return (
    <nav
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none"
      aria-label="Quick navigation"
    >
      <div className="bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-1.5 flex items-center gap-1.5">
        {/* Active Boards Tab */}
        <Link
          href="/"
          className="bg-[#dcfce7] text-[#15803d] font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-2 shadow-xs transition active:scale-95"
        >
          <Kanban className="w-4 h-4 text-[#15803d]" />
          <span>Boards</span>
        </Link>

        {/* Pinned Board Dropup Tab */}
        <div className="relative" ref={pinnedMenuRef}>
          <button
            type="button"
            onClick={() => setIsPinnedOpen((prev) => !prev)}
            className="text-gray-700 hover:bg-gray-100/80 text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition active:scale-95 cursor-pointer"
            aria-expanded={isPinnedOpen}
            aria-haspopup="true"
          >
            <Pin className="w-4 h-4 text-gray-500" />
            <span>Pinned Board</span>
            <ChevronUp
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                isPinnedOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropup Menu */}
          {isPinnedOpen && (
            <div
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 min-w-[220px] bg-white border border-gray-200/90 shadow-2xl rounded-xl py-2 z-50 text-gray-800 text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-2 duration-150"
              role="menu"
            >
              <div className="px-3 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Pinned Boards
              </div>
              {DEFAULT_PINNED_BOARDS.map((board) => (
                <Link
                  key={board.id}
                  href={board.href}
                  onClick={() => setIsPinnedOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700 transition"
                  role="menuitem"
                >
                  <Pin className="w-3.5 h-3.5 fill-amber-500 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{board.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Settings Tab Button */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className={`text-gray-700 hover:bg-gray-100/80 text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition active:scale-95 cursor-pointer ${
            isSettingsOpen ? 'bg-gray-100 font-semibold text-green-800' : ''
          }`}
          aria-label="Open management settings"
        >
          <Settings className="w-4 h-4 text-gray-500" />
          <span>Settings</span>
        </button>
      </div>

      {/* Access Control & User Management Modal */}
      <ManagementSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </nav>
  );
}

