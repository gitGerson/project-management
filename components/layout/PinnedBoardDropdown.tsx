'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Pin } from 'lucide-react';

export interface PinnedBoardItem {
  id: number;
  name: string;
}

interface PinnedBoardDropdownProps {
  pinnedBoards?: PinnedBoardItem[];
}

export function PinnedBoardDropdown({ pinnedBoards = [] }: PinnedBoardDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<PinnedBoardItem[]>(pinnedBoards);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with prop when server revalidates
  const [prevPinnedBoards, setPrevPinnedBoards] = useState(pinnedBoards);
  if (prevPinnedBoards !== pinnedBoards) {
    setPrevPinnedBoards(pinnedBoards);
    setItems(pinnedBoards);
  }

  // Listen to custom event for immediate optimistic updates from BoardGallery
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ pinnedBoards?: PinnedBoardItem[] }>;
      if (customEvent.detail?.pinnedBoards) {
        setItems(customEvent.detail.pinnedBoards);
      }
    };

    window.addEventListener('pinned-boards-updated', handleUpdate);
    return () => {
      window.removeEventListener('pinned-boards-updated', handleUpdate);
    };
  }, []);

  // Click outside and escape key handling
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
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
  }, [isOpen]);

  const handleSelectBoard = (boardId: number) => {
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('open-board', { detail: { boardId } }));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-9 h-9 rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-600 flex items-center justify-center transition active:scale-95 relative cursor-pointer ${
          isOpen ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400/50' : ''
        }`}
        aria-label="Pinned boards"
        aria-expanded={isOpen}
        title="Pinned Boards"
      >
        <Pin
          className={`w-4 h-4 transition-colors ${
            items.length > 0 ? 'text-amber-500 fill-amber-500' : 'text-gray-600'
          }`}
        />
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
            {items.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 min-w-[220px] max-w-[280px] bg-white border border-gray-200/90 shadow-2xl rounded-2xl py-2 z-50 text-gray-800 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
        >
          <div className="px-3 py-1 flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1.5 mb-1">
            <span>Pinned Boards</span>
            <span className="text-[10px] font-semibold text-gray-400">{items.length}/3</span>
          </div>

          {items.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">
              No pinned boards yet
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto py-0.5">
              {items.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => handleSelectBoard(board.id)}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700 transition cursor-pointer"
                  role="menuitem"
                >
                  <Pin className="w-3.5 h-3.5 fill-amber-500 text-amber-500 flex-shrink-0" />
                  <span className="truncate font-medium">{board.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

