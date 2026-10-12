'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldPlus, ShieldCheck, Loader2, AlertCircle, Check } from 'lucide-react';
import { createRoleAction, updateRoleAction } from '@/modules/rbac/actions';
import type { RoleDTO, PermissionDTO } from '@/modules/rbac/types';

const emptySubscribe = () => () => {};

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  role: RoleDTO | null; // null for Create, RoleDTO for Edit
  permissions: PermissionDTO[];
}

export function RoleModal({
  isOpen,
  onClose,
  onSuccess,
  role,
  permissions,
}: RoleModalProps) {
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isVisible, setIsVisible] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isClosingRef = useRef(false);
  const isEditMode = Boolean(role);

  // Sync form inputs when modal opens or role changes
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevRole, setPrevRole] = useState(role);

  if (isOpen !== prevIsOpen || role !== prevRole) {
    setPrevIsOpen(isOpen);
    setPrevRole(role);
    if (isOpen) {
      setErrorMessage(null);
      if (role) {
        setName(role.name);
        setDescription(role.description || '');
        setSelectedPermissionIds(role.permissions?.map((p) => p.id) || []);
      } else {
        setName('');
        setDescription('');
        setSelectedPermissionIds([]);
      }
    }
  }

  // Entrance and exit animation
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

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsVisible(false);
    setTimeout(() => {
      onClose();
      isClosingRef.current = false;
    }, 200);
  }, [onClose]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  const handleTogglePermission = (id: number) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedPermissionIds(permissions.map((p) => p.id));
  };

  const handleDeselectAll = () => {
    setSelectedPermissionIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMessage('Role name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditMode && role) {
        const res = await updateRoleAction(role.id, {
          name: trimmedName,
          description: description.trim() || undefined,
          permissionIds: selectedPermissionIds,
        });

        if (res.success) {
          onSuccess(`Role "${trimmedName}" updated successfully.`);
          handleDismiss();
        } else {
          setErrorMessage(res.message || 'Failed to update role.');
        }
      } else {
        const res = await createRoleAction({
          name: trimmedName,
          description: description.trim() || undefined,
          permissionIds: selectedPermissionIds,
        });

        if (res.success) {
          onSuccess(`New role "${trimmedName}" created successfully.`);
          handleDismiss();
        } else {
          setErrorMessage(res.message || 'Failed to create role.');
        }
      }
    } catch {
      setErrorMessage('An unexpected network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !isVisible) return null;
  if (!isMounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto transition-opacity duration-200 ease-in-out motion-reduce:transition-none ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-xs transition-opacity duration-200 ease-in-out motion-reduce:transition-none"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={`relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden z-10 flex flex-col max-h-[85vh] transition-all duration-200 ease-in-out motion-reduce:transition-none ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center flex-shrink-0 border border-green-100">
              {isEditMode ? (
                <ShieldCheck className="w-5 h-5 text-green-600" />
              ) : (
                <ShieldPlus className="w-5 h-5 text-green-600" />
              )}
            </div>
            <div>
              <h2
                id="role-modal-title"
                className="text-base sm:text-lg font-bold text-gray-900 tracking-tight"
              >
                {isEditMode ? `Edit Role: ${role?.name}` : 'Create New Role'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {isEditMode
                  ? 'Update the role name, description, and granted permissions.'
                  : 'Define a custom access role and assign permissions.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Feedback Banner */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-50 border-b border-red-100 text-red-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Role Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. project_manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Use lowercase alphanumeric characters, hyphens, or underscores.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="Brief summary of duties and responsibilities"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition"
            />
          </div>

          {/* Permissions Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">
                Grant Permissions ({selectedPermissionIds.length}/{permissions.length})
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-green-700 hover:text-green-800 font-medium cursor-pointer"
                >
                  Select all
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  Deselect all
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {permissions.map((p) => {
                const checked = selectedPermissionIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleTogglePermission(p.id)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition select-none ${
                      checked
                        ? 'bg-green-50/70 border-green-200 text-green-950 font-medium shadow-2xs'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50/80'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center flex-shrink-0 transition border ${
                        checked
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs leading-tight">{p.name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 leading-snug font-normal">
                        {p.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50/90 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-200/80 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#15803d] hover:bg-green-800 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEditMode ? 'Update Role' : 'Create Role'}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
