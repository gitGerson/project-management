'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Kanban,
  Check,
  Loader2,
  Camera,
  Pin,
  Eye,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { createBoardAction } from '@/modules/boards/actions';
import { uploadFileDirectly } from '@/lib/upload-client';
import type { BoardDTO } from '@/modules/boards/types';

const emptySubscribe = () => () => {};

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (board: BoardDTO) => void;
}

const PRESET_GRADIENTS = [
  { id: 'emerald', label: 'Emerald', value: 'gradient:bg-gradient-to-br from-emerald-600 to-teal-800', preview: 'bg-gradient-to-br from-emerald-600 to-teal-800' },
  { id: 'blue', label: 'Ocean Blue', value: 'gradient:bg-gradient-to-br from-blue-600 to-indigo-800', preview: 'bg-gradient-to-br from-blue-600 to-indigo-800' },
  { id: 'amber', label: 'Amber Warmth', value: 'gradient:bg-gradient-to-br from-amber-500 to-orange-600', preview: 'bg-gradient-to-br from-amber-500 to-orange-600' },
  { id: 'rose', label: 'Berry Rose', value: 'gradient:bg-gradient-to-br from-rose-500 to-pink-700', preview: 'bg-gradient-to-br from-rose-500 to-pink-700' },
  { id: 'purple', label: 'Royal Purple', value: 'gradient:bg-gradient-to-br from-purple-600 to-indigo-900', preview: 'bg-gradient-to-br from-purple-600 to-indigo-900' },
  { id: 'slate', label: 'Dark Slate', value: 'gradient:bg-gradient-to-br from-slate-700 to-slate-900', preview: 'bg-gradient-to-br from-slate-700 to-slate-900' },
  { id: 'minimal', label: 'Clean Neutral', value: '', preview: 'bg-gradient-to-br from-slate-100 to-slate-200' },
];

export function CreateBoardModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateBoardModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCover, setSelectedCover] = useState(PRESET_GRADIENTS[0].value);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isClosingRef = useRef(false);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      setName('');
      setDescription('');
      setSelectedCover(PRESET_GRADIENTS[0].value);
      setCustomImageUrl(null);
      setErrorMessage(null);
      isClosingRef.current = false;
    }, 200);
  }, [onClose]);

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        setCustomImageUrl(res.publicUrl);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Board title is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const finalImage = customImageUrl || selectedCover || null;

    try {
      const res = await createBoardAction({
        name: name.trim(),
        description: description.trim() || null,
        image: finalImage,
      });

      if (res.success && res.data) {
        onSuccess(res.data);
        handleDismiss();
      } else {
        setErrorMessage(res.message || 'Failed to create board');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while creating board');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !isVisible) return null;
  if (!isMounted) return null;

  // Active cover preview calculation
  const activeGradient = PRESET_GRADIENTS.find((g) => g.value === selectedCover);
  const initials = name.trim().slice(0, 2).toUpperCase() || 'BD';

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-opacity duration-200 ease-in-out motion-reduce:transition-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-board-modal-title"
    >
      {/* Click outside backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-200 ease-in-out motion-reduce:transition-none"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden z-10 flex flex-col max-h-[90vh] transition-[transform,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 text-green-700 border border-green-200/80 flex items-center justify-center shadow-2xs">
              <Kanban className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="create-board-modal-title"
                className="text-base sm:text-lg font-bold text-gray-900 tracking-tight"
              >
                Create New Board
              </h2>
              <p className="text-xs text-gray-500">
                Add a workspace for your team tasks and milestones.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-50 text-red-800 border-b border-red-100 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Full Live Board Card Preview matching BoardCard dimensions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">
                Card Preview
              </label>
              <span className="text-[11px] text-gray-400">
                Exact gallery size & layout
              </span>
            </div>

            {/* The Actual Board Card Preview with exact width and height */}
            <div className="w-[300px] sm:w-[324px] h-[228px] sm:h-[244px] mx-auto bg-white rounded-2xl sm:rounded-3xl border border-gray-200/90 shadow-sm overflow-hidden flex flex-col transition-all">
              {/* Cover area: exact h-44 sm:h-48 matching BoardCard */}
              <div className="h-44 sm:h-48 w-full relative overflow-hidden flex items-center justify-center border-b border-gray-100 select-none group flex-shrink-0">
                {customImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={customImageUrl}
                      alt="Custom cover preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-2xs">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-2.5 py-1.5 bg-white text-gray-800 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 hover:bg-gray-50 transition cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Change</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomImageUrl(null)}
                        className="px-2.5 py-1.5 bg-white text-red-600 rounded-lg text-xs font-semibold shadow-xs hover:bg-red-50 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`w-full h-full ${activeGradient?.preview || 'bg-gradient-to-br from-slate-100 to-slate-200/80'} flex items-center justify-center p-4`}>
                      <div className={`w-16 h-16 rounded-2xl ${selectedCover ? 'bg-white/20 backdrop-blur-xs border border-white/30 text-white' : 'bg-white border border-gray-200/80 text-gray-400'} flex items-center justify-center shadow-xs`}>
                        <span className="text-2xl font-black">{initials}</span>
                      </div>
                    </div>

                    {/* Image Upload Trigger inside preview */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="absolute bottom-2.5 right-2.5 px-2.5 py-1.5 bg-white/90 hover:bg-white text-gray-700 text-xs font-medium rounded-lg shadow-sm backdrop-blur-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-green-700" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5 text-gray-600" />
                          <span>Upload photo</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

              {/* Card Footer Preview: exact px-4 py-3 min-h-[52px] matching BoardCard */}
              <div className="px-4 py-3 bg-gray-50/70 flex items-center justify-between gap-2 min-h-[52px]">
                <h3 className="text-sm font-semibold text-gray-800 truncate flex-1 tracking-tight">
                  {name.trim() || 'Untitled Board'}
                </h3>
                <div className="flex items-center gap-1 text-gray-400">
                  <div className="p-1.5 rounded-lg text-amber-500">
                    <Pin className="w-4 h-4 fill-amber-500 text-amber-500" />
                  </div>
                  <div className="p-1.5 text-gray-400">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />

          {/* Board Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Board Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Tong Tji Go Digital"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Brief summary of duties, targets, or project scope"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition resize-none"
            />
          </div>

          {/* Color Themes */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Color Theme</span>
              </label>
              {customImageUrl && (
                <span className="text-[11px] text-gray-400">
                  Selecting a color theme overrides custom photo
                </span>
              )}
            </div>

            {/* Gradient Swatches */}
            <div className="grid grid-cols-7 gap-2">
              {PRESET_GRADIENTS.map((g) => {
                const isSelected = !customImageUrl && selectedCover === g.value;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setCustomImageUrl(null);
                      setSelectedCover(g.value);
                    }}
                    title={g.label}
                    className={`h-9 rounded-xl ${g.preview} border transition cursor-pointer relative flex items-center justify-center shadow-2xs ${
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

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading || !name.trim()}
              className="px-4 py-2 bg-[#15803d] hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Board</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
