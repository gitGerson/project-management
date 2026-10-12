'use client';

import React, { useState } from 'react';
import { Pin, Eye, Pencil } from 'lucide-react';

export interface BoardData {
  id: number;
  name: string;
  description?: string | null;
  isPinned?: boolean;
  image?: string | null;
  coverType?: 'go-digital' | 'it-operational' | 'empty' | 'custom';
  coverUrl?: string;
  initials?: string;
  color?: string;
  currentUserRole?: 'owner' | 'member' | 'monitor' | 'guest' | null;
  canEdit?: boolean;
}

interface BoardCardProps {
  board: BoardData;
  onTogglePin?: (id: number) => void;
  onOpen?: (board: BoardData) => void;
  canView?: boolean;
  canEdit?: boolean;
}

export function BoardCard({
  board,
  onTogglePin,
  onOpen,
  canView = true,
  canEdit = false,
}: BoardCardProps) {
  const [isPinned, setIsPinned] = useState(Boolean(board.isPinned));

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPinned((prev) => !prev);
    onTogglePin?.(board.id);
  };

  // Extract initials from board name (up to 2 characters)
  const getInitials = (title: string): string => {
    if (!title) return 'BD';
    const words = title.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.slice(0, 2).toUpperCase();
  };

  const renderCover = () => {
    // 1. Explicit image URL (uploaded file or link)
    const imageUrl = board.image || board.coverUrl;
    if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/') || imageUrl.startsWith('data:'))) {
      return (
        <div className="w-full h-full relative overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={board.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      );
    }

    // 2. Preset color/gradient (e.g. gradient:emerald, gradient:blue, or Tailwind gradient classes)
    if (imageUrl && imageUrl.startsWith('gradient:')) {
      const gradientKey = imageUrl.replace('gradient:', '');
      return (
        <div className={`w-full h-full ${gradientKey} flex items-center justify-center p-3 relative overflow-hidden`}>
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center shadow-sm">
            <span className="text-xl sm:text-2xl font-black text-white tracking-wider">
              {getInitials(board.name)}
            </span>
          </div>
        </div>
      );
    }

    // 3. Backward compatible legacy graphics
    if (board.coverType === 'go-digital' || imageUrl === 'go-digital') {
      return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden select-none p-3">
          <div className="transform -rotate-6 transition-transform group-hover:scale-105 duration-200 text-center">
            <div className="text-red-600 font-black text-3xl sm:text-4xl tracking-tighter drop-shadow-[2px_3px_0px_rgba(0,0,0,0.85)] font-sans leading-none">
              GO!
            </div>
            <div className="bg-black text-white font-extrabold text-base sm:text-xl px-2.5 py-0.5 tracking-wider mt-1 shadow-md">
              DIGITAL
            </div>
            <div className="text-[7px] text-gray-500 tracking-widest uppercase mt-1 font-semibold">
              ENGAGE • OPTIMISE • SUPPORT
            </div>
          </div>
        </div>
      );
    }

    if (board.coverType === 'it-operational' || imageUrl === 'it-operational') {
      return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden select-none p-3">
          <div className="transition-transform group-hover:scale-105 duration-200 text-center">
            <div className="text-yellow-400 font-black text-4xl sm:text-5xl tracking-tight drop-shadow-[2px_3px_0px_#ef4444] font-sans leading-none stroke-black">
              IT
            </div>
            <div className="text-pink-500 font-black text-base sm:text-lg tracking-wider drop-shadow-[1.5px_1.5px_0px_#000000] uppercase mt-0.5">
              OPERATIONAL
            </div>
          </div>
        </div>
      );
    }

    // 4. Default clean minimalist cover with initials
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200/80 flex items-center justify-center relative overflow-hidden">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white border border-gray-200/80 flex items-center justify-center shadow-xs">
          <span className="text-xl sm:text-2xl font-black text-gray-400 select-none">
            {getInitials(board.name)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="group relative bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden flex flex-col"
    >
      {/* Cover Area */}
      <div className="h-36 sm:h-40 w-full border-b border-gray-100 flex items-center justify-center overflow-hidden">
        {renderCover()}
      </div>

      {/* Footer Area */}
      <div className="px-3.5 py-2.5 bg-gray-50/70 flex items-center justify-between gap-2 min-h-[46px]">
        <h3
          className="text-xs sm:text-sm font-semibold text-gray-800 truncate flex-1 tracking-tight"
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

          {/* Action Button: Edit icon if user can edit, Eye icon if view only */}
          {canView && (
            <button
              type="button"
              onClick={() => onOpen?.(board)}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition active:scale-95 cursor-pointer"
              title={canEdit ? 'Edit board' : 'View board details'}
              aria-label={canEdit ? 'Edit board' : 'View board details'}
            >
              {canEdit ? (
                <Pencil className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
