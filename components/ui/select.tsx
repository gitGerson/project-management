'use client';

import React, { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const emptySubscribe = () => () => {};

export interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
  badge?: string;
}

export interface CustomSelectProps {
  value: string | number;
  options: SelectOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'default';
}

export function CustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  isLoading = false,
  placeholder = 'Select option...',
  className,
  size = 'sm',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Update floating popover coordinates relative to viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(options.length * 48 + 16, 240);

    // If space below is insufficient and space above is larger, flip to open above
    const openAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    setMenuPosition({
      top: openAbove ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 190),
    });
  }, [options.length]);

  const handleToggle = useCallback(() => {
    if (disabled || isLoading) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [disabled, isLoading, isOpen, updatePosition]);

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || isLoading) return;

      if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen) {
          updatePosition();
          setIsOpen(true);
        } else {
          const currentIndex = options.findIndex((opt) => String(opt.value) === String(value));
          const nextIndex = Math.min(options.length - 1, currentIndex + 1);
          if (options[nextIndex]) {
            onChange(options[nextIndex].value);
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isOpen) {
          const currentIndex = options.findIndex((opt) => String(opt.value) === String(value));
          const prevIndex = Math.max(0, currentIndex - 1);
          if (options[prevIndex]) {
            onChange(options[prevIndex].value);
          }
        }
      }
    },
    [disabled, isLoading, isOpen, onChange, options, value, updatePosition, handleToggle]
  );

  // Click outside and scroll dismiss
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }

    function handleScroll(event: Event) {
      // If scroll happens outside the menu itself, dismiss popover to prevent drift
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleResize() {
      setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative inline-block text-left w-full', className)}>
      {/* Select Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled || isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-white border rounded-xl font-medium transition cursor-pointer select-none text-left shadow-2xs',
          'hover:bg-gray-50/80 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600',
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          isOpen ? 'border-green-600 ring-2 ring-green-500/20' : 'border-gray-200',
          disabled && 'opacity-60 cursor-not-allowed hover:bg-white hover:border-gray-200'
        )}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600 flex-shrink-0" />
              <span>Saving...</span>
            </span>
          ) : selectedOption ? (
            <span className="font-semibold text-gray-800 truncate">
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-gray-400 font-normal truncate">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180 text-gray-700'
          )}
        />
      </button>

      {/* Floating Popover Portal to escape table overflow clipping */}
      {isOpen && isMounted && menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            tabIndex={-1}
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: `${menuPosition.width}px`,
            }}
            className="z-[9999] bg-white rounded-xl shadow-xl border border-gray-100 p-1 overflow-y-auto max-h-60 focus:outline-none animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400 text-center">
                No options available
              </div>
            ) : (
              options.map((opt) => {
                const isSelected = String(opt.value) === String(value);

                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer text-left',
                      isSelected
                        ? 'bg-green-50/80 text-green-900 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900'
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="text-[10px] text-gray-400 truncate font-normal">
                          {opt.description}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
