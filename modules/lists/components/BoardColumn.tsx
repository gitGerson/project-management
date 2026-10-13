'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  Trash2,
  Pencil,
  Plus,
  Check,
  Layers,
  GripVertical,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import {
  useSortable,
  defaultAnimateLayoutChanges,
  AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ListDTO } from '../types';

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.wasDragging ? false : defaultAnimateLayoutChanges(args);

interface BoardColumnProps {
  list: ListDTO;
  canUpdate: boolean;
  canDelete: boolean;
  onUpdateTitle: (listId: number, newTitle: string) => Promise<boolean>;
  onDeleteList: (listId: number) => Promise<boolean>;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  isOverlay?: boolean;
}

export function BoardColumn({
  list,
  canUpdate,
  canDelete,
  onUpdateTitle,
  onDeleteList,
  onMoveLeft,
  onMoveRight,
  isOverlay = false,
}: BoardColumnProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(list.title);
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

  // Click outside to close menu
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
    if (!trimmed || trimmed === list.title) {
      setTitleInput(list.title);
      setIsEditingTitle(false);
      return;
    }

    setIsSubmitting(true);
    const success = await onUpdateTitle(list.id, trimmed);
    setIsSubmitting(false);

    if (success) {
      setIsEditingTitle(false);
    } else {
      setTitleInput(list.title);
      setIsEditingTitle(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setTitleInput(list.title);
      setIsEditingTitle(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    await onDeleteList(list.id);
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
    id: list.id,
    disabled: !canUpdate || isOverlay,
    animateLayoutChanges,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-[280px] sm:w-[300px] shrink-0 bg-white rounded-2xl border border-gray-200/90 shadow-xs flex flex-col max-h-[calc(100vh-140px)] ${
        isOverlay ? 'shadow-2xl ring-2 ring-emerald-500/20' : ''
      }`}
    >
      {/* Column Header */}
      <div className="px-3.5 py-3 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div
            {...attributes}
            {...listeners}
            className={`p-1 -ml-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors ${
              canUpdate && !isOverlay
                ? 'cursor-grab active:cursor-grabbing touch-none'
                : 'cursor-default'
            }`}
            title={canUpdate ? 'Drag to reorder column' : undefined}
            aria-label="Drag column handle"
          >
            <GripVertical className="w-3.5 h-3.5 shrink-0" />
          </div>

          <div className="flex-1 min-w-0">
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
                  className="w-full text-xs sm:text-sm font-bold text-gray-900 bg-gray-50 px-2 py-1 border border-emerald-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer"
                  title="Save title"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h3
                onClick={() => {
                  if (canUpdate) {
                    setTitleInput(list.title);
                    setIsEditingTitle(true);
                  }
                }}
                className={`text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-tight py-1 px-1 rounded-md transition-colors truncate ${
                  canUpdate
                    ? 'hover:bg-gray-100 cursor-pointer'
                    : 'cursor-default'
                }`}
                title={canUpdate ? 'Click to rename' : list.title}
              >
                {list.title}
              </h3>
            )}
          </div>
        </div>

        {/* Header Right: Card count badge & Actions Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200/50">
            0
          </span>

          {(canUpdate || canDelete) && (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen((prev) => !prev);
                  setIsConfirmDelete(false);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Column actions"
                title="Column menu"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200/90 rounded-xl shadow-lg p-1 z-30 text-xs text-gray-700 animate-in fade-in duration-150">
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setTitleInput(list.title);
                        setIsEditingTitle(true);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      <span>Rename List</span>
                    </button>
                  )}

                  {canUpdate && onMoveLeft && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onMoveLeft();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2 cursor-pointer text-gray-700"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-gray-400" />
                      <span>Move Left</span>
                    </button>
                  )}

                  {canUpdate && onMoveRight && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onMoveRight();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2 cursor-pointer text-gray-700"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                      <span>Move Right</span>
                    </button>
                  )}

                  {canDelete && (
                    <>
                      <div className="h-px bg-gray-100 my-1" />
                      {isConfirmDelete ? (
                        <div className="p-1.5 text-center">
                          <p className="text-[11px] text-red-600 font-semibold mb-2">
                            Delete this list?
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleDelete}
                              disabled={isSubmitting}
                              className="flex-1 py-1 px-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md text-[10px] transition cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsConfirmDelete(false)}
                              className="flex-1 py-1 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md text-[10px] transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsConfirmDelete(true)}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          <span>Delete List</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Card Top Action Button (Positioned below header, before cards) */}
      <div className="p-2.5 pb-1 shrink-0">
        <button
          type="button"
          disabled
          className="w-full py-1.5 px-3 text-xs text-gray-400 font-medium hover:text-gray-600 hover:bg-gray-50 border border-dashed border-gray-200/90 hover:border-gray-300 rounded-xl flex items-center justify-center gap-1.5 transition cursor-not-allowed opacity-80"
          title="Cards feature will be added in the next step"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add card</span>
        </button>
      </div>

      {/* Cards List Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[100px] max-h-[calc(100vh-230px)]">
        <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center text-gray-400">
          <Layers className="w-4 h-4 mx-auto mb-1 text-gray-300" />
          <p className="text-[11px] text-gray-400">No cards in this list</p>
        </div>
      </div>
    </div>
  );
}
