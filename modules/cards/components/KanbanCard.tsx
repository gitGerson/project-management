'use client';

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  useSortable,
  defaultAnimateLayoutChanges,
  AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
import {
  Check,
  AlignLeft,
  Clock,
} from 'lucide-react';
import type { CardDTO } from '../types';
import { getContrastTextColor } from '../utils/color-contrast';
import { getMemberColor } from './CardMemberPicker';
import { getCardCoverImage } from '@/lib/file-type';
import {
  formatCompactDate,
  formatDateRange,
  getDueDateStatus,
} from '../utils/date-utils';

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
  onCardClick?: (card: CardDTO) => void;
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
  onCardClick,
  isOverlay = false,
}: KanbanCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(card.title);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isLabelsExpanded, setIsLabelsExpanded] = useState(false);
  const labelsContainerRef = useRef<HTMLDivElement>(null);
  const labelItemsRef = useRef<Map<number, HTMLElement>>(new Map());
  const pendingLabelFlip = useRef<{
    rects: Map<number, DOMRect>;
    containerH: number | null;
  } | null>(null);

  const captureLabelRects = () => {
    const rects = new Map<number, DOMRect>();
    labelItemsRef.current.forEach((el, id) => {
      if (el) {
        rects.set(id, el.getBoundingClientRect());
      }
    });
    const containerH = labelsContainerRef.current?.getBoundingClientRect().height || null;
    pendingLabelFlip.current = { rects, containerH };
  };

  useEffect(() => {
    const saved = localStorage.getItem('kanban:labels-expanded');
    if (saved !== null) {
      setIsLabelsExpanded(saved === 'true');
    }

    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ expanded: boolean }>;
      const next =
        customEvent.detail && typeof customEvent.detail.expanded === 'boolean'
          ? customEvent.detail.expanded
          : localStorage.getItem('kanban:labels-expanded') === 'true';

      captureLabelRects();
      setIsLabelsExpanded(next);
    };

    window.addEventListener('kanban:toggle-labels', handleSync);
    return () => window.removeEventListener('kanban:toggle-labels', handleSync);
  }, []);

  const handleToggleLabels = (e: React.MouseEvent) => {
    e.stopPropagation();
    captureLabelRects();
    const next = !isLabelsExpanded;
    setIsLabelsExpanded(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kanban:labels-expanded', String(next));
      window.dispatchEvent(
        new CustomEvent('kanban:toggle-labels', { detail: { expanded: next } })
      );
    }
  };

  useIsomorphicLayoutEffect(() => {
    if (!pendingLabelFlip.current) return;
    const { rects: oldRects, containerH: oldH } = pendingLabelFlip.current;
    pendingLabelFlip.current = null;

    // 1. Container height smooth interpolation
    if (labelsContainerRef.current && oldH !== null) {
      const container = labelsContainerRef.current;
      const newH = container.getBoundingClientRect().height;

      if (Math.abs(oldH - newH) > 1) {
        container.style.height = `${oldH}px`;
        container.style.overflow = 'hidden';
        container.style.transition = 'none';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.style.transition = 'height 320ms cubic-bezier(0.25, 1, 0.5, 1)';
            container.style.height = `${newH}px`;

            const onEnd = (e: TransitionEvent) => {
              if (e.target === container && e.propertyName === 'height') {
                container.style.height = '';
                container.style.transition = '';
                container.style.overflow = '';
                container.removeEventListener('transitionend', onEnd);
              }
            };
            container.addEventListener('transitionend', onEnd);
          });
        });
      }
    }

    // 2. Child element FLIP across rows (both X and Y!)
    labelItemsRef.current.forEach((el, id) => {
      if (!el) return;
      const oldRect = oldRects.get(id);
      if (!oldRect) return;

      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.style.transition = 'none';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transition =
              'transform 320ms cubic-bezier(0.25, 1, 0.5, 1)';
            el.style.transform = '';

            const onEnd = (e: TransitionEvent) => {
              if (e.target === el && e.propertyName === 'transform') {
                el.style.transition = '';
                el.removeEventListener('transitionend', onEnd);
              }
            };
            el.addEventListener('transitionend', onEnd);
          });
        });
      }
    });
  }, [isLabelsExpanded]);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

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

  const coverImage = getCardCoverImage(card);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isOverlay || isEditingTitle) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('textarea')) {
          return;
        }
        onCardClick?.(card);
      }}
      className={`group relative bg-white border border-gray-200/90 rounded-xl p-3 shadow-xs hover:border-gray-300 hover:shadow-xs transition-shadow cursor-grab active:cursor-grabbing select-none touch-manipulation overflow-hidden ${
        isOverlay ? 'shadow-xl ring-2 ring-emerald-500/20 rotate-1 cursor-grabbing' : ''
      }`}
    >
      {/* Card Cover Image */}
      {coverImage && (
        <div className="-mx-3 -mt-3 mb-2.5 h-32 sm:h-36 overflow-hidden rounded-t-xl bg-slate-100 relative group/cover select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage}
            alt={card.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
          />
        </div>
      )}

      {/* Card Labels (Pills) - Collapsible on click without button */}
      {card.labels && card.labels.length > 0 && (
        <div
          ref={labelsContainerRef}
          className="flex flex-wrap items-center gap-1 mb-2"
          onClick={handleToggleLabels}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {card.labels.map((lbl) => {
            const textColor = getContrastTextColor(lbl.color);
            return (
              <span
                key={lbl.id}
                ref={(node) => {
                  if (node) labelItemsRef.current.set(lbl.id, node);
                  else labelItemsRef.current.delete(lbl.id);
                }}
                style={{
                  backgroundColor: lbl.color || '#f1f5f9',
                  color: textColor,
                }}
                className={`inline-flex items-center font-bold shadow-2xs tracking-tight select-none cursor-pointer transition-all duration-300 ease-out hover:opacity-85 active:scale-95 ${
                  !lbl.color ? 'border border-gray-300' : ''
                } ${
                  isLabelsExpanded
                    ? 'h-4.5 px-2 text-[10px] rounded-md max-w-full truncate'
                    : 'h-2 w-8 sm:w-10 rounded-full'
                }`}
                title={
                  lbl.title
                    ? `${lbl.title} (Klik untuk ${isLabelsExpanded ? 'shrink' : 'expand'})`
                    : `Label (Klik untuk ${isLabelsExpanded ? 'shrink' : 'expand'})`
                }
              >
                {isLabelsExpanded ? (lbl.title || '') : null}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        {/* Card Title or Inline Title Edit */}
        <div
          className="flex-1 min-w-0"
          {...(isEditingTitle
            ? {
                onClick: (e: React.MouseEvent) => e.stopPropagation(),
                onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
                onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
              }
            : {})}
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
              onDoubleClick={(e) => {
                if (canUpdate) {
                  e.stopPropagation();
                  setTitleInput(card.title);
                  setIsEditingTitle(true);
                }
              }}
              className="text-xs sm:text-[13px] font-medium text-gray-800 leading-snug break-words"
              title={canUpdate ? 'Double-click to rename, click to view detail' : card.title}
            >
              {card.title}
            </p>
          )}
        </div>
      </div>

      {/* Card Footer: Metadata (Dates, Description indicator & Owner avatar) */}
      <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center justify-between text-gray-400">
        <div className="flex items-center gap-2">
          {/* Due date badge */}
          {(card.startDate || card.dueDate) && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border shadow-2xs ${
                getDueDateStatus(card.dueDate).badgeClass
              }`}
              title={formatDateRange(card.startDate, card.dueDate)}
            >
              <Clock className="w-3 h-3" />
              <span>
                {card.dueDate
                  ? formatCompactDate(card.dueDate)
                  : card.startDate
                  ? formatCompactDate(card.startDate)
                  : ''}
              </span>
            </span>
          )}

          {card.description && (
            <span
              className="flex items-center text-gray-400 hover:text-gray-600"
              title="Card has description"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Member avatars or Owner avatar fallback */}
        {card.members && card.members.length > 0 ? (
          <div
            className="flex items-center -space-x-1.5"
            title={`Assigned to: ${card.members.map((m) => m.user.name).join(', ')}`}
          >
            {card.members.slice(0, 3).map((m) => {
              const initial = m.user.name ? m.user.name.trim()[0].toUpperCase() : 'U';
              const { bg, text } = getMemberColor(m.userId);
              return (
                <div
                  key={m.userId}
                  style={{ backgroundColor: bg, color: text }}
                  className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white shadow-2xs"
                  title={`${m.user.name} (@${m.user.username})`}
                >
                  {m.user.profilePicture ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.user.profilePicture}
                      alt={m.user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
              );
            })}
            {card.members.length > 3 && (
              <div
                className="w-5 h-5 rounded-full bg-gray-100 text-gray-700 text-[8px] font-bold flex items-center justify-center shrink-0 ring-1 ring-white shadow-2xs"
                title={`${card.members.length - 3} more members`}
              >
                +{card.members.length - 3}
              </div>
            )}
          </div>
        ) : card.owner ? (
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
        ) : null}
      </div>
    </div>
  );
}

