'use client';

import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Download,
  Trash2,
  X,
  ExternalLink,
  Loader2,
  Expand,
  Shrink,
} from 'lucide-react';
import { uploadFileDirectly } from '@/lib/upload-client';
import { getFileTypeStyle, isImageFile } from '@/lib/file-type';
import { addCardAttachmentAction, deleteCardAttachmentAction } from '../actions';
import type { CardAttachmentDTO } from '../types';

interface CardAttachmentsSectionProps {
  cardId: number;
  attachments?: CardAttachmentDTO[];
  canUpdate?: boolean;
  onAttachmentAdded?: (attachment: CardAttachmentDTO) => void;
  onAttachmentDeleted?: (attachmentId: number) => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CardAttachmentsSection: React.FC<CardAttachmentsSectionProps> = ({
  cardId,
  attachments = [],
  canUpdate = true,
  onAttachmentAdded,
  onAttachmentDeleted,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STACK_THRESHOLD = 6;
  const hasOverflow = attachments.length > STACK_THRESHOLD;
  const shouldStack = hasOverflow && !isExpanded;

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || !canUpdate) return;

      setIsUploading(true);
      setUploadError(null);

      try {
        for (const file of files) {
          const res = await uploadFileDirectly(file, { folder: 'card-attachments' });
          const actionRes = await addCardAttachmentAction({
            cardId,
            fileName: res.fileName,
            fileUrl: res.publicUrl,
            fileSize: res.fileSize,
            fileType: res.contentType || file.type || 'application/octet-stream',
          });

          if (actionRes.success && actionRes.data) {
            onAttachmentAdded?.(actionRes.data);
          } else {
            throw new Error(actionRes.message || 'Failed to save attachment record');
          }
        }
      } catch (err) {
        const error = err as Error;
        setUploadError(error.message || 'Failed to upload attachments');
      } finally {
        setIsUploading(false);
      }
    },
    [cardId, canUpdate, onAttachmentAdded]
  );

  const handleDelete = useCallback(
    async (attachmentId: number) => {
      if (!canUpdate || deletingId) return;

      setDeletingId(attachmentId);
      try {
        const res = await deleteCardAttachmentAction(cardId, attachmentId);
        if (res.success) {
          onAttachmentDeleted?.(attachmentId);
        } else {
          setUploadError(res.message || 'Failed to delete attachment');
        }
      } catch (err) {
        const error = err as Error;
        setUploadError(error.message || 'Failed to delete attachment');
      } finally {
        setDeletingId(null);
      }
    },
    [cardId, canUpdate, deletingId, onAttachmentDeleted]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canUpdate) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleUploadFiles(Array.from(files));
    }
  };

  return (
    <div
      className="flex flex-col mt-6"
      onDragOver={(e) => {
        e.preventDefault();
        if (canUpdate) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Header Bar */}
      <div className="flex items-center gap-2 mb-3 select-none">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Attachments
        </span>
        <span className="px-1.5 py-0.2 rounded-full bg-slate-400 text-white text-[11px] font-bold min-w-5 h-4.5 flex items-center justify-center">
          {attachments.length}
        </span>

        {/* Expand / Shrink toggle button (matching CardMemberPicker / CardLabelPicker) */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-0.5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer rounded focus:outline-none flex items-center gap-1 group ml-0.5"
            title={isExpanded ? 'Shrink attachments' : 'Expand attachments'}
            aria-label={isExpanded ? 'Shrink attachments' : 'Expand attachments'}
          >
            {isExpanded ? (
              <Shrink className="w-3.5 h-3.5 text-emerald-600 group-hover:text-emerald-700 transition-transform duration-200" />
            ) : (
              <Expand className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-transform duration-200" />
            )}
          </button>
        )}
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center justify-between">
          <span className="truncate">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-red-500 hover:text-red-700 p-0.5 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stacked Row View when count > 6 and collapsed */}
      {shouldStack ? (
        <div
          className={`flex items-center transition-all duration-300 rounded-2xl p-1 overflow-x-auto scrollbar-none py-1.5 ${
            isDragging ? 'bg-emerald-50/50 ring-2 ring-emerald-500/30' : ''
          }`}
        >
          {attachments.slice(0, STACK_THRESHOLD).map((att, idx) => {
            const isImg = isImageFile(att.fileName, att.fileType);
            const style = getFileTypeStyle(att.fileName, att.fileType);

            return (
              <div
                key={att.id}
                style={{ zIndex: STACK_THRESHOLD - idx }}
                className="relative group/stack select-none shrink-0 transition-all duration-300 -mr-4 sm:-mr-5 hover:-mr-1 hover:!z-30 hover:scale-105 hover:-translate-y-1"
              >
                {/* Thumbnail Card */}
                <div
                  onClick={() => {
                    if (isImg) {
                      setLightboxImage({ src: att.fileUrl, alt: att.fileName });
                    } else {
                      window.open(att.fileUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className={`w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl border ${
                    isImg
                      ? 'border-slate-200/90 bg-slate-50/95'
                      : `${style.borderClass} ${style.bgClass}`
                  } ring-2 ring-white overflow-hidden relative cursor-pointer shadow-2xs hover:shadow-md transition-all flex flex-col items-center justify-center p-1`}
                  title={`${att.fileName} (${formatFileSize(att.fileSize)})`}
                >
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center py-0.5">
                      {style.renderIcon('w-6 h-6 sm:w-6.5 sm:h-6.5 stroke-[1.6] shrink-0')}
                      <span
                        className={`mt-1 px-1 py-0.2 rounded text-[7.5px] sm:text-[8px] font-extrabold tracking-wide uppercase border leading-none ${style.badgeClass}`}
                      >
                        {style.label}
                      </span>
                    </div>
                  )}

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/stack:opacity-100 transition-opacity rounded-2xl flex items-start justify-end p-1 gap-1">
                    <a
                      href={att.fileUrl}
                      download={att.fileName}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-md bg-white/90 hover:bg-white text-gray-700 hover:text-gray-900 transition-colors shadow-2xs"
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                    {canUpdate && (
                      <button
                        type="button"
                        disabled={deletingId === att.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(att.id);
                        }}
                        className="p-1 rounded-md bg-white/90 hover:bg-red-600 text-gray-700 hover:text-white transition-colors shadow-2xs cursor-pointer"
                        title="Delete"
                      >
                        {deletingId === att.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Overflow Counter Badge (+N more - Click to expand) */}
          <div
            onClick={() => setIsExpanded(true)}
            style={{ zIndex: 1 }}
            className="w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200/90 ring-2 ring-white text-slate-700 font-bold text-xs sm:text-sm flex flex-col items-center justify-center shadow-2xs hover:shadow-md cursor-pointer transition-all duration-200 hover:scale-105 hover:z-30 select-none ml-1"
            title={`${attachments.length - STACK_THRESHOLD} more attachments - Click to expand`}
          >
            <span>+{attachments.length - STACK_THRESHOLD}</span>
            <span className="text-[9px] text-slate-400 font-medium">more</span>
          </div>

          {/* Add Item Card in Stacked Mode */}
          {canUpdate && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-100 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all shadow-2xs hover:shadow-xs group hover:border-slate-400 ml-4 select-none"
              title="Add attachment"
            >
              <Plus className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
                Add Item
              </span>
            </div>
          )}

          {/* Uploading Placeholder in Stacked Mode */}
          {isUploading && (
            <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0 rounded-2xl border-2 border-dashed border-emerald-400/80 bg-emerald-50/40 flex flex-col items-center justify-center gap-1 select-none animate-pulse ml-2">
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              <span className="text-[9px] font-semibold text-emerald-700">Uploading</span>
            </div>
          )}
        </div>
      ) : (
        /* Regular / Expanded Multi-row Grid View */
        <div
          className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-3 transition-all duration-300 rounded-2xl p-1 animate-in fade-in duration-200 ${
            isDragging ? 'bg-emerald-50/50 ring-2 ring-emerald-500/30' : ''
          }`}
        >
          {attachments.map((att) => {
            const isImg = isImageFile(att.fileName, att.fileType);
            const style = getFileTypeStyle(att.fileName, att.fileType);

            return (
              <div key={att.id} className="flex flex-col w-full group/card select-none">
                {/* Thumbnail Box */}
                <div
                  onClick={() => {
                    if (isImg) {
                      setLightboxImage({ src: att.fileUrl, alt: att.fileName });
                    } else {
                      window.open(att.fileUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className={`aspect-square w-full rounded-2xl border ${
                    isImg
                      ? 'border-slate-200/90 bg-slate-50/70 hover:bg-slate-100/90'
                      : `${style.borderClass} ${style.bgClass}`
                  } overflow-hidden relative cursor-pointer shadow-2xs hover:shadow-md transition-all flex flex-col items-center justify-center p-1.5`}
                  title={att.fileName}
                >
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center py-1">
                      {style.renderIcon('w-8 h-8 sm:w-9 sm:h-9 stroke-[1.6] shrink-0')}
                      <span
                        className={`mt-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase border leading-none shadow-2xs ${style.badgeClass}`}
                      >
                        {style.label}
                      </span>
                    </div>
                  )}

                  {/* Hover overlay actions */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity rounded-2xl flex items-start justify-end p-1.5 gap-1">
                    <a
                      href={att.fileUrl}
                      download={att.fileName}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-lg bg-white/90 hover:bg-white text-gray-700 hover:text-gray-900 transition-colors shadow-2xs"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    {canUpdate && (
                      <button
                        type="button"
                        disabled={deletingId === att.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(att.id);
                        }}
                        className="p-1 rounded-lg bg-white/90 hover:bg-red-600 text-gray-700 hover:text-white transition-colors shadow-2xs cursor-pointer"
                        title="Delete attachment"
                      >
                        {deletingId === att.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Size under Card */}
                <div className="mt-1.5 px-0.5 min-w-0">
                  <span
                    className="text-xs font-medium text-slate-700 truncate block leading-tight hover:text-slate-900"
                    title={att.fileName}
                  >
                    {att.fileName}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[8.5px] font-bold uppercase px-1 py-0.2 rounded border leading-none shrink-0 ${style.badgeClass}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal truncate block leading-tight">
                      {formatFileSize(att.fileSize)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Uploading Placeholder Card */}
          {isUploading && (
            <div className="flex flex-col w-full select-none animate-pulse">
              <div className="aspect-square w-full rounded-2xl border-2 border-dashed border-emerald-400/80 bg-emerald-50/40 flex flex-col items-center justify-center gap-1.5">
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                <span className="text-[10px] font-semibold text-emerald-700">Uploading...</span>
              </div>
            </div>
          )}

          {/* Add Item Card */}
          {canUpdate && (
            <div className="flex flex-col w-full select-none">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square w-full rounded-2xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-100 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs hover:shadow-xs group hover:border-slate-300"
                title="Add attachment"
              >
                <Plus className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
                  Add Item
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden Multi-File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            handleUploadFiles(Array.from(files));
          }
          e.target.value = '';
        }}
      />

      {/* Image Lightbox Preview Modal */}
      {lightboxImage &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
            onClick={() => setLightboxImage(null)}
          >
            <div
              className="relative max-w-5xl max-h-[92vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute -top-11 right-0 p-1.5 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                title="Close preview (Esc)"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Enlarged image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt || 'Enlarged image preview'}
                className="max-h-[80vh] max-w-[92vw] sm:max-w-4xl rounded-xl object-contain shadow-2xl bg-black/20"
              />

              {/* Action buttons */}
              <div className="mt-3 flex items-center gap-2.5">
                <a
                  href={lightboxImage.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="px-3 py-1.5 bg-white text-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-100 flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download image</span>
                </a>
                <a
                  href={lightboxImage.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors backdrop-blur-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open original</span>
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
