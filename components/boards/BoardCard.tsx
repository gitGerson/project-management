'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pin, MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';

export interface BoardData {
  id: number;
  name: string;
  isPinned: boolean;
  coverType?: 'go-digital' | 'it-operational' | 'empty' | 'custom';
  coverUrl?: string;
  initials?: string;
  color?: string;
}

interface BoardCardProps {
  board: BoardData;
  onTogglePin?: (id: number) => void;
  onOpen?: (board: BoardData) => void;
}

export function BoardCard({ board, onTogglePin, onOpen }: BoardCardProps) {
  const [isPinned, setIsPinned] = useState(board.isPinned);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned((prev) => !prev);
    onTogglePin?.(board.id);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  };

  const renderCover = () => {
    if (board.coverType === 'go-digital') {
      return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden select-none p-4">
          <div className="transform -rotate-6 transition-transform group-hover:scale-105 duration-200 text-center">
            <div className="text-red-600 font-black text-4xl sm:text-5xl tracking-tighter drop-shadow-[2px_3px_0px_rgba(0,0,0,0.85)] font-sans leading-none">
              GO!
            </div>
            <div className="bg-black text-white font-extrabold text-xl sm:text-2xl px-3 py-0.5 tracking-wider mt-1 shadow-md">
              DIGITAL
            </div>
            <div className="text-[8px] text-gray-500 tracking-widest uppercase mt-1.5 font-semibold">
              ENGAGE • OPTIMISE • SUPPORT
            </div>
          </div>
        </div>
      );
    }

    if (board.coverType === 'it-operational') {
      return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden select-none p-4">
          <div className="transition-transform group-hover:scale-105 duration-200 text-center">
            <div className="text-yellow-400 font-black text-5xl sm:text-6xl tracking-tight drop-shadow-[3px_4px_0px_#ef4444] font-sans leading-none stroke-black">
              IT
            </div>
            <div className="text-pink-500 font-black text-xl sm:text-2xl tracking-wider drop-shadow-[2px_2px_0px_#000000] uppercase mt-1">
              OPERATIONAL
            </div>
          </div>
        </div>
      );
    }

    if (board.coverUrl) {
      return (
        <div
          className="w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${board.coverUrl})` }}
        />
      );
    }

    // Default neutral empty cover
    return (
      <div className="w-full h-full bg-[#f3f4f6] flex items-center justify-center">
        {board.initials && (
          <span className="text-4xl font-extrabold text-gray-400 select-none">
            {board.initials}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={() => onOpen?.(board)}
      className="group relative bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden flex flex-col cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      tabIndex={0}
      role="link"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.(board);
        }
      }}
    >
      {/* Cover Area */}
      <div className="h-44 sm:h-48 w-full border-b border-gray-100 flex items-center justify-center overflow-hidden">
        {renderCover()}
      </div>

      {/* Footer Area */}
      <div className="px-4 py-3 bg-gray-50/60 flex items-center justify-between gap-2 min-h-[52px]">
        <h3
          className="text-sm font-semibold text-gray-800 truncate flex-1 tracking-tight"
          title={board.name}
        >
          {board.name}
        </h3>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Pin Button */}
          <button
            type="button"
            onClick={handlePinClick}
            className={`p-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
              isPinned
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title={isPinned ? 'Unpin board' : 'Pin board'}
            aria-label={isPinned ? 'Unpin board' : 'Pin board'}
          >
            <Pin
              className={`w-4 h-4 transition-colors ${
                isPinned ? 'fill-amber-500 text-amber-500' : 'text-gray-400'
              }`}
            />
          </button>

          {/* More Options Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={handleMenuClick}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition active:scale-95 cursor-pointer"
              title="Board actions"
              aria-label="Board actions"
              aria-expanded={isMenuOpen}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 w-36 bg-white border border-gray-100 shadow-xl rounded-xl py-1 z-30 text-gray-700 text-xs"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpen?.(board);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition text-left cursor-pointer"
                  role="menuitem"
                >
                  <Eye className="w-3.5 h-3.5 text-gray-500" />
                  <span>View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition text-left cursor-pointer"
                  role="menuitem"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 transition text-left cursor-pointer"
                  role="menuitem"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

