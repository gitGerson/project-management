'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const emptySubscribe = () => () => {};
import {
  X,
  Users,
  Shield,
  Search,
  RotateCw,
  Plus,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  ShieldCheck,
  Pencil,
} from 'lucide-react';
import { listUsersAction } from '@/modules/users/actions';
import { CustomSelect } from '@/components/ui/select';
import { RoleModal } from './RoleModal';
import {
  listRolesAction,
  listPermissionsAction,
  assignUserRolesAction,
  deleteRoleAction,
} from '@/modules/rbac/actions';
import type { UserListItemDTO } from '@/modules/users/types';
import type { RoleDTO, PermissionDTO } from '@/modules/rbac/types';

interface ManagementSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'users' | 'roles';
}

export function ManagementSettingsModal({
  isOpen,
  onClose,
  initialTab = 'users',
}: ManagementSettingsModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>(initialTab);
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Users state
  const [users, setUsers] = useState<UserListItemDTO[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  // Roles state
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [permissions, setPermissions] = useState<PermissionDTO[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // Role Modal state (New Role & Edit Role)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleToEdit, setRoleToEdit] = useState<RoleDTO | null>(null);

  // Feedback notifications
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3500);
  };

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await listUsersAction({ search: userSearch, limit: 100 });
      if (res.success && res.data) {
        setUsers(res.data.data);
      } else {
        showFeedback(res.message || 'Failed to load users', 'error');
      }
    } catch {
      showFeedback('Network error while loading users', 'error');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [userSearch]);

  // Fetch roles & permissions list
  const fetchRolesAndPermissions = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        listRolesAction(),
        listPermissionsAction(),
      ]);

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data);
      } else if (!rolesRes.success) {
        console.error('Failed to load roles:', rolesRes.message);
        showFeedback(rolesRes.message || 'Failed to load roles', 'error');
      }

      if (permsRes.success && permsRes.data) {
        setPermissions(permsRes.data);
      } else if (!permsRes.success) {
        console.error('Failed to load permissions:', permsRes.message);
      }
    } catch {
      showFeedback('Failed to load roles and permissions', 'error');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  // Sync animation strictly coordinated with isOpen
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

  // Fetch data asynchronously when modal opens or userSearch changes
  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    void Promise.resolve().then(() => {
      if (isSubscribed) {
        void fetchUsers();
        void fetchRolesAndPermissions();
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, fetchUsers, fetchRolesAndPermissions]);

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      isClosingRef.current = false;
    }, 200);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  // Direct Inline Role Assignment for User
  const handleRoleChange = async (userId: number, roleId: number) => {
    setUpdatingUserId(userId);
    try {
      const res = await assignUserRolesAction(userId, [roleId]);
      if (res.success && res.data) {
        // Update user's roles locally
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, roles: res.data || [] } : u))
        );
        showFeedback('Role updated successfully!');
      } else {
        showFeedback(res.message || 'Failed to update role', 'error');
      }
    } catch {
      showFeedback('Error updating role', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleOpenCreateRole = () => {
    setRoleToEdit(null);
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: RoleDTO) => {
    setRoleToEdit(role);
    setIsRoleModalOpen(true);
  };

  // Delete Role
  const handleDeleteRole = async (roleId: number, roleName: string) => {
    if (!window.confirm(`Are you sure you want to delete role "${roleName}"?`)) {
      return;
    }

    try {
      const res = await deleteRoleAction(roleId);
      if (res.success) {
        showFeedback(`Role "${roleName}" deleted.`);
        fetchRolesAndPermissions();
      } else {
        showFeedback(res.message || 'Cannot delete role', 'error');
      }
    } catch {
      showFeedback('Error deleting role', 'error');
    }
  };

  if (!isOpen && !isVisible) return null;
  if (!isMounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-opacity duration-200 ease-in-out motion-reduce:transition-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="management-settings-title"
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
        className={`relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl overflow-hidden z-10 flex flex-col max-h-[90vh] transition-all duration-200 ease-in-out motion-reduce:transition-none ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                id="management-settings-title"
                className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight"
              >
                System Settings & Access
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage user accounts, assigned roles, and access control permissions.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition cursor-pointer"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-6 border-b border-gray-100 -mb-3">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'users'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Users ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'roles'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Roles ({roles.length})</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 transition-all ${
              feedbackMessage.type === 'success'
                ? 'bg-green-50 text-green-800 border-b border-green-100'
                : 'bg-red-50 text-red-800 border-b border-red-100'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 flex-1">
          {activeTab === 'users' ? (
            /* TAB 1: USERS TABLE */
            <div className="space-y-4">
              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, username, or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchUsers}
                    disabled={isLoadingUsers}
                    className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Refresh user list"
                  >
                    <RotateCw
                      className={`w-3.5 h-3.5 text-gray-500 ${
                        isLoadingUsers ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Assigned Role (Direct)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {isLoadingUsers ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                              <span>Loading users...</span>
                            </div>
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                            No users found.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => {
                          const currentRole = roles.find((r) => u.roles.includes(r.name));
                          const currentRoleId = currentRole ? currentRole.id : 0;
                          const isUpdating = updatingUserId === u.id;

                          return (
                            <tr key={u.id} className="hover:bg-gray-50/60 transition">
                              {/* User Info */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {u.profilePicture ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={u.profilePicture}
                                      alt={u.name}
                                      className="w-9 h-9 rounded-full object-cover border border-gray-200 shadow-2xs flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-[#364574] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                      {u.name
                                        ? u.name
                                            .split(/\s+/)
                                            .map((p) => p[0])
                                            .slice(0, 2)
                                            .join('')
                                            .toUpperCase()
                                        : 'U'}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-semibold text-gray-900 truncate">
                                      {u.name || u.username}
                                    </div>
                                    <div className="text-[11px] text-gray-400 truncate">
                                      @{u.username}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Contact */}
                              <td className="px-4 py-3 text-gray-600">
                                <div>{u.email}</div>
                                {u.phone && (
                                  <div className="text-[11px] text-gray-400">{u.phone}</div>
                                )}
                              </td>

                              {/* Source / Domain */}
                              <td className="px-4 py-3">
                                {u.domain ? (
                                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                                    LDAP: {u.domain}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                    Local
                                  </span>
                                )}
                              </td>

                              {/* Direct Role Selection */}
                              <td className="px-4 py-3">
                                <div className="w-36 sm:w-44">
                                  <CustomSelect
                                    value={currentRoleId}
                                    disabled={isUpdating}
                                    isLoading={isUpdating}
                                    placeholder="Select a role..."
                                    options={roles.map((r) => ({
                                      value: r.id,
                                      label: r.name,
                                      description: r.description || undefined,
                                    }))}
                                    onChange={(newVal) =>
                                      handleRoleChange(u.id, Number(newVal))
                                    }
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: ROLES TABLE */
            <div className="space-y-5">
              {/* Header with Create Role Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Configured System Roles</h3>
                  <p className="text-xs text-gray-500">
                    Roles define permissions across boards and administrative modules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateRole}
                  className="px-3.5 py-2 bg-[#15803d] hover:bg-green-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Role</span>
                </button>
              </div>

              {/* Roles Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Permissions</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingRoles ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                            <span>Loading roles...</span>
                          </div>
                        </td>
                      </tr>
                    ) : roles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                          No roles found.
                        </td>
                      </tr>
                    ) : (
                      roles.map((r) => {
                        const isCoreRole = r.name === 'admin' || r.name === 'super_admin';
                        const permCount = r.permissions?.length || 0;

                        return (
                          <tr key={r.id} className="hover:bg-gray-50/60 transition">
                            {/* Role Name */}
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-800 border border-green-200/80 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-tight">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                                {r.name}
                              </span>
                            </td>

                            {/* Description */}
                            <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                              {r.description || 'No description provided'}
                            </td>

                            {/* Permissions Count */}
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-lg">
                                <Shield className="w-3 h-3 text-gray-400" />
                                <span>
                                  {permCount} {permCount === 1 ? 'permission' : 'permissions'}
                                </span>
                              </span>
                            </td>

                            {/* Actions (Icon buttons only) */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditRole(r)}
                                  className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition cursor-pointer"
                                  title={`Edit role "${r.name}"`}
                                  aria-label={`Edit role ${r.name}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                {!isCoreRole && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRole(r.id, r.name)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                    title={`Delete role "${r.name}"`}
                                    aria-label={`Delete role ${r.name}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          <div className="text-[11px] text-gray-500">
            {activeTab === 'users' ? (
              <span>Showing {users.length} registered system user(s)</span>
            ) : (
              <span>Showing {roles.length} system access role(s)</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Role Create / Edit Dedicated Modal */}
      <RoleModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSuccess={(msg) => {
          showFeedback(msg);
          fetchRolesAndPermissions();
        }}
        role={roleToEdit}
        permissions={permissions}
      />
    </div>,
    document.body
  );
}
