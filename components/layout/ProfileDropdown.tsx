'use client';

import React, { useEffect, useRef } from 'react';
import { UserPen, Power } from 'lucide-react';
import { logoutAction } from '@/modules/auth/actions';

interface ProfileDropdownProps {
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenProfileSettings?: () => void;
}

export function ProfileDropdown({
  user,
  isOpen,
  onClose,
  onOpenProfileSettings,
}: ProfileDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate initials (e.g., Gerson Manuel Sugianto -> GM)
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const displayName = user?.name || 'GERSON MANUEL SUGIANTO';
  const initials = getInitials(displayName);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2.5 z-50 text-gray-800"
      role="menu"
      aria-orientation="vertical"
    >
      {/* User Info Header */}
      <div className="px-4 py-2 flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#364574] text-white flex items-center justify-center font-bold text-sm shadow-sm">
            {initials}
          </div>
          <span
            className="w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white absolute bottom-0 right-0 shadow-xs"
            title="Online"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate uppercase tracking-tight">
            {displayName}
          </h4>
          <p className="text-[11px] text-gray-400 truncate">
            {user?.email || 'gerson@tongtji.com'}
          </p>
          <div className="mt-1">
            <span className="inline-block bg-[#dcfce7] text-[#15803d] text-[10px] font-semibold px-2 py-0.5 rounded">
              Viewer Template
            </span>
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-100 my-1" />

      {/* Menu Actions */}
      <div className="px-2 py-0.5 space-y-0.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenProfileSettings?.();
          }}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
        >
          <UserPen className="w-4 h-4 text-gray-500" />
          <span>Profile Settings</span>
        </button>
      </div>

      <div className="h-px bg-gray-100 my-1" />

      {/* Log Out */}
      <div className="px-2 py-0.5">
        <form action={logoutAction} className="m-0">
          <button
            type="submit"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100/80 transition w-full text-left cursor-pointer"
          >
            <Power className="w-4 h-4 text-gray-500" />
            <span>Log Out</span>
          </button>
        </form>
      </div>

      <div className="h-px bg-gray-100 my-1" />

      {/* Copyright */}
      <div className="px-4 py-1 text-center text-[11px] text-gray-400 select-none">
        © {new Date().getFullYear()} , Tong Tji IT RnD Team
      </div>
    </div>
  );
}
