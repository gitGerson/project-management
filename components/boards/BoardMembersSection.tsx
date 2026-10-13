'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Lock,
  Info,
  Loader2,
  Plus,
  Globe,
  UserPlus,
  ShieldCheck,
  Search,
  X,
  Check,
} from 'lucide-react';
import {
  getBoardMembersAction,
  searchAssignableUsersAction,
  syncBoardMembersAction,
} from '@/modules/board-members/actions';
import type {
  BoardMemberDTO,
  BoardMemberRole,
  BoardMemberUserDTO,
} from '@/modules/board-members/types';

interface BoardMembersSectionProps {
  boardId: number;
  canEdit?: boolean;
}

// Extract 2-letter uppercase initials from user's full name
function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// English role definitions for the role information popover
const ROLE_DEFINITIONS = [
  {
    role: 'owner',
    title: 'Owner',
    badge: 'FULL',
    badgeStyle: 'bg-[#dcfce7] text-[#15803d]',
    cardBorder: 'border-[#a7f3d0] bg-[#f0fdf4]/60',
    dotBorder: 'border-emerald-500',
    description: 'Full access to manage board settings, lists, cards, and all members.',
  },
  {
    role: 'member',
    title: 'Member',
    badge: 'STANDARD',
    badgeStyle: 'bg-[#e0e7ff] text-[#3730a3]',
    cardBorder: 'border-[#c7d2fe] bg-[#f5f7ff]',
    dotBorder: 'border-indigo-400',
    description: 'Can view all cards on the board, and participate in assigned cards and checklists.',
  },
  {
    role: 'monitor',
    title: 'Monitor',
    badge: 'MONITOR',
    badgeStyle: 'bg-[#cffafe] text-[#0e7490]',
    cardBorder: 'border-[#a5f3fc] bg-[#ecfeff]/60',
    dotBorder: 'border-cyan-500',
    description: 'Can view and open all cards for monitoring without needing to be assigned.',
  },
  {
    role: 'guest',
    title: 'Guest',
    badge: 'LIMITED',
    badgeStyle: 'bg-[#fef3c7] text-[#b45309]',
    cardBorder: 'border-[#fde68a] bg-[#fffbeb]/60',
    dotBorder: 'border-amber-400',
    description: 'Limited access. Can only view and open cards specifically assigned to them.',
  },
];

export function BoardMembersSection({ boardId, canEdit = true }: BoardMembersSectionProps) {
  const [savedMembers, setSavedMembers] = useState<BoardMemberDTO[]>([]);
  const [stagedMembers, setStagedMembers] = useState<BoardMemberDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Role info Popover state
  const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);

  // Add Member Dropdown state
  const [activeAddRole, setActiveAddRole] = useState<BoardMemberRole | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<BoardMemberUserDTO[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load initial members from database
  useEffect(() => {
    let isCancelled = false;

    async function loadMembers() {
      setIsLoading(true);
      try {
        const res = await getBoardMembersAction(boardId);
        if (!isCancelled && res.success && res.data) {
          setSavedMembers(res.data);
          setStagedMembers(res.data);
        }
      } catch (err) {
        console.error('Failed to load board members:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      isCancelled = true;
    };
  }, [boardId]);

  // Listen for real-time board member updates from other users or actions
  useEffect(() => {
    const handleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ boardId: number }>;
      if (customEvent.detail?.boardId === boardId) {
        getBoardMembersAction(boardId).then((res) => {
          if (res.success && res.data) {
            const data = res.data;
            setSavedMembers(data);
            setStagedMembers((currentStaged) => {
              if (savedMembers.length !== currentStaged.length) return currentStaged;
              return data;
            });
          }
        });
      }
    };

    window.addEventListener('board-members-updated', handleUpdated);
    return () => window.removeEventListener('board-members-updated', handleUpdated);
  }, [boardId, savedMembers.length]);

  // Check if staged differs from saved
  const isDirty = React.useMemo(() => {
    if (savedMembers.length !== stagedMembers.length) return true;
    const savedMap = new Map(savedMembers.map((m) => [m.userId, m.role]));
    for (const m of stagedMembers) {
      if (savedMap.get(m.userId) !== m.role) return true;
    }
    return false;
  }, [savedMembers, stagedMembers]);

  // Search users whenever query or activeAddRole changes
  useEffect(() => {
    if (!activeAddRole) return;

    let isCurrent = true;
    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await searchAssignableUsersAction(searchQuery);
        if (isCurrent && res.success && res.data) {
          setAvailableUsers(res.data);
        }
      } catch (err) {
        console.error('Error searching assignable users:', err);
      } finally {
        if (isCurrent) setIsSearchingUsers(false);
      }
    }, 150);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeAddRole]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (!activeAddRole) return;

    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    return () => clearTimeout(timer);
  }, [activeAddRole]);

  // Click outside listener for Add Member dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveAddRole(null);
      }
    }
    if (activeAddRole) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeAddRole]);

  // Update floating popover position for role info
  const updatePopoverPosition = useCallback(() => {
    if (!infoButtonRef.current) return;
    const rect = infoButtonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(760, window.innerWidth - 32);

    let left = rect.left - 16;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = window.innerWidth - 16 - popoverWidth;
    }
    if (left < 16) {
      left = 16;
    }

    let top = rect.bottom + 8;
    if (top + 280 > window.innerHeight) {
      top = Math.max(16, rect.top - 280 - 8);
    }

    setPopoverPos({ top, left });
  }, []);

  useEffect(() => {
    if (isInfoPopoverOpen) {
      updatePopoverPosition();
      window.addEventListener('resize', updatePopoverPosition);
      window.addEventListener('scroll', updatePopoverPosition, true);
      return () => {
        window.removeEventListener('resize', updatePopoverPosition);
        window.removeEventListener('scroll', updatePopoverPosition, true);
      };
    }
  }, [isInfoPopoverOpen, updatePopoverPosition]);

  // Escape listener to close info popover
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isInfoPopoverOpen) setIsInfoPopoverOpen(false);
        if (activeAddRole) setActiveAddRole(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInfoPopoverOpen, activeAddRole]);

  // Add user to staged members
  const handleSelectUser = (user: BoardMemberUserDTO) => {
    if (!activeAddRole) return;

    setStagedMembers((prev) => {
      const existingIndex = prev.findIndex((m) => m.userId === user.id);
      if (existingIndex >= 0) {
        // Update existing member's role
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          role: activeAddRole,
        };
        return updated;
      }
      // Add new member
      const newMember: BoardMemberDTO = {
        boardId,
        userId: user.id,
        role: activeAddRole,
        user,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return [...prev, newMember];
    });

    setActiveAddRole(null);
  };

  // Remove user from staged members
  const handleRemoveMember = (userId: number) => {
    setStagedMembers((prev) => prev.filter((m) => m.userId !== userId));
  };

  // Cancel pending changes
  const handleCancelChanges = () => {
    setStagedMembers(savedMembers);
    setStatusMessage(null);
  };

  // Save changes to database
  const handleSaveChanges = async () => {
    if (!isDirty || !canEdit) return;

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await syncBoardMembersAction({
        boardId,
        members: stagedMembers.map((m) => ({
          userId: m.userId,
          role: m.role,
        })),
      });

      if (res.success && res.data) {
        setSavedMembers(res.data);
        setStagedMembers(res.data);
        setStatusMessage({ type: 'success', text: 'Board members updated successfully.' });
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Failed to save board members.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'An unexpected error occurred while saving board members.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      {/* 1. Top Bar: Heading with Info 'i' Button & Add Buttons */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
          {/* Heading + Role Info 'i' Button */}
          <div className="flex items-center gap-1.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Member
            </h4>
            <button
              ref={infoButtonRef}
              type="button"
              onClick={() => setIsInfoPopoverOpen((prev) => !prev)}
              className={`w-5 h-5 rounded-full flex items-center justify-center transition cursor-pointer ${
                isInfoPopoverOpen
                  ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500/20'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="Role Information & Access"
              aria-label="Role Information"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add per Role Buttons */}
          {canEdit && (
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
              {/* + Add owner */}
              <button
                type="button"
                onClick={() =>
                  setActiveAddRole((current) => (current === 'owner' ? null : 'owner'))
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer shadow-2xs ${
                  activeAddRole === 'owner'
                    ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/20'
                    : 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0] hover:bg-[#d1fae5]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>+ Add owner</span>
              </button>

              {/* + Add member */}
              <button
                type="button"
                onClick={() =>
                  setActiveAddRole((current) => (current === 'member' ? null : 'member'))
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer shadow-2xs ${
                  activeAddRole === 'member'
                    ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/20'
                    : 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe] hover:bg-[#dbeafe]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add member</span>
              </button>

              {/* + Add monitor */}
              <button
                type="button"
                onClick={() =>
                  setActiveAddRole((current) => (current === 'monitor' ? null : 'monitor'))
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer shadow-2xs ${
                  activeAddRole === 'monitor'
                    ? 'bg-cyan-600 text-white border-cyan-600 ring-2 ring-cyan-500/20'
                    : 'bg-[#ecfeff] text-[#0891b2] border-[#a5f3fc] hover:bg-[#cffafe]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Add monitor</span>
              </button>

              {/* + Add guest */}
              <button
                type="button"
                onClick={() =>
                  setActiveAddRole((current) => (current === 'guest' ? null : 'guest'))
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer shadow-2xs ${
                  activeAddRole === 'guest'
                    ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-500/20'
                    : 'bg-[#fffbeb] text-[#d97706] border-[#fde68a] hover:bg-[#fef3c7]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add guest</span>
              </button>
            </div>
          )}
        </div>

        {/* User Search & Selection Dropdown */}
        {activeAddRole && (
          <div
            ref={dropdownRef}
            className="absolute right-0 top-10 z-20 w-full sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-200/90 p-3 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider capitalize">
                Add as {activeAddRole}
              </span>
              <button
                type="button"
                onClick={() => setActiveAddRole(null)}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded-md hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user by name or username..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition"
              />
            </div>

            {/* User List */}
            <div className="max-h-52 overflow-y-auto space-y-1 divide-y divide-gray-50">
              {isSearchingUsers ? (
                <div className="flex items-center justify-center py-6 text-xs text-gray-400 gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-green-600" />
                  <span>Searching users...</span>
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400 italic">
                  {searchQuery ? 'No users found matching query' : 'No users available'}
                </div>
              ) : (
                availableUsers.map((user) => {
                  const existingMember = stagedMembers.find((m) => m.userId === user.id);
                  const isCurrentRole = existingMember?.role === activeAddRole;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                        isCurrentRole
                          ? 'bg-green-50/60 hover:bg-green-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {user.profilePicture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.profilePicture}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-gray-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                            {getInitials(user.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">
                            {user.name}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            @{user.username}
                          </div>
                        </div>
                      </div>

                      {existingMember && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize bg-gray-100 text-gray-600 flex-shrink-0 ml-2">
                          {existingMember.role}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Member Chips Pool */}
        {isLoading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-green-600" />
            <span>Loading board members...</span>
          </div>
        ) : stagedMembers.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-2">
            No members assigned to this board yet. Use the buttons above to add members.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {stagedMembers.map((member) => {
              const role = member.role;
              const initials = getInitials(member.user.name);

              if (role === 'owner') {
                return (
                  <div
                    key={member.userId}
                    className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-[#a7f3d0] bg-[#e6f8ef] text-gray-800 shadow-2xs transition hover:shadow-xs"
                  >
                    {member.user.profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.user.profilePicture}
                        alt={member.user.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#10b981] text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                        {initials}
                      </div>
                    )}
                    <span className="font-bold text-gray-800 tracking-tight text-xs">
                      {member.user.name}
                    </span>
                    <span className="bg-[#a7f3d0] text-[#065f46] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Owner
                    </span>
                    <Lock className="w-3.5 h-3.5 text-[#059669]" />
                    {canEdit && stagedMembers.filter((m) => m.role === 'owner').length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-emerald-100 transition cursor-pointer -mr-1"
                        title="Remove Owner"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              }

              if (role === 'member') {
                return (
                  <div
                    key={member.userId}
                    className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-gray-200 bg-[#f1f5f9] text-gray-800 shadow-2xs transition hover:shadow-xs"
                  >
                    {member.user.profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.user.profilePicture}
                        alt={member.user.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#3b82f6] text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                        {initials}
                      </div>
                    )}
                    <span className="font-semibold text-gray-800 tracking-tight text-xs">
                      {member.user.name}
                    </span>
                    <span className="bg-[#dbeafe] text-[#1e40af] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Member
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-gray-200/80 transition cursor-pointer -mr-1"
                        title="Remove Member"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              }

              if (role === 'monitor') {
                return (
                  <div
                    key={member.userId}
                    className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-[#a5f3fc] bg-[#ecfeff] text-gray-800 shadow-2xs transition hover:shadow-xs"
                  >
                    {member.user.profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.user.profilePicture}
                        alt={member.user.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#06b6d4] text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                        {initials}
                      </div>
                    )}
                    <span className="font-semibold text-gray-800 tracking-tight text-xs">
                      {member.user.name}
                    </span>
                    <span className="bg-[#cffafe] text-[#155e75] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      Monitor
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-cyan-100 transition cursor-pointer -mr-1"
                        title="Remove Monitor"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              }

              // Guest
              return (
                <div
                  key={member.userId}
                  className="inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-[#fde68a] bg-[#fffbeb] text-gray-800 shadow-2xs transition hover:shadow-xs"
                >
                  {member.user.profilePicture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.user.profilePicture}
                      alt={member.user.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#f59e0b] text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
                      {initials}
                    </div>
                  )}
                  <span className="font-semibold text-gray-800 tracking-tight text-xs">
                    {member.user.name}
                  </span>
                  <span className="bg-[#fef3c7] text-[#92400e] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Guest
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.userId)}
                      className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-amber-100 transition cursor-pointer -mr-1"
                      title="Remove Guest"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Status Notification & Compact Action Buttons (Cancel / Save Changes) */}
      {canEdit && (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Status Message */}
          <div className="text-xs font-medium">
            {statusMessage && (
              <span
                className={`inline-flex items-center gap-1.5 ${
                  statusMessage.type === 'success' ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <X className="w-3.5 h-3.5 text-red-600" />
                )}
                <span>{statusMessage.text}</span>
              </span>
            )}
            {!statusMessage && isDirty && (
              <span className="text-amber-600 text-[11px]">
                Unsaved changes. Click &quot;Save Changes&quot; to apply.
              </span>
            )}
          </div>

          {/* Compact Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCancelChanges}
              disabled={!isDirty || isSaving}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                isDirty && !isSaving
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-100 bg-white'
                  : 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed opacity-60'
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={!isDirty || isSaving}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                isDirty && !isSaving
                  ? 'bg-[#22864a] text-white hover:bg-[#1b6b3b]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. Floating Unconstrained Role Information Popover (Portal to body) */}
      {isInfoPopoverOpen && typeof document !== 'undefined' && popoverPos &&
        createPortal(
          <>
            {/* Backdrop for click outside */}
            <div
              className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-3xs"
              onClick={() => setIsInfoPopoverOpen(false)}
              aria-hidden="true"
            />

            {/* Floating Popover Container: Not bound by modal width or overflow */}
            <div
              style={{
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
              }}
              className="fixed z-[65] w-[760px] max-w-[94vw] bg-white rounded-2xl shadow-2xl border border-gray-200/90 p-4 sm:p-5 animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-label="Role Information and Permissions"
            >
              {/* Popover Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 leading-none">
                      Role Permissions & Access
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Understanding member privileges and access limits across the board
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsInfoPopoverOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 4 Role Cards in a Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3.5">
                {ROLE_DEFINITIONS.map((def) => (
                  <div
                    key={def.role}
                    className={`rounded-xl p-3 border ${def.cardBorder} flex flex-col justify-between shadow-2xs`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full border-2 ${def.dotBorder} inline-block bg-white`}
                          />
                          <span className="text-xs font-bold text-gray-900">
                            {def.title}
                          </span>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${def.badgeStyle}`}
                        >
                          {def.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        {def.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
