'use client';

import React from 'react';
import Image from 'next/image';
import type { CommentDTO } from '../types';
import { Clock, Check } from 'lucide-react';

interface ChatMessageItemProps {
  comment: CommentDTO;
  isMine: boolean;
  pending?: boolean;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  comment,
  isMine,
  pending = false,
}) => {
  const formattedTime = new Date(comment.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex w-full gap-2 mb-3 ${
        isMine ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isMine && (
        <div className="shrink-0 pt-1">
          {comment.author.profilePicture ? (
            <Image
              src={comment.author.profilePicture}
              alt={comment.author.name || 'User'}
              width={28}
              height={28}
              unoptimized
              className="w-7 h-7 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-[#15803d] font-semibold text-xs flex items-center justify-center border border-emerald-100">
              {comment.author.initials || 'U'}
            </div>
          )}
        </div>
      )}

      <div
        className={`max-w-[80%] flex flex-col ${
          isMine ? 'items-end' : 'items-start'
        }`}
      >
        {!isMine && (
          <span className="text-[11px] font-medium text-[#15803d] mb-0.5 ml-1">
            {comment.author.name || comment.author.username}
          </span>
        )}

        <div
          className={`relative px-3.5 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-sm ${
            isMine
              ? 'bg-[#15803d] text-white rounded-2xl rounded-tr-xs'
              : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-tl-xs'
          } ${pending ? 'opacity-70' : ''}`}
        >
          <div className="whitespace-pre-wrap break-words leading-relaxed text-[13.5px]">
            {comment.content}
          </div>

          <div
            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
              isMine ? 'text-emerald-100' : 'text-gray-400'
            }`}
          >
            <span>{formattedTime}</span>
            {isMine && (
              pending ? (
                <Clock className="w-3 h-3 text-emerald-200 animate-spin" />
              ) : (
                <Check className="w-3 h-3 text-emerald-200" />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
