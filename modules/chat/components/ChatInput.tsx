'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<boolean | void>;
  placeholder?: string;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  placeholder = 'Type a message...',
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      await onSendMessage(trimmed);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 bg-white border-t border-gray-100 flex items-end gap-2"
    >
      <div className="flex-1 relative bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-[#15803d] focus-within:ring-1 focus-within:ring-[#15803d] transition-all">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          className="w-full resize-none bg-transparent px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden max-h-[120px] scrollbar-thin"
        />
      </div>

      <button
        type="submit"
        disabled={!text.trim() || disabled || isSubmitting}
        className="shrink-0 p-2.5 bg-[#15803d] hover:bg-[#166534] active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl transition-all flex items-center justify-center shadow-xs cursor-pointer"
        title="Send (Enter)"
        aria-label="Send message"
      >
        <SendHorizontal className="w-4 h-4" />
      </button>
    </form>
  );
};
