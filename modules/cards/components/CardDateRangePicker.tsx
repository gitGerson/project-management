'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Clock,
  Trash2,
} from 'lucide-react';
import type { CardDTO } from '../types';
import { updateCardAction } from '../actions';
import {
  parseDate,
  isSameDay,
  isBetween,
  isToday,
  formatCompactDate,
  formatDateRange,
  getDueDateStatus,
} from '../utils/date-utils';

interface CardDateRangePickerProps {
  card: CardDTO;
  canUpdate?: boolean;
  onCardUpdated?: (updatedCard: CardDTO) => void;
  variant?: 'property' | 'standalone';
}

export const CardDateRangePicker: React.FC<CardDateRangePickerProps> = ({
  card,
  canUpdate = true,
  onCardUpdated,
  variant = 'property',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Temporary picker state while open
  const [startDate, setStartDate] = useState<Date | null>(parseDate(card.startDate));
  const [dueDate, setDueDate] = useState<Date | null>(parseDate(card.dueDate));
  const [hasStartDate, setHasStartDate] = useState<boolean>(Boolean(card.startDate));
  const [hasDueDate, setHasDueDate] = useState<boolean>(Boolean(card.dueDate));
  const [activeTarget, setActiveTarget] = useState<'start' | 'due'>(
    card.startDate && !card.dueDate ? 'start' : 'due'
  );

  // Calendar month state
  const initialMonthDate = parseDate(card.dueDate) || parseDate(card.startDate) || new Date();
  const [currentYear, setCurrentYear] = useState<number>(initialMonthDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialMonthDate.getMonth());

  // Positioning
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove?: boolean } | null>(
    null
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync internal state when card changes
  useEffect(() => {
    setStartDate(parseDate(card.startDate));
    setDueDate(parseDate(card.dueDate));
    setHasStartDate(Boolean(card.startDate));
    setHasDueDate(Boolean(card.dueDate));
  }, [card.startDate, card.dueDate]);

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const estimatedHeight = 440;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popoverWidth - 16);
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    const top = placeAbove ? rect.top - 8 : rect.bottom + 6;
    setCoords({ top, left, placeAbove });
  }, []);

  const handleOpen = () => {
    const start = parseDate(card.startDate);
    const due = parseDate(card.dueDate);
    setStartDate(start);
    setDueDate(due);
    setHasStartDate(Boolean(start));
    setHasDueDate(Boolean(due));

    const baseDate = due || start || new Date();
    setCurrentYear(baseDate.getFullYear());
    setCurrentMonth(baseDate.getMonth());
    setActiveTarget(start && !due ? 'start' : 'due');

    updateCoords();
    setIsOpen(true);
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Day click handler
  const handleDayClick = (clickedDate: Date) => {
    if (activeTarget === 'start') {
      setStartDate(clickedDate);
      setHasStartDate(true);
      // If dueDate is before new startDate, push dueDate or clear it
      if (dueDate && clickedDate.getTime() > dueDate.getTime()) {
        setDueDate(clickedDate);
      }
      // Auto-switch to due date target for intuitive 2-click range picking
      if (hasDueDate) {
        setActiveTarget('due');
      }
    } else {
      setDueDate(clickedDate);
      setHasDueDate(true);
      // If startDate is after new dueDate, adjust startDate
      if (startDate && clickedDate.getTime() < startDate.getTime()) {
        setStartDate(clickedDate);
      }
    }
  };

  // Presets
  const applyPreset = (preset: 'today' | 'tomorrow' | 'this-week' | 'next-week') => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'today') {
      setStartDate(null);
      setHasStartDate(false);
      setDueDate(today);
      setHasDueDate(true);
      setCurrentYear(today.getFullYear());
      setCurrentMonth(today.getMonth());
    } else if (preset === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      setStartDate(null);
      setHasStartDate(false);
      setDueDate(tomorrow);
      setHasDueDate(true);
      setCurrentYear(tomorrow.getFullYear());
      setCurrentMonth(tomorrow.getMonth());
    } else if (preset === 'this-week') {
      // From today to Friday (or Sunday)
      const dayOfWeek = today.getDay(); // 0 is Sunday, 5 is Friday
      const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + 7 - dayOfWeek;
      const friday = new Date(today);
      friday.setDate(today.getDate() + daysUntilFriday);

      setStartDate(today);
      setHasStartDate(true);
      setDueDate(friday);
      setHasDueDate(true);
      setCurrentYear(friday.getFullYear());
      setCurrentMonth(friday.getMonth());
    } else if (preset === 'next-week') {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      setDueDate(nextWeek);
      setHasDueDate(true);
      setCurrentYear(nextWeek.getFullYear());
      setCurrentMonth(nextWeek.getMonth());
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!canUpdate) return;
    setIsSaving(true);
    try {
      const finalStart = hasStartDate && startDate ? startDate.toISOString() : null;
      const finalDue = hasDueDate && dueDate ? dueDate.toISOString() : null;

      const res = await updateCardAction(card.id, {
        startDate: finalStart,
        dueDate: finalDue,
      });

      if (res.success && res.data) {
        onCardUpdated?.(res.data);
        setIsOpen(false);
      } else {
        alert(res.message || 'Failed to update dates');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Remove / Clear handler
  const handleRemove = async () => {
    if (!canUpdate) return;
    setIsSaving(true);
    try {
      const res = await updateCardAction(card.id, {
        startDate: null,
        dueDate: null,
      });

      if (res.success && res.data) {
        setStartDate(null);
        setDueDate(null);
        setHasStartDate(false);
        setHasDueDate(false);
        onCardUpdated?.(res.data);
        setIsOpen(false);
      } else {
        alert(res.message || 'Failed to remove dates');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Generate calendar days
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Padding prev month
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDays.push({
      date: new Date(currentYear, currentMonth - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }
  // Days of current month
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarDays.push({
      date: new Date(currentYear, currentMonth, i),
      isCurrentMonth: true,
    });
  }
  // Padding next month to fill grid
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({
      date: new Date(currentYear, currentMonth + 1, i),
      isCurrentMonth: false,
    });
  }

  const hasAnyDate = Boolean(card.startDate || card.dueDate);
  const formattedRange = formatDateRange(card.startDate, card.dueDate);
  const dueStatus = getDueDateStatus(card.dueDate);

  const popoverElement =
    isOpen &&
    coords &&
    mounted &&
    createPortal(
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: coords.placeAbove ? 'auto' : `${coords.top}px`,
          bottom: coords.placeAbove
            ? `${window.innerHeight - coords.top}px`
            : 'auto',
          left: `${coords.left}px`,
        }}
        className="w-80 bg-white border border-gray-200/90 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 text-gray-800"
      >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-800">Card Dates</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-1 mb-3">
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className="py-1 px-1.5 text-[11px] font-semibold text-gray-600 hover:text-emerald-700 bg-gray-50 hover:bg-emerald-50 rounded-lg text-center transition-colors cursor-pointer border border-gray-200/60"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyPreset('tomorrow')}
                className="py-1 px-1.5 text-[11px] font-semibold text-gray-600 hover:text-emerald-700 bg-gray-50 hover:bg-emerald-50 rounded-lg text-center transition-colors cursor-pointer border border-gray-200/60"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => applyPreset('this-week')}
                className="py-1 px-1.5 text-[11px] font-semibold text-gray-600 hover:text-emerald-700 bg-gray-50 hover:bg-emerald-50 rounded-lg text-center transition-colors cursor-pointer border border-gray-200/60"
              >
                This week
              </button>
              <button
                type="button"
                onClick={() => applyPreset('next-week')}
                className="py-1 px-1.5 text-[11px] font-semibold text-gray-600 hover:text-emerald-700 bg-gray-50 hover:bg-emerald-50 rounded-lg text-center transition-colors cursor-pointer border border-gray-200/60"
              >
                +1 Week
              </button>
            </div>

            {/* Start Date & Due Date Controls */}
            <div className="space-y-2 mb-3 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
              {/* Start Date Row */}
              <div
                onClick={() => {
                  setHasStartDate(true);
                  setActiveTarget('start');
                }}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  activeTarget === 'start'
                    ? 'bg-white ring-1 ring-emerald-500 shadow-2xs'
                    : 'hover:bg-white/60'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={hasStartDate}
                    onChange={(e) => {
                      setHasStartDate(e.target.checked);
                      if (e.target.checked) {
                        setActiveTarget('start');
                        if (!startDate) setStartDate(new Date());
                      }
                    }}
                    className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Start date</span>
                </label>
                <span className="text-xs font-bold text-gray-800">
                  {hasStartDate && startDate ? formatCompactDate(startDate) : '-'}
                </span>
              </div>

              {/* Due Date Row */}
              <div
                onClick={() => {
                  setHasDueDate(true);
                  setActiveTarget('due');
                }}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  activeTarget === 'due'
                    ? 'bg-white ring-1 ring-emerald-500 shadow-2xs'
                    : 'hover:bg-white/60'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={hasDueDate}
                    onChange={(e) => {
                      setHasDueDate(e.target.checked);
                      if (e.target.checked) {
                        setActiveTarget('due');
                        if (!dueDate) setDueDate(new Date());
                      }
                    }}
                    className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Due date</span>
                </label>
                <span className="text-xs font-bold text-gray-800">
                  {hasDueDate && dueDate ? formatCompactDate(dueDate) : '-'}
                </span>
              </div>
            </div>

            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-gray-800">
                {monthNames[currentMonth]} {currentYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Day Labels */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {dayLabels.map((lbl, idx) => (
                <span key={idx} className="text-[10px] font-bold text-gray-400 py-0.5">
                  {lbl}
                </span>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center mb-4">
              {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                const isSelectedStart = hasStartDate && isSameDay(date, startDate);
                const isSelectedDue = hasDueDate && isSameDay(date, dueDate);
                const inRange =
                  hasStartDate &&
                  hasDueDate &&
                  startDate &&
                  dueDate &&
                  isBetween(date, startDate, dueDate);
                const isCurrentToday = isToday(date);

                let cellClass = 'relative h-8 w-full flex items-center justify-center text-xs transition-colors cursor-pointer select-none';

                if (!isCurrentMonth) {
                  cellClass += ' text-gray-300';
                } else {
                  cellClass += ' text-gray-700 hover:bg-gray-100';
                }

                if (inRange && !isSelectedStart && !isSelectedDue) {
                  cellClass += ' bg-emerald-50 text-emerald-950';
                }

                let buttonClass = 'w-7 h-7 flex items-center justify-center rounded-lg';
                if (isSelectedStart || isSelectedDue) {
                  buttonClass += ' bg-emerald-600 text-white font-bold shadow-xs';
                } else if (isCurrentToday) {
                  buttonClass += ' ring-1.5 ring-emerald-500 font-bold text-emerald-700';
                }

                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(date)}
                    className={cellClass}
                  >
                    <div className={buttonClass}>
                      {date.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
              {(card.startDate || card.dueDate) && canUpdate ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isSaving}
                  className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                {canUpdate && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || (!hasStartDate && !hasDueDate)}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSaving ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        );

  if (variant === 'property') {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white border border-gray-200/80 text-gray-600 flex items-center justify-center shrink-0 shadow-2xs">
          <CalendarIcon className="w-4 h-4 text-gray-600" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Dates
          </span>
          <div className="flex items-center gap-2">
            <button
              ref={buttonRef}
              type="button"
              onClick={handleOpen}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer truncate max-w-full ${
                hasAnyDate
                  ? 'bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 shadow-2xs'
                  : 'bg-white hover:bg-gray-100 border border-dashed border-gray-300 text-gray-500 hover:text-gray-700'
              }`}
              title={hasAnyDate ? 'Change dates' : 'Add dates'}
            >
              <span className="truncate">{hasAnyDate ? formattedRange : '+ Add dates'}</span>
              {hasAnyDate && dueStatus.label && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider border shrink-0 ${dueStatus.badgeClass}`}
                >
                  {dueStatus.label}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>

            {hasAnyDate && canUpdate && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isSaving}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Remove dates"
                aria-label="Remove dates"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {popoverElement}
      </div>
    );
  }

  return (
    <div className="mb-5">
      <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
        Dates
      </span>

      {/* Unified Trigger Field */}
      <div className="flex items-center gap-2">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
            hasAnyDate
              ? 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-800'
              : 'bg-white hover:bg-gray-50 border border-gray-200/90 text-gray-700'
          }`}
          title={hasAnyDate ? 'Change dates' : 'Add dates'}
        >
          <CalendarIcon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span>{hasAnyDate ? formattedRange : 'Add dates'}</span>

          {hasAnyDate && dueStatus.label && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] uppercase tracking-wider border ${dueStatus.badgeClass}`}
            >
              {dueStatus.label}
            </span>
          )}

          <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
        </button>

        {/* Quick clear button if dates exist and user can edit */}
        {hasAnyDate && canUpdate && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isSaving}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Remove dates"
            aria-label="Remove dates"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {popoverElement}
    </div>
  );
};

