'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Search,
  Check,
  X,
  Plus,
  Expand,
  Shrink,
  UserCheck,
  UserMinus,
  Loader2,
} from 'lucide-react';
import type { CardDTO, CardMemberDTO } from '../types';
import type { BoardMemberDTO } from '@/modules/board-members/types';
import { toggleCardMemberAction, getBoardMembersForCardAction } from '../actions';
import { LABEL_COLORS } from './CardLabelPicker';
import { getContrastTextColor } from '../utils/color-contrast';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const getMemberColor = (userId: number): { bg: string; text: string } => {
  const bg = LABEL_COLORS[Math.abs(userId) % LABEL_COLORS.length];
  const text = getContrastTextColor(bg);
  return { bg, text };
};

interface CardMemberPickerProps {
  card: CardDTO;
  boardId: number;
  canUpdate?: boolean;
  currentUserId?: number;
  onCardUpdated: (updatedCard: CardDTO) => void;
}

export const CardMemberPicker: React.FC<CardMemberPickerProps> = ({
  card,
  boardId,
  canUpdate = true,
  currentUserId,
  onCardUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [boardMembers, setBoardMembers] = useState<BoardMemberDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Position calculation and FLIP animation refs
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string | number, HTMLElement>>(new Map());
  const pendingFlip = useRef<{
    rects: Map<string | number, DOMRect>;
    containerH: number | null;
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Smooth FLIP animation for wrapping across rows without blip
  const toggleExpanded = useCallback((forced?: boolean) => {
    const rects = new Map<string | number, DOMRect>();
    itemRefs.current.forEach((el, key) => {
      if (el) {
        rects.set(key, el.getBoundingClientRect());
      }
    });

    const containerH = containerRef.current?.getBoundingClientRect().height || null;
    pendingFlip.current = { rects, containerH };

    setIsExpanded((prev) => (forced !== undefined ? forced : !prev));
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!pendingFlip.current) return;
    const { rects: oldRects, containerH: oldH } = pendingFlip.current;
    pendingFlip.current = null;

    // 1. Smooth container height transition
    if (containerRef.current && oldH !== null) {
      const container = containerRef.current;
      const newH = container.getBoundingClientRect().height;

      if (Math.abs(oldH - newH) > 1) {
        container.style.height = `${oldH}px`;
        container.style.overflow = 'hidden';
        container.style.transition = 'none';

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            container.style.transition = 'height 300ms cubic-bezier(0.2, 0, 0, 1)';
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

    // 2. Smooth position interpolation (FLIP) for each child element
    itemRefs.current.forEach((el, key) => {
      if (!el) return;
      const oldRect = oldRects.get(key);
      if (!oldRect) return;

      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        // Invert: position element visually at previous screen coordinates
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.style.transition = 'none';

        // Play: animate smoothly to target position
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.transition =
              'transform 300ms cubic-bezier(0.2, 0, 0, 1), background-color 300ms ease-in-out, border-color 300ms ease-in-out, padding 300ms ease-in-out, margin 300ms ease-in-out';
            el.style.transform = '';

            const onTransitionEnd = (e: TransitionEvent) => {
              if (e.target === el && e.propertyName === 'transform') {
                el.style.transition = '';
                el.removeEventListener('transitionend', onTransitionEnd);
              }
            };
            el.addEventListener('transitionend', onTransitionEnd);
          });
        });
      }
    });
  }, [isExpanded]);

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 300;
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popoverWidth - 16);
    }
    const top = rect.bottom + 6;
    setCoords({ top, left });
  }, []);

  // Fetch board members
  const loadBoardMembers = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await getBoardMembersForCardAction(boardId);
      if (res.success && res.data) {
        setBoardMembers(res.data);
      } else {
        setErrorMessage(res.message || 'Failed to load board members');
      }
    } catch {
      setErrorMessage('Network error loading board members');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadBoardMembers();
      setSearchQuery('');
      setErrorMessage(null);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, updateCoords, loadBoardMembers]);

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

  // Check if a user is currently a member of the card
  const assignedMembers: CardMemberDTO[] = card.members || [];
  const assignedUserIds = new Set(assignedMembers.map((m) => m.userId));

  const isCurrentUserAssigned = currentUserId ? assignedUserIds.has(currentUserId) : false;

  // Filter board members based on search query
  const filteredBoardMembers = boardMembers.filter((bm) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      bm.user.name.toLowerCase().includes(q) ||
      bm.user.username.toLowerCase().includes(q) ||
      bm.user.email.toLowerCase().includes(q)
    );
  });

  // Toggle member assignment
  const handleToggleMember = async (targetUserId: number) => {
    if (!canUpdate || togglingUserId !== null) return;

    const isAssigned = assignedUserIds.has(targetUserId);
    setTogglingUserId(targetUserId);
    setErrorMessage(null);

    // Optimistic UI update
    const previousCard = { ...card };
    let optimisticMembers = [...assignedMembers];

    if (isAssigned) {
      optimisticMembers = optimisticMembers.filter((m) => m.userId !== targetUserId);
    } else {
      const bm = boardMembers.find((b) => b.userId === targetUserId);
      if (bm) {
        optimisticMembers.push({
          id: -targetUserId,
          cardId: card.id,
          userId: targetUserId,
          createdAt: '',
          user: {
            id: bm.user.id,
            name: bm.user.name,
            username: bm.user.username,
            email: bm.user.email,
            profilePicture: bm.user.profilePicture,
          },
        });
      }
    }

    onCardUpdated({ ...card, members: optimisticMembers });

    try {
      const res = await toggleCardMemberAction({
        cardId: card.id,
        userId: targetUserId,
      });

      if (res.success && res.data) {
        onCardUpdated(res.data.card);
      } else {
        // Rollback
        onCardUpdated(previousCard);
        setErrorMessage(res.message || 'Failed to update member');
      }
    } catch {
      // Rollback
      onCardUpdated(previousCard);
      setErrorMessage('Connection error. Could not update member.');
    } finally {
      setTogglingUserId(null);
    }
  };

  const shouldBreakAfter = (index: number) => {
    if (!isExpanded) return false;
    // Break after every 2 members (odd indices: 1, 3, etc.)
    if (index % 2 !== 1) return false;
    // Only break if there are remaining members or the add button
    return index < assignedMembers.length - 1 || canUpdate;
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

  return (
    <div className="shrink-0 max-w-[270px] sm:max-w-[300px] lg:max-w-[325px]">
      {/* Label on top: "Members" + Expand button beside it (no circular outline) */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Members
        </span>
        {assignedMembers.length > 0 && (
          <button
            type="button"
            onClick={() => toggleExpanded()}
            className="p-0.5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer rounded focus:outline-none"
            title={isExpanded ? 'Shrink member names' : 'Expand member names'}
            aria-label={isExpanded ? 'Shrink member names' : 'Expand member names'}
          >
            {isExpanded ? (
              <Shrink className="w-3.5 h-3.5 text-emerald-600 hover:text-emerald-700 transition-transform duration-200" />
            ) : (
              <Expand className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 transition-transform duration-200" />
            )}
          </button>
        )}
      </div>

      {/* Row containing members - animates seamlessly on BOTH expand and collapse */}
      <div ref={containerRef} className="flex items-center flex-wrap">
        {assignedMembers.map((m, index) => {
          const { bg, text } = getMemberColor(m.userId);
          const isOverflow = !isExpanded && index >= 4;

          return (
            <React.Fragment key={m.userId}>
              <div
                ref={(node) => {
                  if (node) itemRefs.current.set(m.userId, node);
                  else itemRefs.current.delete(m.userId);
                }}
                className={`inline-flex items-center rounded-full transition-all duration-300 ease-in-out overflow-hidden ${
                  isOverflow
                    ? 'max-w-0 opacity-0 -mr-0 pointer-events-none scale-0'
                    : isExpanded
                    ? 'bg-gray-100 hover:bg-gray-200/80 border border-gray-200/60 shadow-2xs pl-1 pr-2 py-0.5 mr-2 mb-1.5 opacity-100 scale-100'
                    : 'bg-transparent border-transparent p-0 -mr-2 mb-0 opacity-100 scale-100 cursor-pointer hover:z-20'
                }`}
                onClick={!isExpanded ? () => toggleExpanded(true) : undefined}
                title={!isExpanded ? `${m.user.name} (@${m.user.username}) - Click to expand` : undefined}
              >
                {/* Avatar */}
                <div
                  style={{ backgroundColor: bg, color: text }}
                  className={`rounded-full font-bold flex items-center justify-center overflow-hidden shrink-0 shadow-2xs transition-all duration-300 ease-in-out ${
                    isExpanded
                      ? 'w-6 h-6 text-[10px] ring-1 ring-white'
                      : 'w-8 h-8 text-xs ring-2 ring-white hover:scale-105'
                  }`}
                >
                  {m.user.profilePicture ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.user.profilePicture}
                      alt={m.user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(m.user.name)}</span>
                  )}
                </div>

                {/* Name & Remove Button container - animates width and opacity smoothly on both expand and collapse */}
                <div
                  className={`flex items-center overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded
                      ? 'max-w-[130px] opacity-100 ml-1.5'
                      : 'max-w-0 opacity-0 ml-0 pointer-events-none'
                  }`}
                >
                  <span className="text-xs font-semibold text-gray-800 whitespace-nowrap truncate max-w-[95px] sm:max-w-[110px]">
                    {m.user.name}
                  </span>

                  {canUpdate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMember(m.userId);
                      }}
                      disabled={togglingUserId === m.userId}
                      className="ml-1 p-0.5 text-gray-400 hover:text-red-600 rounded-full hover:bg-black/5 transition-colors cursor-pointer shrink-0"
                      title={`Remove ${m.user.name}`}
                      aria-label={`Remove ${m.user.name}`}
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  )}
                </div>
              </div>

              {/* Force line break after every 2 members when expanded */}
              {shouldBreakAfter(index) && (
                <div className="w-full h-0 basis-full" />
              )}
            </React.Fragment>
          );
        })}

        {/* Counter badge for >4 members in collapsed mode */}
        {assignedMembers.length > 4 && (
          <div
            ref={(el) => {
              if (el) itemRefs.current.set('overflow-badge', el);
              else itemRefs.current.delete('overflow-badge');
            }}
            className={`rounded-full bg-gray-100 text-gray-700 text-[11px] font-bold flex items-center justify-center ring-2 ring-white shadow-2xs shrink-0 cursor-pointer transition-all duration-300 hover:bg-gray-200 hover:z-20 ${
              !isExpanded
                ? 'w-8 h-8 opacity-100 scale-100 -mr-2 mb-0'
                : 'w-0 h-0 opacity-0 scale-0 -mr-0 mb-0 pointer-events-none overflow-hidden'
            }`}
            onClick={() => toggleExpanded(true)}
            title={`${assignedMembers.length - 4} more members - Click to expand`}
          >
            +{assignedMembers.length - 4}
          </div>
        )}

        {/* Circular '+' Button (stacked when collapsed, spaced when expanded) */}
        {canUpdate && (
          <button
            ref={(el) => {
              (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
              if (el) itemRefs.current.set('add-button', el);
              else itemRefs.current.delete('add-button');
            }}
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={`w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border border-gray-200/80 flex items-center justify-center transition-all duration-300 cursor-pointer shadow-2xs shrink-0 hover:z-20 ${
              isExpanded ? 'ring-0 mb-1.5' : 'ring-2 ring-white mb-0'
            }`}
            title="Add members"
            aria-label="Add members"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {!canUpdate && assignedMembers.length === 0 && (
          <span className="text-xs text-gray-400 italic">No members</span>
        )}
      </div>

      {/* Popover Picker */}
      {mounted &&
        isOpen &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Assign members to card"
            style={{
              top: coords.top,
              left: coords.left,
            }}
            className="fixed z-60 w-72 bg-white rounded-2xl shadow-xl border border-gray-200/90 p-3 animate-in fade-in zoom-in-95 duration-100 text-left font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                Members
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="mb-2 p-1.5 bg-red-50 text-red-600 text-[11px] rounded-lg border border-red-200">
                {errorMessage}
              </div>
            )}

            {/* Quick Action: Assign to Me */}
            {currentUserId && (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => handleToggleMember(currentUserId)}
                  disabled={togglingUserId === currentUserId}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    isCurrentUserAssigned
                      ? 'bg-red-50 hover:bg-red-100 text-red-700'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCurrentUserAssigned ? (
                      <UserMinus className="w-3.5 h-3.5 text-red-600" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>{isCurrentUserAssigned ? 'Remove myself' : 'Assign to me'}</span>
                  </div>
                  {togglingUserId === currentUserId && (
                    <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                  )}
                </button>
              </div>
            )}

            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search board members..."
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

            {/* Board Members List */}
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1">
              Board Members
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
              {loading ? (
                <div className="py-6 flex flex-col items-center justify-center text-gray-400 gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span className="text-xs">Loading members...</span>
                </div>
              ) : filteredBoardMembers.length === 0 ? (
                <div className="py-4 text-center text-xs text-gray-400">
                  {searchQuery ? 'No members match search' : 'No board members found'}
                </div>
              ) : (
                filteredBoardMembers.map((bm) => {
                  const isAssigned = assignedUserIds.has(bm.userId);
                  const isBusy = togglingUserId === bm.userId;

                  return (
                    <button
                      key={bm.userId}
                      type="button"
                      onClick={() => handleToggleMember(bm.userId)}
                      disabled={isBusy}
                      className={`w-full text-left px-2 py-1.5 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer group ${
                        isAssigned
                          ? 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950 font-semibold'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Member Avatar */}
                        {(() => {
                          const { bg, text } = getMemberColor(bm.userId);
                          return (
                            <div
                              style={{ backgroundColor: bg, color: text }}
                              className="w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-white"
                            >
                              {bm.user.profilePicture ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={bm.user.profilePicture}
                                  alt={bm.user.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{getInitials(bm.user.name)}</span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Name and username */}
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold truncate leading-tight">
                            {bm.user.name}
                          </span>
                          <span className="block text-[10px] text-gray-400 truncate leading-tight">
                            @{bm.user.username}
                          </span>
                        </div>
                      </div>

                      {/* Right indicator: Check or Loading */}
                      <div className="shrink-0 flex items-center">
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        ) : isAssigned ? (
                          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-md border border-gray-200 group-hover:border-gray-300" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
