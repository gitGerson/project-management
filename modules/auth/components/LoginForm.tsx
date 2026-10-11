'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { loginAction } from '@/modules/auth/actions';
import type { ActionResponse } from '@/modules/auth/types';
import './login.css';

const initialState: ActionResponse = {
  success: false,
};

const releaseNotes = [
  {
    version: '1.1.6',
    title: 'Version 1.1.6 - Current Release',
    description:
      'Versi 1.1.6 menambahkan multiple owner board, pin board personal, pin card global, filter card berdasarkan owner, archive/restore card, external link attachment, dan sectioned custom form. Release ini juga memperbarui flow deep-link card untuk guest, mark-read notification untuk reminder due card, PDF checklist submission, serta konfigurasi Redis untuk session, queue, dan cache. Perubahan database mencakup ownership board berbasis board_members, tabel board_pins, cards.pinned_at, field link attachment, dan struktur section pada custom form.',
    delay: '0s',
  },
  {
    version: '1.1.5',
    title: 'Version 1.1.5 - Notification & Modal Stability',
    description:
      'Versi 1.1.5 memperbaiki due notification agar card yang seluruh checklist-nya sudah selesai tidak lagi menerima reminder H-7, H-3, due today, maupun overdue. Release ini menambahkan pengecekan progress checklist pada proses notifikasi dan memperkuat test untuk milestone reminder, deduplikasi state, serta skip finished cards. Layout edit-card modal juga diperbaiki pada layar wide dengan tinggi pendek agar gap panel tetap stabil.',
    delay: '0.1s',
  },
  {
    version: '1.1.4',
    title: 'Version 1.1.4 - Show Card Checklist Detail Fix',
    description:
      'Versi 1.1.4 memperbaiki show-card modal agar deskripsi detail checklist tampil dengan benar. Area komentar pada modal juga dibuat tetap bisa discroll ketika konten panjang, sehingga diskusi card tidak mengganggu pembacaan detail checklist. Perbaikan ini menjaga layout modal tetap usable saat detail checklist dan komentar digunakan bersamaan.',
    delay: '0.2s',
  },
  {
    version: '1.1.3',
    title: 'Version 1.1.3 - Kanban Interaction Patch',
    description:
      'Versi 1.1.3 menambahkan drag-to-pan untuk scroll kanban board dan auto-scroll saat drag-and-drop card. Tombol add card dibuat tetap berada di bagian atas list, attachment pada deskripsi card disinkronkan dengan file embed dan clickable link, serta owner card dapat menambahkan attachment tanpa permission board edit penuh. Release ini juga memperbaiki opsi PIC quick edit group, akses owner board untuk mengelola list dan membuat card, serta konfigurasi CI deploy.',
    delay: '0.3s',
  },
  {
    version: '1.1.2',
    title: 'Version 1.1.2 - TreeView & Card Workflow Patch',
    description:
      'Versi 1.1.2 difokuskan pada penyempurnaan workflow board dan card setelah iterasi patch cepat di area TreeView, show-card modal, edit-card modal, dan project template builder. Peningkatan dilakukan pada navigasi TreeView, dark mode, picker behavior, owner dan member selection berbasis Select2, serta konsistensi tampilan group dan checklist agar selalu mengikuti list aktif.',
    delay: '0.4s',
  },
  {
    version: '1.1.1',
    title: 'Version 1.1.1 - Board & Card Workflow Release',
    description:
      'Versi 1.1.1 memperkuat board gallery, board edit modal, create/edit card flow, comment flow, attachment comment editor, dan integrasi realtime. Release ini juga membawa goal checklist automation, quick add group, quick edit group, contextual popover helper, status koneksi Carbonio Calendar, serta refresh README dan tutorial fitur Board Manager.',
    delay: '0.5s',
  },
  {
    version: '1.1.1 RC',
    title: 'Version 1.1.1-rc.4 - Release Candidate',
    description:
      'Release candidate 1.1.1 menambahkan UX role board member yang lebih seragam di create dan edit modal, view board modal dengan detail member, serta update email template dan CI. RC ini juga memperbaiki layout bubble komentar dan rendering list sebelum final release 1.1.1.',
    delay: '0.6s',
  },
  {
    version: '1.1.0 RC',
    title: 'Version 1.1.0-rc.1 - Board Manager Candidate',
    description:
      'Release candidate 1.1.0 menjadi fondasi besar modul Board Manager setelah baseline aplikasi, mencakup board, kanban list, card, checklist, approval, custom form, project template, label, comment, attachment, inbox, calendar sync, WhatsApp notification, TreeView, dan dynamic background.',
    delay: '0.7s',
  },
  {
    version: '1.0',
    title: 'Version 1.0.0 - Foundation Release',
    description:
      'Versi 1.0.0 merupakan tahap inisialisasi project dan penyediaan seluruh fitur dasar yang dibutuhkan sebagai fondasi aplikasi internal. Rilis ini mencakup autentikasi LDAP, manajemen user, role template, permission assignment, audit trail, dashboard berbasis Sneat, serta struktur awal modul operasional.',
    delay: '0.8s',
  },
];

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  return (
    <>
      {/* Animated Tea Parallax Background */}
      <div className="tea-parallax-bg" aria-hidden="true">
        <div className="parallax-layer">
          <div className="tea-leaves tea-leaf-1"></div>
          <div className="tea-leaves tea-leaf-2"></div>
          <div className="tea-leaves tea-leaf-3"></div>
        </div>
        <div className="parallax-layer">
          <div className="steam-effect steam-1"></div>
          <div className="steam-effect steam-2"></div>
          <div className="steam-effect steam-3"></div>
        </div>
      </div>

      <div className="min-h-screen flex flex-col md:flex-row relative z-10">
        {/* Left Section: Branding & Collapsible Release Notes */}
        <div className="w-full md:w-7/12 lg:w-2/3 min-h-screen flex items-center left-section p-6 md:p-12 lg:p-16">
          <div className="w-full max-w-2xl">
            <h1 className="tea-title mb-4">Tong Tji Board</h1>

            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                className="btn-release-notes"
                aria-expanded={showReleaseNotes}
              >
                Version Release Notes &amp; Updates
              </button>
            </div>

            {showReleaseNotes && (
              <div className="tea-features mt-4 space-y-2">
                {releaseNotes.map((note) => (
                  <div
                    key={note.version}
                    className="feature-item"
                    style={{ animationDelay: note.delay }}
                  >
                    <div className="feature-icon">{note.version}</div>
                    <div className="feature-content">
                      <h5>{note.title}</h5>
                      <p>{note.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Sign In Form */}
        <div className="w-full md:w-5/12 lg:w-1/3 min-h-screen flex items-center justify-center right-section p-6 sm:p-10 md:p-12">
          <div className="w-full max-w-sm">
            {/* Logos */}
            <div className="mb-3 text-center">
              <Image
                src="/assets/logo.png"
                alt="Tong Tji Logo"
                width={130}
                height={54}
                className="inline-block object-contain"
                priority
              />
            </div>

            <div className="mb-6 text-center">
              <Image
                src="/assets/board.png"
                alt="Board Logo"
                width={120}
                height={40}
                className="inline-block object-contain"
                priority
              />
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">
                Welcome Back!
              </h2>
              <p className="text-xs md:text-sm text-gray-500">
                Please sign-in with your LDAP account
              </p>
            </div>

            {/* Error Message */}
            {state?.message && !state.success && (
              <div className="mb-4 p-3 text-xs md:text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                {state.message}
              </div>
            )}

            {/* Form */}
            <form action={formAction} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs md:text-sm font-medium text-gray-700 mb-1"
                >
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter your username"
                  className="flat-input-white"
                />
                {state?.errors?.username && (
                  <p className="mt-1 text-xs text-red-600">{state.errors.username[0]}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs md:text-sm font-medium text-gray-700 mb-1"
                >
                  Password
                </label>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="flat-input-white pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 bottom-2 text-gray-400 hover:text-gray-600 cursor-pointer p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {state?.errors?.password && (
                  <p className="mt-1 text-xs text-red-600">{state.errors.password[0]}</p>
                )}
              </div>

              <div className="pt-1">
                <label
                  htmlFor="remember"
                  className="inline-flex items-center space-x-2 text-xs md:text-sm text-gray-500 cursor-pointer"
                >
                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-[#8bc34a] focus:ring-[#8bc34a]"
                  />
                  <span>Remember Me</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-flat-primary"
                >
                  {isPending ? 'Logging in...' : 'LOGIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
