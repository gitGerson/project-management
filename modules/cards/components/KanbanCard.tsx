'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  useSortable,
  defaultAnimateLayoutChanges,
  AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  MoreHorizontal,
  Trash2,
  Pencil,
  Check,
  AlignLeft,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { CardDTO } from '../types';

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.wasDragging ? false : defaultAnimateLayoutChanges(args);

interface KanbanCardProps {
  card: CardDTO;
  canUpdate: boolean;
  canDelete: boolean;
  onUpdateTitle: (cardId: number, newTitle: string) => Promise<boolean>;
  onDeleteCard: (cardId: number) => Promise<boolean>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isOverlay?: boolean;
}

export function KanbanCard({
  card,
  canUpdate,
  canDelete,
  onUpdateTitle,
  onDeleteCard,
  onMoveUp,
  onMoveDown,
  isOverlay = false,
}: KanbanCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(card.title);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmDelete, setIsConfirmDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
        setIsConfirmDelete(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleSaveTitle = async () => {
    const trimmed = titleInput.trim();
    if (!trimmed || trimmed === card.title) {
      setTitleInput(card.title);
      setIsEditingTitle(false);
      return;
    }

    setIsSubmitting(true);
    const success = await onUpdateTitle(card.id, trimmed);
    setIsSubmitting(false);

    if (success) {
      setIsEditingTitle(false);
    } else {
      setTitleInput(card.title);
      setIsEditingTitle(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setTitleInput(card.title);
      setIsEditingTitle(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    await onDeleteCard(card.id);
    setIsSubmitting(false);
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `card-${card.id}`,
    disabled: !canUpdate || isOverlay,
    animateLayoutChanges,
    data: {
      type: 'card',
      card,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const creatorInitial = card.owner?.name
    ? card.owner.name.trim()[0].toUpperCase()
    : 'U';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative bg-white border border-gray-200/90 rounded-xl p-3 shadow-xs hover:border-gray-300 hover:shadow-xs transition-shadow cursor-grab active:cursor-grabbing select-none touch-manipulation ${
        isOverlay ? 'shadow-xl ring-2 ring-emerald-500/20 rotate-1 cursor-grabbing' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Card Title or Inline Title Edit */}
        <div
          className="flex-1 min-w-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {isEditingTitle && canUpdate ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                className="w-full text-xs font-semibold text-gray-900 bg-gray-50 px-2 py-1 border border-emerald-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer shrink-0"
                title="Save title"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p
              onClick={() => {
                if (canUpdate) {
                  setTitleInput(card.title);
                  setIsEditingTitle(true);
                }
              }}
              className="text-xs sm:text-[13px] font-medium text-gray-800 leading-snug break-words"
              title={canUpdate ? 'Click to rename' : card.title}
            >
              {card.title}
            </p>
          )}
        </div>

        {/* Card Actions Dropdown (Stop drag propagation) */}
        {(canUpdate || canDelete) && !isOverlay && (
          <div
            className="relative shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen((prev) => !prev);
                setIsConfirmDelete(false);
              }}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label="Card actions"
              title="Card options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200/90 rounded-xl shadow-lg p-1 z-30 text-xs text-gray-700 animate-in fade-in duration-150">
                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setTitleInput(card.title);
                      setIsEditingTitle(true);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2 cursor-pointer text-gray-700"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    <span>Rename</span>
                  </button>
                )}

                {canUpdate && onMoveUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onMoveUp();
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2 cursor-pointer text-gray-700"
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-gray-400" />
                    <span>Move Up</span>
                  </button>
                )}

                {canUpdate && onMoveDown && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onMoveDown();
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2 cursor-pointer text-gray-700"
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-gray-400" />
                    <span>Move Down</span>
                  </button>
                )}

                {canDelete && (
                  <>
                    <div className="h-px bg-gray-100 my-1" />
                    {isConfirmDelete ? (
                      <div className="p-1 text-center">
                        <p className="text-[10px] text-red-600 font-semibold mb-1.5">
                          Delete card?
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="flex-1 py-0.5 px-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded text-[10px] transition cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsConfirmDelete(false)}
                            className="flex-1 py-0.5 px-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded text-[10px] transition cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsConfirmDelete(true)}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Delete</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Metadata (Description indicator & Owner avatar) */}
      <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center justify-between text-gray-400">
        <div className="flex items-center gap-2">
          {card.description && (
            <span
              className="flex items-center text-gray-400 hover:text-gray-600"
              title="Card has description"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Owner avatar */}
        {card.owner && (
          <div
            className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white"
            title={`Created by ${card.owner.name}`}
          >
            {card.owner.profilePicture ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={card.owner.profilePicture}
                alt={card.owner.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{creatorInitial}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

