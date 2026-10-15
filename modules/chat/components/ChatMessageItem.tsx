'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { CommentDTO, MentionUserDTO } from '../types';
import { formatFileSize, formatCommentHtml } from '../utils/comment-parser';
import { getFileTypeStyle } from '@/lib/file-type';
import {
  CornerDownRight,
  Download,
  Clock,
  X,
  ExternalLink,
} from 'lucide-react';

interface ChatMessageItemProps {
  comment: CommentDTO;
  isMine?: boolean;
  pending?: boolean;
  showAvatar?: boolean;
  showAuthorName?: boolean;
  isCompact?: boolean;
  onReply?: (comment: CommentDTO) => void;
  mentionCandidates?: MentionUserDTO[];
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  comment,
  isMine = false,
  pending = false,
  onReply,
  mentionCandidates,
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const formattedDate = (() => {
    try {
      const d = new Date(comment.createdAt);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  })();

  const isEdited =
    Boolean(comment.updatedAt && comment.createdAt) &&
    Math.abs(new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime()) > 60 * 1000;

  const imageAttachments = (comment.attachments || []).filter((a) => a.isImage);
  const fileAttachments = (comment.attachments || []).filter((a) => !a.isImage);

  return (
    <div className={`w-full flex flex-col mb-2.5 ${isMine ? 'items-end' : 'items-start'}`}>
      {/* Comment Card (Compact Feed Style - Right for POV 1, Left for others) */}
      <div
        className={`w-fit max-w-[85%] sm:max-w-[78%] rounded-xl border px-3 py-2 sm:px-3.5 sm:py-2.5 transition-all shadow-2xs ${
          isMine
            ? 'bg-emerald-50/70 border-emerald-200/90 rounded-tr-xs text-gray-800'
            : 'bg-white border-gray-100 rounded-tl-xs text-gray-800'
        } ${pending ? 'opacity-70 border-dashed' : ''}`}
      >
        {/* Author Header */}
        <div className="flex items-center gap-2 mb-1.5">
          {/* Avatar */}
          {comment.author.profilePicture ? (
            <Image
              src={comment.author.profilePicture}
              alt={comment.author.name || 'User'}
              width={26}
              height={26}
              unoptimized
              className="w-6.5 h-6.5 rounded-full object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <div
              className={`w-6.5 h-6.5 rounded-full font-bold text-[10px] flex items-center justify-center shrink-0 uppercase border ${
                isMine
                  ? 'bg-[#15803d] text-white border-emerald-700'
                  : 'bg-emerald-100/70 text-[#15803d] border-emerald-200/60'
              }`}
            >
              {comment.author.initials || comment.author.name?.substring(0, 2).toUpperCase() || 'U'}
            </div>
          )}

          {/* Author Name and Timestamp */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-[11px] text-gray-900 uppercase tracking-tight truncate">
                {isMine ? (comment.author.name || 'Anda') : (comment.author.name || comment.author.username)}
              </h4>
              {isMine && (
                <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100/70 px-1 py-0.2 rounded">
                  Anda
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.2">
              <span>{formattedDate}</span>
              {isEdited && <span>· Diedit</span>}
              {pending && (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <Clock className="w-2.5 h-2.5 animate-spin" /> Mengirim...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reply Box inside Card */}
        {comment.replyTo && (
          <div
            className={`mb-2 px-2.5 py-1.5 rounded-lg border-l-2 border-[#65a30d] text-left select-none ${
              isMine ? 'bg-white/85 shadow-2xs' : 'bg-gray-50/90'
            }`}
          >
            <p className="text-[10.5px] font-bold text-[#65a30d] uppercase mb-0.5 tracking-tight truncate">
              Membalas {comment.replyTo.authorName}
            </p>
            {comment.replyTo.snippet && (
              <p className="text-[10.5px] text-gray-500 truncate max-w-[220px]">
                {comment.replyTo.snippet}
              </p>
            )}
          </div>
        )}

        {/* Image Attachments */}
        {imageAttachments.length > 0 && (
          <div className="space-y-1.5 mb-2.5">
            {imageAttachments.map((img, i) => (
              <div
                key={i}
                onClick={() => setPreviewImage(img.url)}
                className="group/img relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 max-h-36 max-w-[200px] sm:max-h-40 sm:max-w-[220px] w-fit cursor-pointer transition-all hover:opacity-95 shadow-2xs hover:shadow-xs"
                title="Klik untuk melihat gambar penuh"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.fileName || 'Attachment'}
                  className="max-h-36 max-w-[200px] sm:max-h-40 sm:max-w-[220px] w-auto h-auto object-contain rounded-xl"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-white/90 text-gray-800 text-[11px] px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 font-medium">
                    <ExternalLink className="w-3 h-3" /> Preview
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Document / File Attachments */}
        {fileAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {fileAttachments.map((file, i) => {
              const style = getFileTypeStyle(file.fileName);
              return (
                <a
                  key={i}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={file.fileName}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all max-w-full border ${style.bgClass} ${style.borderClass} text-gray-800 shadow-2xs hover:shadow-xs`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${style.badgeClass}`}>
                    {style.renderIcon('w-3.5 h-3.5 stroke-[1.8]')}
                  </div>
                  <div className="min-w-0 pr-1">
                    <p className="font-medium text-xs truncate max-w-[180px]">
                      {file.fileName}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-[7.5px] font-bold uppercase px-1 py-0.2 rounded border leading-none ${style.badgeClass}`}>
                        {style.label}
                      </span>
                      {file.fileSize ? (
                        <span className="text-[9.5px] text-gray-400">
                          {formatFileSize(file.fileSize)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Download className="w-3.5 h-3.5 shrink-0 text-gray-400 hover:text-gray-600 transition-colors" />
                </a>
              );
            })}
          </div>
        )}

        {/* Comment Content */}
        {comment.content && (
          <div
            className="text-xs sm:text-[12.5px] text-gray-800 leading-relaxed break-words [&_strong]:font-bold [&_strong]:text-gray-900 [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm [&_code]:font-mono [&_code]:text-emerald-700 [&_a]:text-[#15803d] [&_a]:underline [&_img]:max-h-36 [&_img]:max-w-[200px] sm:[&_img]:max-h-40 sm:[&_img]:max-w-[220px] [&_img]:rounded-lg [&_img]:object-contain [&_img]:my-1.5 [&_img]:cursor-pointer [&_img]:border [&_img]:border-gray-200"
            dangerouslySetInnerHTML={{
              __html: formatCommentHtml(comment.content, isMine, mentionCandidates),
            }}
          />
        )}
      </div>

      {/* ↳ Balas button outside under the card */}
      {onReply && !pending && (
        <button
          type="button"
          onClick={() => onReply(comment)}
          className={`flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#15803d] font-medium mt-0.5 w-fit transition-colors cursor-pointer select-none ${
            isMine ? 'mr-1.5 self-end' : 'ml-1.5 self-start'
          }`}
        >
          <CornerDownRight className="w-3 h-3" />
          <span>Balas</span>
        </button>
      )}

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Enlarged preview"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={previewImage}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="px-3 py-1.5 bg-white text-gray-800 text-xs font-medium rounded-lg hover:bg-gray-100 flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Unduh Gambar Asli
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
