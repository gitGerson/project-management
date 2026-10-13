'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

interface CreateListFormProps {
  boardId: number;
  onCreateList: (title: string) => Promise<boolean>;
}

export function CreateListForm({ onCreateList }: CreateListFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    const success = await onCreateList(trimmed);
    setIsSubmitting(false);

    if (success) {
      setTitle('');
      // Keep open so user can easily add multiple lists sequentially
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setTitle('');
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-[280px] sm:w-[300px] shrink-0 p-3 bg-white/70 hover:bg-white border-2 border-dashed border-gray-300/80 hover:border-emerald-500/80 rounded-2xl text-xs sm:text-sm font-semibold text-gray-600 hover:text-emerald-700 flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98"
      >
        <Plus className="w-4 h-4 text-emerald-600" />
        <span>Add another list</span>
      </button>
    );
  }

  return (
    <div className="w-[280px] sm:w-[300px] shrink-0 bg-white rounded-2xl border border-gray-200/90 shadow-md p-3 transition-all animate-in fade-in duration-150">
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter list title..."
          disabled={isSubmitting}
          className="w-full text-xs sm:text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
        />

        <div className="flex items-center gap-2 mt-2.5">
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="py-1.5 px-3.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Add list</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setTitle('');
            }}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            title="Cancel"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

