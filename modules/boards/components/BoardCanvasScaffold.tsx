'use client';

import React from 'react';
import { Plus, Kanban, Layers, Sparkles } from 'lucide-react';
import type { BoardDTO } from '../types';

interface BoardCanvasScaffoldProps {
  board: BoardDTO;
  canEdit?: boolean;
}

export function BoardCanvasScaffold({ board, canEdit = false }: BoardCanvasScaffoldProps) {
  return (
    <div
      className="flex-1 w-full overflow-x-auto p-4 sm:p-6 flex items-start gap-4"
      aria-label={`Kanban canvas for ${board.name}`}
    >
      {/* Informative Scaffold Card / Placeholder Column */}
      <div className="w-[300px] sm:w-[320px] shrink-0 bg-white rounded-2xl border border-gray-200/90 shadow-xs p-4 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#15803d] flex items-center justify-center border border-emerald-100">
              <Kanban className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Board Workspace
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            Ready
          </span>
        </div>

        <div className="space-y-2.5 py-2">
          <div className="bg-gray-50/80 rounded-xl p-3 border border-dashed border-gray-200 text-center">
            <Layers className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-gray-700">
              Lists & Cards Canvas
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
              Halaman board ini siap diisi dengan List kolom dan Card task.
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="pt-2 mt-2 border-t border-gray-100">
            <button
              type="button"
              disabled
              className="w-full py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-400 text-xs font-semibold rounded-xl border border-gray-200 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
              title="Fitur penambahan List akan diimplementasikan pada tahap selanjutnya"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add List (Next Step)</span>
            </button>
          </div>
        )}
      </div>

      {/* Ghost Placeholder Column 2 */}
      <div className="w-[280px] shrink-0 rounded-2xl border-2 border-dashed border-gray-200/70 p-6 flex flex-col items-center justify-center text-center min-h-[160px] text-gray-400">
        <Sparkles className="w-5 h-5 text-gray-300 mb-2" />
        <p className="text-xs font-medium text-gray-500">Kanban Columns</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Drag & drop lists and cards will appear here
        </p>
      </div>
    </div>
  );
}
