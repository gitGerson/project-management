'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface CreateBoardCardProps {
  onClick: () => void;
}

/**
 * CreateBoardCard
 * Pixel-accurate card matching reference design with dashed border,
 * soft slate-gray background, and centered "+ Create new board" action.
 */
export function CreateBoardCard({ onClick }: CreateBoardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full h-[228px] sm:h-[244px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-[#c6d0dc] hover:border-[#96a4b8] bg-[#f1f3f6] hover:bg-[#e8ebf0] transition-all duration-200 flex items-center justify-center gap-2.5 text-[#5a6676] hover:text-gray-900 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
      aria-label="Create new board"
    >
      <Plus
        className="w-5 h-5 sm:w-6 sm:h-6 text-[#738092] group-hover:text-gray-900 transition-colors"
        strokeWidth={2.4}
      />
      <span className="font-semibold text-sm sm:text-base tracking-tight select-none">
        Create new board
      </span>
    </button>
  );
}

