'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  TagPlus,
  X,
  Check,
  Pencil,
  ArrowLeft,
  Trash2,
  Plus,
} from 'lucide-react';
import type { CardDTO, LabelDTO } from '../types';
import {
  getBoardLabelsAction,
  createLabelAction,
  updateLabelAction,
  deleteLabelAction,
  toggleCardLabelAction,
} from '../actions';
import { getContrastTextColor } from '../utils/color-contrast';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const LABEL_COLORS = [
  // Row 1
  '#61bd4f', '#f2d600', '#ff9f1a', '#eb5a46', '#c377e0', '#0079bf', '#00c2e0',
  // Row 2
  '#51e898', '#ff78cb', '#344563', '#20c997', '#e67e22', '#ff6b6b', '#8e44ad',
  // Row 3
  '#74b9ff', '#00d2d3', '#a8e6cf', '#f8a5c2', '#708090', '#3867d6', '#0984e3',
  // Row 4
  '#218c74', '#5f27cd', '#4b6584',
];

interface CardLabelPickerProps {
  card: CardDTO;
  canUpdate?: boolean;
  onCardUpdated: (updatedCard: CardDTO) => void;
}

export const CardLabelPicker: React.FC<CardLabelPickerProps> = ({
  card,
  canUpdate = true,
  onCardUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [boardLabels, setBoardLabels] = useState<LabelDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mode: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingLabel, setEditingLabel] = useState<LabelDTO | null>(null);

  // Form state for create / edit
  const [formTitle, setFormTitle] = useState('');
  const [formColor, setFormColor] = useState<string | null>(LABEL_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Positioning & animation refs
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string | number, HTMLElement>>(new Map());
  const isAnimatingRef = useRef(false);
  const pendingFlip = useRef<{
    isExpanding: boolean;
    labelRects: Map<string | number, { width: number; height: number; left: number; top: number }>;
    tagBtnRect: DOMRect | null;
    containerH: number | null;
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const toggleExpanded = useCallback(() => {
    if (isAnimatingRef.current) return;

    const containerH = containerRef.current?.getBoundingClientRect().height || null;
    const labelRects = new Map<string | number, { width: number; height: number; left: number; top: number }>();

    (card.labels || []).forEach((lbl) => {
      const el = itemRefs.current.get(lbl.id);
      if (el) {
        const r = el.getBoundingClientRect();
        labelRects.set(lbl.id, {
          width: r.width,
          height: r.height,
          left: r.left,
          top: r.top,
        });
      }
    });

    const tagBtn = itemRefs.current.get('tag-plus-button');
    const tagBtnRect = tagBtn ? tagBtn.getBoundingClientRect() : null;

    pendingFlip.current = {
      isExpanding: !isExpanded,
      labelRects,
      tagBtnRect,
      containerH,
    };

    setIsExpanded((prev) => !prev);
  }, [isExpanded, card.labels]);

  useIsomorphicLayoutEffect(() => {
    if (!pendingFlip.current) return;
    const { isExpanding, labelRects, tagBtnRect, containerH: oldH } = pendingFlip.current;
    pendingFlip.current = null;

    // 1. Container height smooth interpolation
    if (containerRef.current && oldH !== null) {
      const container = containerRef.current;
      const newH = container.getBoundingClientRect().height;

      if (Math.abs(oldH - newH) > 1) {
        container.style.height = `${oldH}px`;
        container.style.overflow = 'hidden';
        container.style.transition = 'none';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.style.transition = 'height 700ms cubic-bezier(0.25, 1, 0.5, 1)';
            container.style.height = `${newH}px`;

            const onTransitionEnd = (e: TransitionEvent) => {
              if (e.target === container && e.propertyName === 'height') {
                container.style.height = '';
                container.style.transition = '';
                container.style.overflow = '';
                container.removeEventListener('transitionend', onTransitionEnd);
              }
            };
            container.addEventListener('transitionend', onTransitionEnd);
          });
        });
      }
    }

    const cardLabels = card.labels || [];
    isAnimatingRef.current = true;

    if (!isExpanding) {
      // ===== SHRINKING: Smoothly contract pills to colored circular dots =====
      // Before paint: Lock each label to its current expanded width and styles
      cardLabels.forEach((lbl) => {
        const el = itemRefs.current.get(lbl.id);
        const old = labelRects.get(lbl.id);
        if (el && old) {
          el.style.transition = 'none';
          el.style.width = `${old.width}px`;
          el.style.height = `${old.height}px`;
          el.style.padding = '0 10px';
          el.style.borderRadius = '8px';
        }
      });

      // Animate smoothly to 20px x 20px circular dot
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cardLabels.forEach((lbl) => {
            const el = itemRefs.current.get(lbl.id);
            if (el) {
              el.style.transition =
                'width 700ms cubic-bezier(0.25, 1, 0.5, 1), height 700ms cubic-bezier(0.25, 1, 0.5, 1), padding 700ms cubic-bezier(0.25, 1, 0.5, 1), border-radius 700ms cubic-bezier(0.25, 1, 0.5, 1)';
              el.style.width = '20px';
              el.style.height = '20px';
              el.style.padding = '0';
              el.style.borderRadius = '9999px';
            }
          });

          // Row change adjustment (translateY)
          cardLabels.forEach((lbl) => {
            const el = itemRefs.current.get(lbl.id);
            const old = labelRects.get(lbl.id);
            if (el && old) {
              const newRect = el.getBoundingClientRect();
              const dy = old.top - newRect.top;
              if (Math.abs(dy) > 4) {
                el.style.transform = `translateY(${dy}px)`;
                requestAnimationFrame(() => {
                  el.style.transition = `${el.style.transition}, transform 700ms cubic-bezier(0.25, 1, 0.5, 1)`;
                  el.style.transform = '';
                });
              }
            }
          });

          const tagBtn = itemRefs.current.get('tag-plus-button');
          if (tagBtn && tagBtnRect) {
            const newTagRect = tagBtn.getBoundingClientRect();
            const dy = tagBtnRect.top - newTagRect.top;
            if (Math.abs(dy) > 4) {
              tagBtn.style.transform = `translateY(${dy}px)`;
              tagBtn.style.transition = 'none';
              requestAnimationFrame(() => {
                tagBtn.style.transition = 'transform 700ms cubic-bezier(0.25, 1, 0.5, 1)';
                tagBtn.style.transform = '';
              });
            }
          }

          setTimeout(() => {
            cardLabels.forEach((lbl) => {
              const el = itemRefs.current.get(lbl.id);
              if (el) {
                el.style.width = '';
                el.style.height = '';
                el.style.padding = '';
                el.style.borderRadius = '';
                el.style.transition = '';
                el.style.transform = '';
              }
            });
            if (tagBtn) {
              tagBtn.style.transform = '';
              tagBtn.style.transition = '';
            }
            isAnimatingRef.current = false;
          }, 720);
        });
      });
    } else {
      // ===== EXPANDING: Smoothly expand colored dots into full pills =====
      const targetWidths = new Map<string | number, number>();
      cardLabels.forEach((lbl) => {
        const el = itemRefs.current.get(lbl.id);
        if (el) {
          targetWidths.set(lbl.id, el.getBoundingClientRect().width);
          // Before paint: Lock immediately to 20px circular dot
          el.style.transition = 'none';
          el.style.width = '20px';
          el.style.height = '20px';
          el.style.padding = '0';
          el.style.borderRadius = '9999px';
        }
      });

      // Animate smoothly to expanded width & height
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cardLabels.forEach((lbl) => {
            const el = itemRefs.current.get(lbl.id);
            const targetW = targetWidths.get(lbl.id);
            if (el && targetW) {
              el.style.transition =
                'width 700ms cubic-bezier(0.25, 1, 0.5, 1), height 700ms cubic-bezier(0.25, 1, 0.5, 1), padding 700ms cubic-bezier(0.25, 1, 0.5, 1), border-radius 700ms cubic-bezier(0.25, 1, 0.5, 1)';
              el.style.width = `${targetW}px`;
              el.style.height = '28px';
              el.style.padding = '0 10px';
              el.style.borderRadius = '8px';
            }
          });

          // Row change adjustment (translateY)
          cardLabels.forEach((lbl) => {
            const el = itemRefs.current.get(lbl.id);
            const old = labelRects.get(lbl.id);
            if (el && old) {
              const newRect = el.getBoundingClientRect();
              const dy = old.top - newRect.top;
              if (Math.abs(dy) > 4) {
                el.style.transform = `translateY(${dy}px)`;
                requestAnimationFrame(() => {
                  el.style.transition = `${el.style.transition}, transform 700ms cubic-bezier(0.25, 1, 0.5, 1)`;
                  el.style.transform = '';
                });
              }
            }
          });

          const tagBtn = itemRefs.current.get('tag-plus-button');
          if (tagBtn && tagBtnRect) {
            const newTagRect = tagBtn.getBoundingClientRect();
            const dy = tagBtnRect.top - newTagRect.top;
            if (Math.abs(dy) > 4) {
              tagBtn.style.transform = `translateY(${dy}px)`;
              tagBtn.style.transition = 'none';
              requestAnimationFrame(() => {
                tagBtn.style.transition = 'transform 700ms cubic-bezier(0.25, 1, 0.5, 1)';
                tagBtn.style.transform = '';
              });
            }
          }

          setTimeout(() => {
            cardLabels.forEach((lbl) => {
              const el = itemRefs.current.get(lbl.id);
              if (el) {
                el.style.width = '';
                el.style.height = '';
                el.style.padding = '';
                el.style.borderRadius = '';
                el.style.transition = '';
                el.style.transform = '';
              }
            });
            if (tagBtn) {
              tagBtn.style.transform = '';
              tagBtn.style.transition = '';
            }
            isAnimatingRef.current = false;
          }, 720);
        });
      });
    }
  }, [isExpanded, card.labels]);

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popoverWidth - 16);
    }
    const top = rect.bottom + 6;
    setCoords({ top, left });
  }, []);

  // Fetch labels for board
  const loadBoardLabels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBoardLabelsAction(card.boardId);
      if (res.success && res.data) {
        setBoardLabels(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, [card.boardId]);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadBoardLabels();
      setViewMode('list');
      setSearchQuery('');
    }
  }, [isOpen, updateCoords, loadBoardLabels]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen, updateCoords]);

  // Toggle label on card
  const handleToggleLabel = async (label: LabelDTO) => {
    if (!canUpdate) return;

    // Optimistic card update
    const currentLabels = card.labels || [];
    const isAlreadyAttached = currentLabels.some((l) => l.id === label.id);
    const updatedLabels = isAlreadyAttached
      ? currentLabels.filter((l) => l.id !== label.id)
      : [...currentLabels, label];

    const optimisticCard: CardDTO = {
      ...card,
      labels: updatedLabels,
    };
    onCardUpdated(optimisticCard);

    const res = await toggleCardLabelAction({
      cardId: card.id,
      labelId: label.id,
    });

    if (res.success && res.data) {
      onCardUpdated(res.data.card);
    } else {
      // Rollback on error
      onCardUpdated(card);
      alert(res.message || 'Gagal mengubah label');
    }
  };

  // Switch to Create Mode
  const handleOpenCreate = () => {
    setFormTitle('');
    setFormColor(LABEL_COLORS[0]);
    setViewMode('create');
  };

  // Switch to Edit Mode
  const handleOpenEdit = (label: LabelDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLabel(label);
    setFormTitle(label.title || '');
    setFormColor(label.color || LABEL_COLORS[0]);
    setViewMode('edit');
  };

  // Save (Create or Update)
  const handleSaveLabel = async () => {
    setIsSubmitting(true);
    try {
      if (viewMode === 'create') {
        const res = await createLabelAction({
          boardId: card.boardId,
          title: formTitle,
          color: formColor,
        });
        if (res.success && res.data) {
          const newLabel = res.data;
          setBoardLabels((prev) => [...prev, newLabel]);
          // Automatically attach to card
          await handleToggleLabel(newLabel);
          setViewMode('list');
        } else {
          alert(res.message || 'Gagal membuat label');
        }
      } else if (viewMode === 'edit' && editingLabel) {
        const res = await updateLabelAction(editingLabel.id, {
          title: formTitle,
          color: formColor,
        });
        if (res.success && res.data) {
          const updated = res.data;
          setBoardLabels((prev) =>
            prev.map((l) => (l.id === updated.id ? updated : l))
          );
          // Update card labels if it had this label
          const currentLabels = card.labels || [];
          if (currentLabels.some((l) => l.id === updated.id)) {
            onCardUpdated({
              ...card,
              labels: currentLabels.map((l) => (l.id === updated.id ? updated : l)),
            });
          }
          setViewMode('list');
        } else {
          alert(res.message || 'Gagal memperbarui label');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete label
  const handleDeleteLabel = async () => {
    if (!editingLabel) return;
    if (!confirm('Hapus label ini? Label akan dihapus dari semua kartu di papan ini.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await deleteLabelAction(editingLabel.id);
      if (res.success) {
        setBoardLabels((prev) => prev.filter((l) => l.id !== editingLabel.id));
        // Remove from card
        const currentLabels = card.labels || [];
        onCardUpdated({
          ...card,
          labels: currentLabels.filter((l) => l.id !== editingLabel.id),
        });
        setViewMode('list');
      } else {
        alert(res.message || 'Failed to delete label');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardLabels = card.labels || [];
  const filteredLabels = boardLabels.filter((l) =>
    (l.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mb-5">
      <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
        Labels
      </span>

      <div ref={containerRef} className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Applied Labels */}
        {cardLabels.map((lbl) => {
          const textColor = getContrastTextColor(lbl.color);
          return (
            <span
              key={lbl.id}
              ref={(node) => {
                if (node) itemRefs.current.set(lbl.id, node);
                else itemRefs.current.delete(lbl.id);
              }}
              onClick={toggleExpanded}
              style={{
                backgroundColor: lbl.color || '#f1f5f9',
                color: textColor,
              }}
              className={`inline-flex items-center font-bold shadow-2xs tracking-tight cursor-pointer hover:opacity-90 active:scale-95 select-none overflow-hidden ${
                !lbl.color ? 'border border-gray-300' : ''
              } ${
                isExpanded
                  ? 'h-7 px-2.5 rounded-lg text-xs'
                  : 'h-5 w-5 rounded-full p-0 justify-center shrink-0'
              }`}
              title={lbl.title ? `${lbl.title} (Click to ${isExpanded ? 'shrink' : 'expand'})` : `Click to ${isExpanded ? 'shrink' : 'expand'}`}
            >
              <span
                className={`overflow-hidden whitespace-nowrap truncate select-none ${
                  isExpanded
                    ? 'opacity-100 transition-opacity duration-300 ease-out delay-150'
                    : 'opacity-0 transition-opacity duration-200 ease-in'
                }`}
              >
                {lbl.title || ' '}
              </span>
            </span>
          );
        })}

        {/* Add Label Icon Button using TagPlus (fixed size, never shrinks) */}
        {canUpdate && (
          <button
            ref={(el) => {
              (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
              if (el) itemRefs.current.set('tag-plus-button', el);
              else itemRefs.current.delete('tag-plus-button');
            }}
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 border border-gray-200/80 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0"
            title="Add label"
            aria-label="Add label"
          >
            <TagPlus className="w-3.5 h-3.5" />
          </button>
        )}

        {!canUpdate && cardLabels.length === 0 && (
          <span className="text-xs text-gray-400 italic">No labels</span>
        )}
      </div>

      {/* Popover */}
      {isOpen &&
        coords &&
        mounted &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="w-72 bg-white border border-gray-200/90 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-gray-800"
          >
            {/* VIEW MODE 1: LIST LABELS */}
            {viewMode === 'list' && (
              <div className="flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-700 mx-auto">
                    Labels
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer -mr-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search labels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Labels
                </span>

                {/* Labels List */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin">
                  {loading ? (
                    <div className="py-6 text-center text-xs text-gray-400">
                      Loading labels...
                    </div>
                  ) : filteredLabels.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">
                      No labels found
                    </div>
                  ) : (
                    filteredLabels.map((lbl) => {
                      const isChecked = cardLabels.some((l) => l.id === lbl.id);
                      return (
                        <div
                          key={lbl.id}
                          className="flex items-center gap-1.5 group select-none"
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => handleToggleLabel(lbl)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                              isChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-gray-300 hover:border-gray-400 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>

                          {/* Label Pill Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleLabel(lbl)}
                            style={{
                              backgroundColor: lbl.color || '#f1f5f9',
                              color: getContrastTextColor(lbl.color),
                            }}
                            className={`flex-1 h-8 rounded-lg px-3 flex items-center text-left text-xs font-bold shadow-2xs hover:opacity-90 transition-opacity truncate cursor-pointer ${
                              !lbl.color ? 'border border-gray-300' : ''
                            }`}
                          >
                            <span className="truncate">{lbl.title || ' '}</span>
                          </button>

                          {/* Edit Pencil */}
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(lbl, e)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Edit label"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Create Label Button */}
                {canUpdate && (
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="w-full mt-3 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create a new label</span>
                  </button>
                )}
              </div>
            )}

            {/* VIEW MODE 2: CREATE / EDIT LABEL (Exact match to Image 1) */}
            {(viewMode === 'create' || viewMode === 'edit') && (
              <div className="flex flex-col">
                {/* Header with Back and Title */}
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-200"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back</span>
                  </button>

                  <span className="text-xs font-bold text-gray-800">
                    {viewMode === 'create' ? 'Create label' : 'Edit label'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer -mr-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Preview Box */}
                <div
                  style={{
                    backgroundColor: formColor || '#f1f5f9',
                    color: getContrastTextColor(formColor),
                  }}
                  className={`w-full h-9 rounded-lg flex items-center justify-center px-3 mb-3 font-bold text-xs shadow-2xs transition-colors ${
                    !formColor ? 'border border-gray-300' : ''
                  }`}
                >
                  <span className="truncate">{formTitle || ' '}</span>
                </div>

                {/* Title Input */}
                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Contoh: TYPE - PROJECT"
                    className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Select a Color (7-column grid matching Image 1) */}
                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                    Select a color
                  </label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {LABEL_COLORS.map((c) => {
                      const isSelected = formColor?.toLowerCase() === c.toLowerCase();
                      const checkColor = getContrastTextColor(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormColor(c)}
                          style={{ backgroundColor: c }}
                          className={`w-7 h-7 rounded-md transition-transform flex items-center justify-center cursor-pointer shadow-2xs ${
                            isSelected
                              ? 'ring-2 ring-offset-1 ring-gray-800 scale-105'
                              : 'hover:scale-105'
                          }`}
                        >
                          {isSelected && (
                            <Check
                              style={{ color: checkColor }}
                              className="w-3.5 h-3.5 stroke-[3]"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Remove Color Button */}
                <button
                  type="button"
                  onClick={() => setFormColor(null)}
                  className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer mb-3"
                >
                  Remove color
                </button>

                {/* Action Buttons: Create / Save & Delete */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveLabel}
                    disabled={isSubmitting}
                    className="flex-1 py-2 px-3 bg-[#61bd4f] hover:bg-[#5aac44] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmitting
                      ? 'Saving...'
                      : viewMode === 'create'
                      ? 'Create'
                      : 'Save'}
                  </button>

                  {viewMode === 'edit' && (
                    <button
                      type="button"
                      onClick={handleDeleteLabel}
                      disabled={isSubmitting}
                      className="p-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors cursor-pointer"
                      title="Delete label"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

