'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  User,
  Plug,
  Camera,
  Lock,
  Calendar,
  Check,
  Upload,
} from 'lucide-react';

interface ProfileSettingsModalProps {
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
    phone?: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'profile' | 'integrations';
}

export function ProfileSettingsModal({
  user,
  isOpen,
  onClose,
  initialTab = 'profile',
}: ProfileSettingsModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'integrations'>(initialTab);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [fullName, setFullName] = useState(user?.name || 'GERSON MANUEL SUGIANTO');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [secondaryEmailSaved, setSecondaryEmailSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Trigger enter animation on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Graceful dismiss handler with exit transition
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    const timer = setTimeout(() => {
      onClose();
    }, 200);
    return () => clearTimeout(timer);
  }, [onClose]);

  // Handle ESC key to close modal with animation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleDismiss();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  if (!isOpen && !isVisible) return null;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials(fullName);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setAvatarMessage('File size must be under 2MB.');
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setPreviewAvatar(previewUrl);
      setAvatarMessage('Preview updated! Integration hook ready for storage upload.');
      setTimeout(() => setAvatarMessage(null), 4000);
    }
  };

  const handleSaveSecondaryEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secondaryEmail) return;
    setSecondaryEmailSaved(true);
    setTimeout(() => setSecondaryEmailSaved(false), 3500);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto transition-opacity duration-200 ease-in-out motion-reduce:transition-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
    >
      {/* Click outside backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-200 ease-in-out motion-reduce:transition-none"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className={`relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 transition-all duration-200 ease-in-out motion-reduce:transition-none motion-reduce:transform-none ${
          isVisible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-2'
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 pt-5 pb-0 border-b border-gray-100 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="profile-settings-title" className="text-lg font-bold text-gray-900">
                Account Settings
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage your profile information and connected integrations
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition cursor-pointer"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-6 -mb-px">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('integrations')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'integrations'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Plug className="w-4 h-4" />
              <span>Integrations</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Profile Picture Interaction */}
              <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-shrink-0">
                  {previewAvatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={previewAvatar}
                      alt="Avatar preview"
                      className="w-16 h-16 rounded-full object-cover shadow-sm border-2 border-white"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[#364574] text-white flex items-center justify-center font-bold text-xl shadow-sm border-2 border-white">
                      {initials}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:text-green-700 hover:bg-gray-50 transition cursor-pointer"
                    title="Upload new photo"
                    aria-label="Upload photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900">Profile Photo</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upload a custom profile photo (PNG, JPG, or WEBP up to 2MB).
                  </p>

                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-xs font-medium rounded-lg shadow-2xs hover:bg-gray-50 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3 h-3 text-gray-500" />
                      <span>Change photo</span>
                    </button>
                    {previewAvatar && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewAvatar(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-red-600 font-medium transition cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {avatarMessage && (
                    <p className="text-xs text-green-700 font-medium mt-2 animate-in fade-in">
                      {avatarMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Full Name (Editable) */}
                <div>
                  <label htmlFor="modal_name" className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    id="modal_name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition"
                    placeholder="Your full name"
                  />
                </div>

                {/* Username (Disabled) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="modal_username" className="block text-xs font-semibold text-gray-700">
                      Username
                    </label>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Managed by LDAP
                    </span>
                  </div>
                  <input
                    id="modal_username"
                    type="text"
                    value={user?.username || 'gerson'}
                    disabled
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-100/80 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed select-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Corporate Active Directory account identifier cannot be changed manually.
                  </p>
                </div>

                {/* Corporate Email (Disabled) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="modal_email" className="block text-xs font-semibold text-gray-700">
                      Corporate Email
                    </label>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Managed by LDAP
                    </span>
                  </div>
                  <input
                    id="modal_email"
                    type="email"
                    value={user?.email || 'gerson@tongtji.com'}
                    disabled
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-100/80 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed select-none"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Primary organization email address used for Single Sign-On and security.
                  </p>
                </div>

                {/* Password (Disabled) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="modal_password" className="block text-xs font-semibold text-gray-700">
                      Password
                    </label>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Managed by LDAP
                    </span>
                  </div>
                  <input
                    id="modal_password"
                    type="password"
                    value="••••••••••••••••"
                    disabled
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-100/80 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed select-none tracking-widest"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Please use your Windows domain / Active Directory workstation to update your password.
                  </p>
                </div>

                {/* Phone (Disabled) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="modal_phone" className="block text-xs font-semibold text-gray-700">
                      Phone Number
                    </label>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Managed by Organization
                    </span>
                  </div>
                  <input
                    id="modal_phone"
                    type="text"
                    value={user?.phone || 'Not provided'}
                    disabled
                    className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-100/80 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed select-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Calendar Section */}
              <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-green-700" />
                  <h3 className="text-sm font-bold text-gray-900">Calendar Integrations</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Synchronize your board card deadlines, milestones, and meeting schedules.
                </p>

                <div className="space-y-3 divide-y divide-gray-100">
                  {/* Carbonio Calendar */}
                  <div className="pt-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Carbonio Calendar</p>
                      <p className="text-[11px] text-gray-400">Connected</p>
                    </div>
                    <span className="bg-[#dcfce7] text-[#15803d] text-xs font-semibold px-2.5 py-1 rounded-md">
                      Connected
                    </span>
                  </div>

                  {/* Google Calendar */}
                  <div className="pt-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Google Calendar</p>
                      <p className="text-[11px] text-gray-400">Connected</p>
                    </div>
                    <button
                      type="button"
                      className="border border-red-500 text-red-500 text-xs font-medium px-3 py-1 rounded-md hover:bg-red-50 transition cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>

              {/* Notification Email Section matching Screenshot */}
              <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">Notification Email</h3>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Add an external address to receive the same board notification emails as your primary address.
                  </p>
                </div>

                {/* Primary email */}
                <div>
                  <label htmlFor="modal_primary_email" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Primary email
                  </label>
                  <input
                    id="modal_primary_email"
                    type="email"
                    value={user?.email || 'gerson@tongtji.com'}
                    disabled
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-100/80 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed select-none"
                  />
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1.5">
                    Managed by your organization and used for authentication-related email.
                  </p>
                </div>

                {/* Secondary notification email */}
                <form onSubmit={handleSaveSecondaryEmail} className="space-y-4">
                  <div>
                    <label htmlFor="modal_secondary_email" className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Secondary notification email
                    </label>
                    <input
                      id="modal_secondary_email"
                      type="email"
                      value={secondaryEmail}
                      onChange={(e) => setSecondaryEmail(e.target.value)}
                      placeholder="e.g. personal@example.com"
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition"
                      required
                    />
                    <p className="text-[11px] sm:text-xs text-gray-500 mt-1.5">
                      After saving, check your inbox and spam or junk folder for the verification email.
                    </p>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="bg-[#238636] hover:bg-[#1f7a31] text-white font-medium px-4 py-2 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-98"
                    >
                      {secondaryEmailSaved ? (
                        <>
                          <Check className="w-4 h-4 text-white" />
                          <span>Verification sent!</span>
                        </>
                      ) : (
                        <span>Save and send verification</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
          >
            Close
          </button>
          {activeTab === 'profile' && (
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-2 bg-[#15803d] hover:bg-green-800 text-white rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer shadow-xs"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
