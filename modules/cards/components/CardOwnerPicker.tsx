'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, Search, Check, X, Loader2 } from 'lucide-react';
import type { CardDTO } from '../types';
import { updateCardAction } from '../actions';
import { getMemberColor } from './CardMemberPicker';

interface CardOwnerPickerProps {
  card: CardDTO;
  canUpdate?: boolean;
  onCardUpdated: (updatedCard: CardDTO) => void;
}

export const CardOwnerPicker: React.FC<CardOwnerPickerProps> = ({
  card,
  canUpdate = true,
  onCardUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Positioning
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 260;
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popoverWidth - 16);
    }
    const top = rect.bottom + 6;
    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchQuery('');
      setErrorMessage(null);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, updateCoords]);

  // Click outside and escape handler
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleResizeOrScroll = () => {
      updateCoords();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isOpen, updateCoords]);

  // Candidate owners: Strictly based on card members
  const assignedMembers = card.members || [];

  interface OwnerCandidate {
    userId: number;
    name: string;
    username: string;
    profilePicture: string | null;
  }

  const candidates: OwnerCandidate[] = [];

  // If current owner is not explicitly in card.members, keep them at the top so current owner is selectable
  if (card.owner && !assignedMembers.some((m) => m.userId === card.ownerId)) {
    candidates.push({
      userId: card.owner.id,
      name: card.owner.name,
      username: card.owner.username,
      profilePicture: card.owner.profilePicture,
    });
  }

  for (const m of assignedMembers) {
    if (!candidates.some((c) => c.userId === m.userId)) {
      candidates.push({
        userId: m.userId,
        name: m.user.name,
        username: m.user.username,
        profilePicture: m.user.profilePicture,
      });
    }
  }

  // Filter candidates based on search query
  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
  });

  const handleSelectOwner = async (newOwnerId: number) => {
    if (!canUpdate || isSaving) return;

    if (newOwnerId === card.ownerId) {
      setIsOpen(false);
      return;
    }

    const selected = candidates.find((c) => c.userId === newOwnerId);
    if (!selected) return;

    setIsSaving(true);
    setErrorMessage(null);

    // Optimistic UI update
    const previousCard = { ...card };
    onCardUpdated({
      ...card,
      ownerId: newOwnerId,
      owner: {
        id: selected.userId,
        name: selected.name,
        username: selected.username,
        profilePicture: selected.profilePicture,
      },
    });

    setIsOpen(false);

    try {
      const res = await updateCardAction(card.id, { ownerId: newOwnerId });
      if (res.success && res.data) {
        onCardUpdated(res.data);
      } else {
        // Rollback
        onCardUpdated(previousCard);
        setErrorMessage(res.message || 'Failed to update card owner');
      }
    } catch {
      // Rollback
      onCardUpdated(previousCard);
      setErrorMessage('Network error updating card owner');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'U'
    );
  };

  const currentOwnerColor = getMemberColor(card.ownerId || 0);

  return (
    <div className="shrink-0">
      {/* Label on top: "Card owner" */}
      <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        Card owner
      </span>

      {/* Row containing avatar and name with seamless text trigger (same behavior as date) */}
      <div className="min-h-8 flex items-center gap-2">
        {/* Owner Avatar */}
        <div
          style={{ backgroundColor: currentOwnerColor.bg, color: currentOwnerColor.text }}
          className="w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white shadow-2xs"
          title={`Owner: ${card.owner?.name || 'User'}`}
        >
          {card.owner?.profilePicture ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={card.owner.profilePicture}
              alt={card.owner.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{getInitials(card.owner?.name || 'User')}</span>
          )}
        </div>

        {/* Owner Name: Seamless text trigger */}
        {canUpdate ? (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="group/owner text-left cursor-pointer transition-colors focus:outline-none"
            title="Click to change card owner"
          >
            <span className="text-xs font-bold text-gray-800 group-hover/owner:text-emerald-700 group-hover/owner:underline truncate max-w-[130px] block">
              {card.owner?.name || 'User'}
            </span>
          </button>
        ) : (
          <span className="text-xs font-bold text-gray-800 truncate max-w-[130px]">
            {card.owner?.name || 'User'}
          </span>
        )}
      </div>

      {/* Popover Selection: Based strictly on card members */}
      {mounted &&
        isOpen &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Select card owner"
            style={{
              top: coords.top,
              left: coords.left,
            }}
            className="fixed z-60 w-64 bg-white rounded-2xl shadow-xl border border-gray-200/90 p-3 animate-in fade-in zoom-in-95 duration-100 text-left font-sans"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Change Owner
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Subtitle explaining selection scope */}
            <div className="text-[10px] text-gray-400 mb-2">
              Select an owner from card members:
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="mb-2 p-1.5 bg-red-50 text-red-600 text-[11px] rounded-lg border border-red-200">
                {errorMessage}
              </div>
            )}

            {/* Search Input if candidates > 3 */}
            {candidates.length > 3 && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-gray-800 placeholder-gray-400 transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Candidates List */}
            <div className="max-h-56 overflow-y-auto space-y-1">
              {filteredCandidates.length === 0 ? (
                <div className="py-4 text-center text-xs text-gray-400">
                  {candidates.length <= 1 ? (
                    <span>No other members on this card. Add members to transfer ownership.</span>
                  ) : (
                    <span>No members match search</span>
                  )}
                </div>
              ) : (
                filteredCandidates.map((c) => {
                  const isSelected = c.userId === card.ownerId;
                  const { bg, text } = getMemberColor(c.userId);

                  return (
                    <button
                      key={c.userId}
                      type="button"
                      onClick={() => handleSelectOwner(c.userId)}
                      disabled={isSaving}
                      className={`w-full text-left px-2 py-1.5 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-950 font-semibold'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Member Avatar */}
                        <div
                          style={{ backgroundColor: bg, color: text }}
                          className="w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white"
                        >
                          {c.profilePicture ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={c.profilePicture}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{getInitials(c.name)}</span>
                          )}
                        </div>

                        {/* Name and username */}
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold truncate leading-tight">
                            {c.name}
                          </span>
                          <span className="block text-[10px] text-gray-400 truncate leading-tight">
                            @{c.username}
                          </span>
                        </div>
                      </div>

                      {/* Right Checkmark */}
                      <div className="shrink-0 flex items-center">
                        {isSelected && (
                          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {isSaving && (
              <div className="pt-2 flex items-center justify-center text-xs text-gray-400 gap-1.5 border-t border-gray-100 mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Updating owner...</span>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
