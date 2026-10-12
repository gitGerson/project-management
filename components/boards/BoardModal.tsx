'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Pencil,
  Check,
  Loader2,
  Camera,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  Pin,
} from 'lucide-react';
import { updateBoardAction, deleteBoardAction } from '@/modules/boards/actions';
import { uploadFileDirectly } from '@/lib/upload-client';
import type { BoardDTO } from '@/modules/boards/types';
import type { BoardData } from './BoardCard';
import { BoardMembersSection } from './BoardMembersSection';

const emptySubscribe = () => () => {};

const PRESET_GRADIENTS = [
  { id: 'emerald', label: 'Emerald', value: 'gradient:bg-gradient-to-br from-emerald-600 to-teal-800', preview: 'bg-gradient-to-br from-emerald-600 to-teal-800' },
  { id: 'blue', label: 'Ocean Blue', value: 'gradient:bg-gradient-to-br from-blue-600 to-indigo-800', preview: 'bg-gradient-to-br from-blue-600 to-indigo-800' },
  { id: 'amber', label: 'Amber Warmth', value: 'gradient:bg-gradient-to-br from-amber-500 to-orange-600', preview: 'bg-gradient-to-br from-amber-500 to-orange-600' },
  { id: 'rose', label: 'Berry Rose', value: 'gradient:bg-gradient-to-br from-rose-500 to-pink-700', preview: 'bg-gradient-to-br from-rose-500 to-pink-700' },
  { id: 'purple', label: 'Royal Purple', value: 'gradient:bg-gradient-to-br from-purple-600 to-indigo-900', preview: 'bg-gradient-to-br from-purple-600 to-indigo-900' },
  { id: 'slate', label: 'Dark Slate', value: 'gradient:bg-gradient-to-br from-slate-700 to-slate-900', preview: 'bg-gradient-to-br from-slate-700 to-slate-900' },
  { id: 'minimal', label: 'Clean Neutral', value: '', preview: 'bg-gradient-to-br from-slate-100 to-slate-200' },
];

export interface BoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: BoardData | BoardDTO | null;
  canEdit?: boolean;
  canDelete?: boolean;
  onUpdate?: (updatedBoard: BoardDTO) => void;
  onDelete?: (id: number) => void;
  initialFocusField?: 'title' | 'description' | null;
}

export function BoardModal({
  isOpen,
  onClose,
  board,
  canEdit = true,
  canDelete = false,
  onUpdate,
  onDelete,
  initialFocusField = null,
}: BoardModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Editable local state
  const [name, setName] = useState(board?.name || '');
  const [description, setDescription] = useState(board?.description || '');
  const [coverImage, setCoverImage] = useState<string | null>(board?.image || null);

  // Inline editing active states
  const [isEditingTitle, setIsEditingTitle] = useState(initialFocusField === 'title' && canEdit);
  const [isEditingDescription, setIsEditingDescription] = useState(initialFocusField === 'description' && canEdit);
  const [isChangingCover, setIsChangingCover] = useState(false);

  // Status feedback
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isClosingRef = useRef(false);

  // Synchronize state when board prop changes during render
  const [prevBoardId, setPrevBoardId] = useState(board?.id);
  if (board && board.id !== prevBoardId) {
    setPrevBoardId(board.id);
    setName(board.name || '');
    setDescription(board.description || '');
    setCoverImage(board.image || null);
    setIsEditingTitle(initialFocusField === 'title' && canEdit);
    setIsEditingDescription(initialFocusField === 'description' && canEdit);
    setErrorMessage(null);
    setSaveStatus('idle');
  }

  // Auto-focus title input when editing begins
  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  // Auto-focus description input when editing begins
  useEffect(() => {
    if (isEditingDescription) {
      descriptionInputRef.current?.focus();
    }
  }, [isEditingDescription]);

  // Smooth modal transition coordination
  useEffect(() => {
    let raf: number | undefined;
    if (isOpen) {
      isClosingRef.current = false;
      raf = requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      raf = requestAnimationFrame(() => {
        setIsVisible(false);
      });
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      setIsEditingTitle(false);
      setIsEditingDescription(false);
      setIsChangingCover(false);
      setErrorMessage(null);
      setSaveStatus('idle');
      isClosingRef.current = false;
    }, 200);
  }, [onClose]);

  // Escape key handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        if (isEditingTitle) {
          setName(board?.name || '');
          setIsEditingTitle(false);
        } else if (isEditingDescription) {
          setDescription(board?.description || '');
          setIsEditingDescription(false);
        } else if (isChangingCover) {
          setIsChangingCover(false);
        } else {
          handleDismiss();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditingTitle, isEditingDescription, isChangingCover, board, handleDismiss]);

  // Core save function for any partial board update
  const persistUpdate = async (fields: { name?: string; description?: string | null; image?: string | null }) => {
    if (!board || !canEdit) return;

    setIsSaving(true);
    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      const res = await updateBoardAction(board.id, fields);
      if (res.success && res.data) {
        setSaveStatus('saved');
        onUpdate?.(res.data);
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2500);
      } else {
        setSaveStatus('error');
        setErrorMessage(res.message || 'Failed to update board');
        // Rollback
        if (fields.name !== undefined) setName(board.name);
        if (fields.description !== undefined) setDescription(board.description || '');
        if (fields.image !== undefined) setCoverImage(board.image || null);
      }
    } catch {
      setSaveStatus('error');
      setErrorMessage('Unexpected network error occurred while updating board');
      if (fields.name !== undefined) setName(board.name);
      if (fields.description !== undefined) setDescription(board.description || '');
      if (fields.image !== undefined) setCoverImage(board.image || null);
    } finally {
      setIsSaving(false);
    }
  };

  // Inline Title Save
  const handleSaveTitle = async () => {
    if (!canEdit) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setName(board?.name || 'Untitled Board');
      setIsEditingTitle(false);
      return;
    }
    setIsEditingTitle(false);
    if (trimmed !== board?.name) {
      await persistUpdate({ name: trimmed });
    }
  };

  // Inline Description Save
  const handleSaveDescription = async () => {
    if (!canEdit) return;
    const trimmed = description.trim();
    setIsEditingDescription(false);
    if (trimmed !== (board?.description || '')) {
      await persistUpdate({ description: trimmed || null });
    }
  };

  // Inline Cover Change (Preset Gradient)
  const handleSelectGradient = async (gradientValue: string) => {
    if (!canEdit) return;
    setCoverImage(gradientValue || null);
    await persistUpdate({ image: gradientValue || null });
  };

  // Inline Cover Image File Upload
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 5MB limit');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const res = await uploadFileDirectly(file, { folder: 'board-covers' });
      if (res?.publicUrl) {
        setCoverImage(res.publicUrl);
        await persistUpdate({ image: res.publicUrl });
      } else {
        setErrorMessage('Failed to retrieve uploaded image URL');
      }
    } catch (err) {
      const error = err as Error;
      setErrorMessage(error.message || 'Error uploading board cover');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Inline Cover Remove
  const handleRemoveCover = async () => {
    if (!canEdit) return;
    setCoverImage(null);
    await persistUpdate({ image: null });
  };

  // Delete Board from within modal
  const handleDelete = async () => {
    if (!board || !canDelete) return;

    if (!window.confirm(`Are you sure you want to permanently delete board "${board.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await deleteBoardAction(board.id);
      if (res.success) {
        onDelete?.(board.id);
        handleDismiss();
      } else {
        setErrorMessage(res.message || 'Failed to delete board');
      }
    } catch {
      setErrorMessage('Error deleting board');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen && !isVisible) return null;
  if (!isMounted || !board) return null;

  // Extract initials
  const getInitials = (title: string): string => {
    if (!title) return 'BD';
    const words = title.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.slice(0, 2).toUpperCase();
  };

  // Render Cover Banner
  const renderCoverBanner = () => {
    const isGradient = coverImage && coverImage.startsWith('gradient:');
    const isUrl = coverImage && (coverImage.startsWith('http') || coverImage.startsWith('/') || coverImage.startsWith('data:'));
    const isGoDigital = coverImage === 'go-digital' || ('coverType' in board && board.coverType === 'go-digital');
    const isItOperational = coverImage === 'it-operational' || ('coverType' in board && board.coverType === 'it-operational');

    return (
      <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-gray-100 flex items-center justify-center select-none group border-b border-gray-100">
        {isUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={name}
              className="w-full h-full object-cover"
            />
            {canEdit && (
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-2xs">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 bg-white text-gray-800 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 hover:bg-gray-50 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Change Photo</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  className="px-3 py-1.5 bg-white text-red-600 rounded-xl text-xs font-semibold shadow-xs hover:bg-red-50 transition cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </>
        ) : isGradient ? (
          <div className={`w-full h-full ${coverImage.replace('gradient:', '')} flex items-center justify-center p-4 relative`}>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center shadow-xs">
              <span className="text-2xl font-black text-white tracking-wider">
                {getInitials(name)}
              </span>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsChangingCover((prev) => !prev)}
                className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-medium rounded-xl backdrop-blur-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Customize theme</span>
              </button>
            )}
          </div>
        ) : isGoDigital ? (
          <div className="w-full h-full bg-white flex flex-col items-center justify-center p-4">
            <div className="transform -rotate-6 text-center">
              <div className="text-red-600 font-black text-4xl sm:text-5xl tracking-tighter drop-shadow-[2px_3px_0px_rgba(0,0,0,0.85)] font-sans leading-none">
                GO!
              </div>
              <div className="bg-black text-white font-extrabold text-xl sm:text-2xl px-3 py-0.5 tracking-wider mt-1 shadow-md">
                DIGITAL
              </div>
            </div>
          </div>
        ) : isItOperational ? (
          <div className="w-full h-full bg-white flex flex-col items-center justify-center p-4">
            <div className="text-center">
              <div className="text-yellow-400 font-black text-5xl sm:text-6xl tracking-tight drop-shadow-[3px_4px_0px_#ef4444] font-sans leading-none stroke-black">
                IT
              </div>
              <div className="text-pink-500 font-black text-xl sm:text-2xl tracking-wider drop-shadow-[2px_2px_0px_#000000] uppercase mt-1">
                OPERATIONAL
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200/80 flex items-center justify-center relative">
            <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200/80 flex items-center justify-center shadow-xs">
              <span className="text-2xl font-black text-gray-400">
                {getInitials(name)}
              </span>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsChangingCover((prev) => !prev)}
                className="absolute bottom-3 right-3 px-3 py-1.5 bg-white/90 hover:bg-white text-gray-700 text-xs font-medium rounded-xl shadow-xs backdrop-blur-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-gray-600" />
                <span>Add cover</span>
              </button>
            )}
          </div>
        )}

        {/* Hidden File Input for cover photo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverUpload}
        />

        {/* Actions on top-right: Delete button (if permitted) and Close button */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-red-600/90 text-white flex items-center justify-center transition backdrop-blur-xs cursor-pointer disabled:opacity-50"
              aria-label="Delete board"
              title="Delete board"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition backdrop-blur-xs cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-opacity duration-200 ease-in-out motion-reduce:transition-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-modal-title"
    >
      {/* Backdrop with subtle blur */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-200 ease-in-out motion-reduce:transition-none"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        className={`relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] transition-[transform,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Cover Banner */}
        {renderCoverBanner()}

        {/* Optional Collapsible Cover Theme Picker */}
        {canEdit && isChangingCover && (
          <div className="px-6 py-3.5 bg-gray-50/90 border-b border-gray-100 animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Select Color Theme or Upload Photo</span>
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs font-semibold text-green-700 hover:text-green-800 flex items-center gap-1 transition cursor-pointer"
              >
                {isUploading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Camera className="w-3 h-3" />
                )}
                <span>Upload Photo</span>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {PRESET_GRADIENTS.map((g) => {
                const isSelected = coverImage === g.value;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectGradient(g.value)}
                    title={g.label}
                    className={`h-8 rounded-xl ${g.preview} border transition cursor-pointer relative flex items-center justify-center shadow-2xs ${
                      isSelected
                        ? 'border-gray-900 ring-2 ring-green-600/30 scale-105'
                        : 'border-transparent hover:scale-102'
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-white drop-shadow-sm" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Save Status & Error Banners */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-50 text-red-800 border-b border-red-100 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6">
          {/* Header Bar with Live Saving Feedback & Pin Indicator */}
          <div className="flex items-center justify-between gap-3 -mt-1">
            <div className="flex items-center gap-2">
              {/* Pin indicator */}
              {board && 'isPinned' in board && board.isPinned && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/70 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  <Pin className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>Pinned Board</span>
                </span>
              )}
            </div>

            {/* Save status badge */}
            <div className="text-[11px] font-medium text-gray-400">
              {saveStatus === 'saving' && (
                <span className="inline-flex items-center gap-1 text-green-700">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving changes...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="inline-flex items-center gap-1 text-green-700">
                  <Check className="w-3 h-3 text-green-600" />
                  <span>All changes saved</span>
                </span>
              )}
              {saveStatus === 'idle' && (
                <span>ID #{board.id}</span>
              )}
            </div>
          </div>

          {/* 1. INLINE EDITABLE TITLE */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Board Title
            </label>

            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveTitle();
                    }
                  }}
                  disabled={isSaving}
                  className="flex-1 text-xl sm:text-2xl font-bold text-gray-900 bg-white border border-green-500 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500/20 shadow-xs"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSaveTitle}
                  disabled={isSaving}
                  className="p-2 bg-green-700 hover:bg-green-800 text-white rounded-xl transition cursor-pointer shadow-xs"
                  title="Save title"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => canEdit && setIsEditingTitle(true)}
                className={`group flex items-center justify-between rounded-xl px-3 py-2 -ml-3 transition ${
                  canEdit
                    ? 'hover:bg-gray-100/80 cursor-pointer'
                    : 'cursor-default'
                }`}
                title={canEdit ? 'Click to edit title inline' : undefined}
              >
                <h1
                  id="board-modal-title"
                  className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight"
                >
                  {name || 'Untitled Board'}
                </h1>
                {canEdit && (
                  <Pencil className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                )}
              </div>
            )}
          </div>

          {/* 2. INLINE EDITABLE DESCRIPTION */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Description & Scope
            </label>

            {isEditingDescription ? (
              <div className="space-y-2">
                <textarea
                  ref={descriptionInputRef}
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveDescription();
                    }
                  }}
                  placeholder="Add a detailed description for this board..."
                  className="w-full text-xs sm:text-sm text-gray-800 bg-white border border-green-500 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-green-500/20 shadow-xs resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDescription(board.description || '');
                      setIsEditingDescription(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDescription}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => canEdit && setIsEditingDescription(true)}
                className={`group rounded-xl p-3 -ml-3 transition ${
                  canEdit
                    ? 'hover:bg-gray-100/80 cursor-pointer'
                    : 'cursor-default'
                }`}
                title={canEdit ? 'Click to edit description inline' : undefined}
              >
                {description.trim() ? (
                  <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {description}
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-400 italic">
                    {canEdit
                      ? 'Click to add a detailed description, targets, or project scope...'
                      : 'No description provided for this board.'}
                  </p>
                )}
                {canEdit && (
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                    <Pencil className="w-3 h-3" />
                    <span>Click to edit description</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. BOARD MEMBERS SECTION */}
          <div className="pt-2 border-t border-gray-100">
            <BoardMembersSection boardId={board.id} canEdit={canEdit} />
          </div>

          {/* 4. METADATA CARDS */}
          <div className="pt-2 border-t border-gray-100">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              Board Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Created At */}
              <div className="p-3 bg-gray-50/70 border border-gray-100 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200/80 text-gray-500 flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Created On
                  </div>
                  <div className="text-xs font-semibold text-gray-700">
                    {'createdAt' in board && board.createdAt
                      ? new Date(board.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Recently created'}
                  </div>
                </div>
              </div>

              {/* Updated At */}
              <div className="p-3 bg-gray-50/70 border border-gray-100 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200/80 text-gray-500 flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Last Modified
                  </div>
                  <div className="text-xs font-semibold text-gray-700">
                    {'updatedAt' in board && board.updatedAt
                      ? new Date(board.updatedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Just now'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
