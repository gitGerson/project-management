'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Kanban, Settings, MessageSquare } from 'lucide-react';
import { PERMISSIONS } from '@/modules/rbac/constants';
import { ManagementSettingsModal } from './ManagementSettingsModal';
import { useChat } from '@/modules/chat';

interface FloatingNavbarProps {
  permissions?: string[];
}

export function FloatingNavbar({ permissions = [] }: FloatingNavbarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isChatOpen, toggleChat, unreadCount } = useChat();

  const canReadUsers = permissions.includes(PERMISSIONS.USERS_READ);
  const canManageRoles = permissions.includes(PERMISSIONS.ROLES_MANAGE);
  const canAccessSettings = canReadUsers || canManageRoles;

  return (
    <>
      <nav
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 select-none"
        aria-label="Quick navigation"
      >
        <div className="bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-1.5 flex items-center gap-1.5">
          {/* Active Boards Tab */}
          <Link
            href="/"
            className="bg-[#dcfce7] text-[#15803d] font-semibold text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-2 shadow-xs transition active:scale-95"
          >
            <Kanban className="w-4 h-4 text-[#15803d]" />
            <span>Boards</span>
          </Link>

          {/* Live Chat Tab Button */}
          <button
            type="button"
            onClick={toggleChat}
            className={`relative text-gray-700 hover:bg-gray-100/80 text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition active:scale-95 cursor-pointer ${
              isChatOpen ? 'bg-emerald-50 font-semibold text-[#15803d]' : ''
            }`}
            aria-label="Toggle live chat"
          >
            <div className="relative flex items-center">
              <MessageSquare
                className={`w-4 h-4 ${
                  isChatOpen ? 'text-[#15803d]' : 'text-gray-500'
                }`}
              />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2.5 px-1 py-0.2 min-w-[15px] h-[15px] text-[9px] font-bold text-white bg-emerald-600 rounded-full flex items-center justify-center shadow-xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span>Chat</span>
          </button>

          {/* Settings Tab Button - Only rendered if user has permission to manage users or roles */}
          {canAccessSettings && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={`text-gray-700 hover:bg-gray-100/80 text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition active:scale-95 cursor-pointer ${
                isSettingsOpen ? 'bg-gray-100 font-semibold text-green-800' : ''
              }`}
              aria-label="Open management settings"
            >
              <Settings className="w-4 h-4 text-gray-500" />
              <span>Settings</span>
            </button>
          )}
        </div>
      </nav>

      {/* Access Control & User Management Modal */}
      {canAccessSettings && (
        <ManagementSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          initialTab={canReadUsers ? 'users' : 'roles'}
          canReadUsers={canReadUsers}
          canManageRoles={canManageRoles}
        />
      )}
    </>
  );
}
