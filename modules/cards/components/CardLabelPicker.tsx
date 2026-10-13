'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Tag,
  ChevronDown,
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

  // Positioning
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        alert(res.message || 'Gagal menghapus label');
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

      <div className="flex flex-wrap items-center gap-2">
        {/* Add Label Button */}
        {canUpdate && (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs font-semibold text-gray-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5 text-gray-500" />
            <span>Add label</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        )}

        {/* Applied Labels */}
        {cardLabels.map((lbl) => {
          const textColor = getContrastTextColor(lbl.color);
          return (
            <span
              key={lbl.id}
              onClick={() => canUpdate && setIsOpen(true)}
              style={{
                backgroundColor: lbl.color || '#f1f5f9',
                color: textColor,
              }}
              className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold shadow-2xs transition-transform tracking-tight truncate max-w-[200px] ${
                !lbl.color ? 'border border-gray-300' : ''
              } ${
                canUpdate ? 'cursor-pointer hover:scale-102 active:scale-98' : ''
              }`}
              title={lbl.title || 'Label'}
            >
              {lbl.title || ' '}
            </span>
          );
        })}
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
                      Memuat label...
                    </div>
                  ) : filteredLabels.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">
                      Tidak ada label ditemukan
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

