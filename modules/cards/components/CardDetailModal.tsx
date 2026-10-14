'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { CardDTO, CardAttachmentDTO, UpdateCardInput } from '../types';
import type { ListDTO } from '@/modules/lists/types';
import { CardCommentsSection } from './CardCommentsSection';
import { CardLabelPicker } from './CardLabelPicker';
import { CardMemberPicker } from './CardMemberPicker';
import { CardDateRangePicker } from './CardDateRangePicker';
import { CardOwnerPicker } from './CardOwnerPicker';
import { CardDescriptionEditor } from './CardDescriptionEditor';
import { CardAttachmentsSection } from './CardAttachmentsSection';
import { getCardCoverImage } from '@/lib/file-type';
import { uploadFileDirectly } from '@/lib/upload-client';
import { updateCardAction } from '../actions';
import {
  X,
  AlignLeft,
  Columns3,
  Pencil,
  Check,
  Trash2,
  ChevronDown,
  Share2,
  ImageIcon,
  Loader2,
} from 'lucide-react';

const emptySubscribe = () => () => {};

interface CardDetailModalProps {
  isOpen: boolean;
  card: CardDTO | null;
  lists: ListDTO[];
  canUpdate?: boolean;
  canDelete?: boolean;
  currentUserId: number;
  currentUserName?: string;
  onClose: () => void;
  onUpdateCard: (cardId: number, input: UpdateCardInput) => Promise<boolean>;
  onDeleteCard: (cardId: number) => Promise<boolean>;
  onMoveCardToList?: (cardId: number, targetListId: number) => Promise<boolean>;
  onCardUpdated?: (updatedCard: CardDTO) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  isOpen,
  card: propCard,
  lists,
  canUpdate = true,
  canDelete = true,
  currentUserId,
  currentUserName = 'Me',
  onClose,
  onUpdateCard,
  onDeleteCard,
  onMoveCardToList,
  onCardUpdated,
}) => {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [isVisible, setIsVisible] = useState(false);
  const [cachedCard, setCachedCard] = useState<CardDTO | null>(propCard);
  const isClosingRef = useRef(false);

  const card = propCard || cachedCard;

  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
  const [commentsCount, setCommentsCount] = useState(0);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(card?.title || '');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Description editing state
  const [isEditingDesc, setIsEditingDesc] = useState(false);

  // Delete confirmation
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // List selector dropdown
  const [isListMenuOpen, setIsListMenuOpen] = useState(false);
  const listMenuRef = useRef<HTMLDivElement>(null);

  // Cover management states
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isCoverMenuOpen, setIsCoverMenuOpen] = useState(false);
  const coverMenuRef = useRef<HTMLDivElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleSetCover = async (newCoverUrl: string | null) => {
    if (!card || !canUpdate) return;
    const coverVal = newCoverUrl || 'none';
    const updated = { ...card, coverUrl: newCoverUrl };
    setCachedCard(updated);
    onCardUpdated?.(updated);

    try {
      const res = await updateCardAction(card.id, { coverUrl: coverVal });
      if (res.success && res.data) {
        setCachedCard(res.data);
        onCardUpdated?.(res.data);
      }
    } catch (err) {
      console.error('Failed to set cover:', err);
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !card || !canUpdate) return;
    setIsUploadingCover(true);
    try {
      const res = await uploadFileDirectly(file, { folder: 'card-covers' });
      await handleSetCover(res.publicUrl);
    } catch (err) {
      console.error('Failed to upload cover:', err);
    } finally {
      setIsUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleShareCard = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Synchronize state during render when switching to a different card
  const [prevCardId, setPrevCardId] = useState(propCard?.id);
  if (propCard && propCard.id !== prevCardId) {
    setPrevCardId(propCard.id);
    setCachedCard(propCard);
    setTitleValue(propCard.title);
    setIsEditingTitle(false);
    setIsEditingDesc(false);
    setShowConfirmDelete(false);
    setIsListMenuOpen(false);
  }

  // Dismiss with smooth ease-out transition
  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      isClosingRef.current = false;
    }, 200);
  }, [onClose]);

  // Synchronize isOpen to isVisible on next animation frame
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

  // Lock body scroll when modal is open or transitioning
  useEffect(() => {
    if (isOpen || isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isVisible]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isEditingTitle) {
          setIsEditingTitle(false);
          setTitleValue(card?.title || '');
          return;
        }
        if (isEditingDesc) {
          setIsEditingDesc(false);
          return;
        }
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditingTitle, isEditingDesc, card, handleDismiss]);

  // Close list and cover dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (listMenuRef.current && !listMenuRef.current.contains(target)) {
        setIsListMenuOpen(false);
      }
      if (coverMenuRef.current && !coverMenuRef.current.contains(target)) {
        setIsCoverMenuOpen(false);
      }
    };
    if (isListMenuOpen || isCoverMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isListMenuOpen, isCoverMenuOpen]);

  // Focus title input on edit
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  if (!isOpen && !isVisible) return null;
  if (!isMounted || !card) return null;

  const currentList = lists.find((l) => l.id === card.listId);

  // Handle title save
  const handleSaveTitle = async () => {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === card.title) {
      setTitleValue(card.title);
      setIsEditingTitle(false);
      return;
    }

    setIsSaving(true);
    const success = await onUpdateCard(card.id, { title: trimmed });
    setIsSaving(false);

    if (success) {
      setIsEditingTitle(false);
    } else {
      setTitleValue(card.title);
    }
  };

  // Handle move list
  const handleSelectList = async (targetListId: number) => {
    if (targetListId === card.listId) {
      setIsListMenuOpen(false);
      return;
    }
    setIsListMenuOpen(false);
    if (onMoveCardToList) {
      await onMoveCardToList(card.id, targetListId);
    }
  };

  // Handle delete
  const handleDeleteCard = async () => {
    setIsDeleting(true);
    const success = await onDeleteCard(card.id);
    setIsDeleting(false);
    if (success) {
      handleDismiss();
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 transition-opacity duration-200 ease-in-out motion-reduce:transition-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Click outside backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200 ease-in-out motion-reduce:transition-none"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200/90 w-[95vw] max-w-7xl h-[90vh] max-h-[920px] flex flex-col overflow-hidden z-10 transition-[transform,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Top Header Bar / Cover Banner */}
        {(() => {
          const coverImage = getCardCoverImage(card);

          if (coverImage) {
            return (
              <div className="h-28 sm:h-32 md:h-36 relative w-full overflow-hidden shrink-0 bg-slate-100 select-none group/cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImage}
                  alt={card.title}
                  className="w-full h-full object-cover"
                />

                {/* Overlaid Top Header Bar */}
                <div className="absolute inset-x-0 top-0 p-3 sm:p-3.5 flex items-center justify-between z-10 bg-gradient-to-b from-black/50 via-black/20 to-transparent">
                  {/* List Selector / Badge */}
                  <div className="relative" ref={listMenuRef}>
                    <button
                      type="button"
                      onClick={() => canUpdate && setIsListMenuOpen((prev) => !prev)}
                      disabled={!canUpdate || lists.length <= 1}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md shadow-md border transition-all ${
                        canUpdate && lists.length > 1
                          ? 'bg-slate-900/60 hover:bg-slate-900/80 text-white border-white/20 cursor-pointer'
                          : 'bg-slate-900/60 text-white border-white/20 cursor-default'
                      }`}
                      title={canUpdate && lists.length > 1 ? 'Pindahkan ke daftar lain' : undefined}
                    >
                      <Columns3 className="w-3.5 h-3.5 text-white/80" />
                      <span className="truncate max-w-[150px]">
                        {currentList?.title || 'Daftar'}
                      </span>
                      {canUpdate && lists.length > 1 && (
                        <ChevronDown className="w-3 h-3 text-white/80" />
                      )}
                    </button>

                    {/* List Dropdown Menu */}
                    {isListMenuOpen && (
                      <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-gray-200/90 rounded-xl shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Pindahkan ke:
                        </div>
                        {lists.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleSelectList(l.id)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                              l.id === card.listId
                                ? 'bg-emerald-50 text-emerald-700 font-semibold'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <span className="truncate">{l.title}</span>
                            {l.id === card.listId && (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Header Controls: Share, Cover Actions, Delete & Close */}
                  <div className="flex items-center gap-1.5">
                    {/* Share Button (matches reference design) */}
                    <button
                      type="button"
                      onClick={handleShareCard}
                      className="px-3 py-1.5 bg-white/90 hover:bg-white text-gray-700 rounded-xl text-xs font-semibold shadow-md backdrop-blur-xs border border-white/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Share card link"
                    >
                      <Share2 className="w-3.5 h-3.5 text-gray-500" />
                      <span>{isCopied ? 'Copied!' : 'Share'}</span>
                    </button>

                    {/* Cover Actions Dropdown */}
                    {canUpdate && (
                      <div className="relative" ref={coverMenuRef}>
                        <button
                          type="button"
                          onClick={() => setIsCoverMenuOpen((prev) => !prev)}
                          disabled={isUploadingCover}
                          className="px-2.5 py-1.5 bg-white/90 hover:bg-white text-gray-700 rounded-xl text-xs font-semibold shadow-md backdrop-blur-xs border border-white/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Cover options"
                        >
                          {isUploadingCover ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                          )}
                          <span className="hidden sm:inline">Cover</span>
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        </button>

                        {isCoverMenuOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-40 bg-white border border-gray-200/90 rounded-xl shadow-xl p-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCoverMenuOpen(false);
                                coverInputRef.current?.click();
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-2 cursor-pointer text-gray-700 font-medium"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                              <span>Ganti Sampul</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCoverMenuOpen(false);
                                handleSetCover(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-2 cursor-pointer text-red-600 font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              <span>Hapus Sampul</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delete Card */}
                    {canDelete && (
                      <div className="relative">
                        {showConfirmDelete ? (
                          <div className="flex items-center gap-1.5 bg-white/95 border border-red-200 rounded-xl p-1 shadow-lg animate-in fade-in duration-100">
                            <span className="text-[11px] font-semibold text-red-700 pl-1.5">
                              Delete?
                            </span>
                            <button
                              type="button"
                              onClick={handleDeleteCard}
                              disabled={isDeleting}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              {isDeleting ? '...' : 'Yes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowConfirmDelete(false)}
                              className="px-2 py-0.5 bg-white text-gray-600 hover:bg-gray-100 text-[11px] font-medium rounded-lg transition-colors cursor-pointer border border-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowConfirmDelete(true)}
                            className="p-1.5 bg-white/90 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-xl shadow-md backdrop-blur-xs border border-white/40 transition-colors cursor-pointer"
                            title="Delete card"
                            aria-label="Delete card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Close Button */}
                    <button
                      type="button"
                      onClick={handleDismiss}
                      className="p-1.5 bg-white/90 hover:bg-white text-gray-700 rounded-xl shadow-md backdrop-blur-xs border border-white/40 transition-colors cursor-pointer"
                      title="Close (Esc)"
                      aria-label="Close modal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* List Selector / Badge */}
                <div className="relative" ref={listMenuRef}>
                  <button
                    type="button"
                    onClick={() => canUpdate && setIsListMenuOpen((prev) => !prev)}
                    disabled={!canUpdate || lists.length <= 1}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      canUpdate && lists.length > 1
                        ? 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 cursor-pointer'
                        : 'bg-gray-50 text-gray-600 border-gray-200 cursor-default'
                    }`}
                    title={canUpdate && lists.length > 1 ? 'Pindahkan ke daftar lain' : undefined}
                  >
                    <Columns3 className="w-3.5 h-3.5 text-gray-500" />
                    <span className="truncate max-w-[150px]">
                      {currentList?.title || 'Daftar'}
                    </span>
                    {canUpdate && lists.length > 1 && (
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    )}
                  </button>

                  {/* List Dropdown Menu */}
                  {isListMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200/90 rounded-xl shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Pindahkan ke:
                      </div>
                      {lists.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => handleSelectList(l.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                            l.id === card.listId
                              ? 'bg-emerald-50 text-emerald-700 font-semibold'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <span className="truncate">{l.title}</span>
                          {l.id === card.listId && (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Header Controls: Share, Add Cover, Delete & Close */}
              <div className="flex items-center gap-1.5">
                {/* Share Button */}
                <button
                  type="button"
                  onClick={handleShareCard}
                  className="px-2.5 py-1.5 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-200"
                  title="Share card link"
                >
                  <Share2 className="w-3.5 h-3.5 text-gray-500" />
                  <span>{isCopied ? 'Copied!' : 'Share'}</span>
                </button>

                {/* Add Cover Button */}
                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={isUploadingCover}
                    className="px-2.5 py-1.5 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-200"
                    title="Add card cover"
                  >
                    {isUploadingCover ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    <span>Add Cover</span>
                  </button>
                )}

                {canDelete && (
                  <div className="relative">
                    {showConfirmDelete ? (
                      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl p-1 animate-in fade-in duration-100">
                        <span className="text-[11px] font-semibold text-red-700 pl-1.5">
                          Delete card?
                        </span>
                        <button
                          type="button"
                          onClick={handleDeleteCard}
                          disabled={isDeleting}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {isDeleting ? '...' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowConfirmDelete(false)}
                          className="px-2 py-0.5 bg-white text-gray-600 hover:bg-gray-100 text-[11px] font-medium rounded-lg transition-colors cursor-pointer border border-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowConfirmDelete(true)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete card"
                        aria-label="Delete card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  title="Close (Esc)"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Hidden Cover File Input */}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadCover}
        />

        {/* Mobile Tab Switcher (< lg) */}
        <div className="lg:hidden flex items-center border-b border-gray-100 bg-gray-50/60 px-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Card Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'comments'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>Comments</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              {commentsCount}
            </span>
          </button>
        </div>

        {/* Modal Main Body (65% Content / 35% Comments Desktop Split) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Column: 65% Card Content */}
          <div
            className={`lg:w-[65%] w-full h-full overflow-y-auto flex flex-col p-5 sm:p-7 border-r border-gray-100 bg-white ${
              activeTab !== 'details' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Card Title & Labels */}
            <div className="mb-2">
              {isEditingTitle && canUpdate ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') {
                          setTitleValue(card.title);
                          setIsEditingTitle(false);
                        }
                      }}
                      disabled={isSaving}
                      className="w-full text-lg sm:text-xl font-bold text-gray-900 bg-gray-50 border border-emerald-500 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="Card title..."
                    />
                    <button
                      type="button"
                      onClick={handleSaveTitle}
                      disabled={isSaving}
                      className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Save title"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTitleValue(card.title);
                        setIsEditingTitle(false);
                      }}
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <CardLabelPicker
                      card={card}
                      canUpdate={canUpdate}
                      onCardUpdated={(updated) => onCardUpdated?.(updated)}
                      hideHeader
                      defaultExpanded={false}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                  <div className="group/title inline-flex items-center">
                    <h2
                      id="card-detail-title"
                      onClick={() => canUpdate && setIsEditingTitle(true)}
                      className={`text-lg sm:text-2xl font-bold text-gray-900 leading-snug break-words ${
                        canUpdate ? 'cursor-pointer hover:text-emerald-700 transition-colors' : ''
                      }`}
                      title={canUpdate ? 'Click to edit title' : undefined}
                    >
                      {card.title}
                    </h2>

                    {canUpdate && (
                      <div className="overflow-hidden flex items-center transition-all duration-300 ease-out max-w-0 opacity-0 pointer-events-none group-hover/title:max-w-8 group-hover/title:opacity-100 group-hover/title:ml-1.5 group-hover/title:pointer-events-auto">
                        <button
                          type="button"
                          onClick={() => setIsEditingTitle(true)}
                          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0 cursor-pointer"
                          title="Edit title"
                          aria-label="Edit title"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <CardLabelPicker
                    card={card}
                    canUpdate={canUpdate}
                    onCardUpdated={(updated) => onCardUpdated?.(updated)}
                    hideHeader
                    defaultExpanded={false}
                  />
                </div>
              )}
            </div>

            {/* Divider under Card Title */}
            <div className="h-px bg-gray-100 mb-4" />

            {/* Properties Information (Card Owner, Members & Dates) */}
            <div className="flex flex-wrap items-start gap-x-6 sm:gap-x-7 gap-y-4 mb-6">
              {/* Card Owner */}
              <CardOwnerPicker
                card={card}
                canUpdate={canUpdate}
                onCardUpdated={(updated) => onCardUpdated?.(updated)}
              />

              {/* Members */}
              <CardMemberPicker
                card={card}
                boardId={card.boardId}
                canUpdate={canUpdate}
                currentUserId={currentUserId}
                onCardUpdated={(updated) => onCardUpdated?.(updated)}
              />

              {/* Dates */}
              <CardDateRangePicker
                card={card}
                canUpdate={canUpdate}
                onCardUpdated={(updated) => onCardUpdated?.(updated)}
                variant="property"
              />
            </div>

            {/* Description Section */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-1.5 mb-2">
                <AlignLeft className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Description
                </span>
              </div>

              <CardDescriptionEditor
                cardId={card.id}
                initialDescription={card.description}
                canUpdate={canUpdate}
                isEditing={isEditingDesc}
                onEditingChange={setIsEditingDesc}
                onAttachmentAdded={(newAttachment) => {
                  if (!card) return;
                  const existingIds = new Set((card.attachments || []).map((a) => a.id));
                  if (existingIds.has(newAttachment.id)) return;
                  const updatedCard: CardDTO = {
                    ...card,
                    attachments: [...(card.attachments || []), newAttachment],
                  };
                  setCachedCard(updatedCard);
                  onCardUpdated?.(updatedCard);
                }}
                onSave={async (newDesc) => {
                  return await onUpdateCard(card.id, { description: newDesc });
                }}
              />

              {/* Attachments Section */}
              <CardAttachmentsSection
                cardId={card.id}
                attachments={card.attachments}
                canUpdate={canUpdate}
                currentCoverUrl={getCardCoverImage(card)}
                onSetCover={handleSetCover}
                onAttachmentAdded={(newAttachment) => {
                  if (!card) return;
                  const updatedCard: CardDTO = {
                    ...card,
                    attachments: [...(card.attachments || []), newAttachment],
                  };
                  setCachedCard(updatedCard);
                  onCardUpdated?.(updatedCard);
                }}
                onAttachmentDeleted={(deletedId) => {
                  if (!card) return;
                  const updatedCard: CardDTO = {
                    ...card,
                    attachments: (card.attachments || []).filter((a) => a.id !== deletedId),
                  };
                  setCachedCard(updatedCard);
                  onCardUpdated?.(updatedCard);
                }}
              />
            </div>
          </div>

          {/* Right Column: 35% Comments Pane */}
          <div
            className={`lg:w-[35%] w-full h-full flex flex-col bg-[#f8fafc] shrink-0 min-h-0 ${
              activeTab !== 'comments' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <CardCommentsSection
              cardId={card.id}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              onCommentsCountChange={setCommentsCount}
              onCommentAttachmentsAdded={(commentAtts) => {
                if (!card) return;
                const existingUrls = new Set((card.attachments || []).map((a) => a.fileUrl));
                const toAdd = commentAtts.filter((ca) => !existingUrls.has(ca.url));
                if (toAdd.length === 0) return;

                const newAttachments: CardAttachmentDTO[] = toAdd.map((ca, idx) => ({
                  id: -1 * (Date.now() + idx),
                  cardId: card.id,
                  userId: currentUserId,
                  fileName: ca.fileName || 'attachment',
                  fileUrl: ca.url,
                  fileSize: ca.fileSize || 0,
                  fileType:
                    ca.mimeType || (ca.isImage ? 'image/png' : 'application/octet-stream'),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }));

                const updatedCard: CardDTO = {
                  ...card,
                  attachments: [...(card.attachments || []), ...newAttachments],
                };
                setCachedCard(updatedCard);
                onCardUpdated?.(updatedCard);
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

