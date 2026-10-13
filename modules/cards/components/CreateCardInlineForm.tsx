'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

interface CreateCardInlineFormProps {
  listId: number;
  onCreateCard: (title: string) => Promise<boolean>;
}

export function CreateCardInlineForm({
  onCreateCard,
}: CreateCardInlineFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    const success = await onCreateCard(trimmed);
    setIsSubmitting(false);

    if (success) {
      setTitle('');
      // Keep open so user can quickly add another card
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
        className="w-full py-1.5 px-3 text-xs text-gray-500 font-medium hover:text-emerald-700 hover:bg-emerald-50/70 border border-dashed border-gray-200 hover:border-emerald-300 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
        title="Add a card to this list"
      >
        <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600" />
        <span>Add card</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-emerald-400/80 rounded-xl p-2.5 shadow-sm space-y-2 animate-in fade-in zoom-in-95 duration-100"
    >
      <textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter a title for this card..."
        rows={2}
        disabled={isSubmitting}
        className="w-full text-xs text-gray-800 placeholder-gray-400 bg-transparent resize-none focus:outline-none leading-relaxed"
      />

      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <span>Add card</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setTitle('');
            }}
            disabled={isSubmitting}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
            title="Cancel"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <span className="text-[10px] text-gray-400 hidden sm:inline">
          Press Enter ↵
        </span>
      </div>
    </form>
  );
}

