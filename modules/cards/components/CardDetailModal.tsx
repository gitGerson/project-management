'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { CardDTO, UpdateCardInput } from '../types';
import type { ListDTO } from '@/modules/lists/types';
import { CardCommentsSection } from './CardCommentsSection';
import { CardLabelPicker } from './CardLabelPicker';
import { CardMemberPicker } from './CardMemberPicker';
import { CardDateRangePicker } from './CardDateRangePicker';
import { CardOwnerPicker } from './CardOwnerPicker';
import { CardDescriptionEditor } from './CardDescriptionEditor';
import {
  X,
  AlignLeft,
  Columns3,
  Pencil,
  Check,
  Trash2,
  ChevronDown,
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

  // Synchronize state during render when propCard changes
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

  // Close list dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setIsListMenuOpen(false);
      }
    };
    if (isListMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isListMenuOpen]);

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
        {/* Top Header Bar */}
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

            {/* Status Badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {card.status || 'Active'}
            </span>
          </div>

          {/* Right Header Controls: Delete & Close */}
          <div className="flex items-center gap-1.5">
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
            <div className="mb-4">
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
            <div className="h-px bg-gray-100 mb-5" />

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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <AlignLeft className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Description
                  </span>
                </div>

                {!isEditingDesc && canUpdate && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(true)}
                    className="px-2 py-0.5 text-[11px] font-semibold text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {card.description ? 'Edit' : 'Add'}
                  </button>
                )}
              </div>

              <CardDescriptionEditor
                cardId={card.id}
                initialDescription={card.description}
                canUpdate={canUpdate}
                isEditing={isEditingDesc}
                onEditingChange={setIsEditingDesc}
                onSave={async (newDesc) => {
                  return await onUpdateCard(card.id, { description: newDesc });
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
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

