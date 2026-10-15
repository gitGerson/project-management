'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import type {
  CommentAttachmentDTO,
  CommentReplyDTO,
  MentionUserDTO,
} from '../types';
import { formatFileSize } from '../utils/comment-parser';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link2,
  Image as ImageIcon,
  Paperclip,
  SendHorizontal,
  X,
  FileText,
  Loader2,
  CornerDownRight,
} from 'lucide-react';

const CustomMention = Mention.extend({
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { 'data-id': attributes.id };
        },
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) return {};
          return { 'data-label': attributes.label };
        },
      },
      username: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-username'),
        renderHTML: (attributes) => {
          if (!attributes.username) return {};
          return { 'data-username': attributes.username };
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [];
  },
}).configure({
  HTMLAttributes: {
    class:
      'inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-[11.5px] font-semibold bg-emerald-50 text-[#15803d] border border-emerald-200/90 align-baseline select-none shadow-2xs',
  },
  renderHTML({ options, node }) {
    const label = node.attrs.label || node.attrs.username || node.attrs.id || '';
    return [
      'span',
      {
        'data-type': 'mention',
        'data-id': String(node.attrs.id || ''),
        'data-label': String(label),
        'data-username': String(node.attrs.username || ''),
        class: options.HTMLAttributes.class,
      },
      `@${label}`,
    ];
  },
  renderText({ node }) {
    return `@${node.attrs.label || node.attrs.username || node.attrs.id}`;
  },
});

interface ChatInputProps {
  onSendMessage: (payload: {
    content: string;
    replyTo?: CommentReplyDTO | null;
    attachments?: CommentAttachmentDTO[];
  }) => Promise<boolean | void>;
  replyingTo?: CommentReplyDTO | null;
  onCancelReply?: () => void;
  mentionCandidates?: MentionUserDTO[];
  placeholder?: string;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  replyingTo,
  onCancelReply,
  mentionCandidates = [],
  placeholder = 'Ketik pesan...',
  disabled = false,
}) => {
  const [attachments, setAttachments] = useState<CommentAttachmentDTO[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload file helper
  const uploadFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert(`Ukuran file "${file.name}" melebihi batas maksimal 10 MB.`);
      return;
    }

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setUploadingFiles((prev) => [...prev, { id: uploadId, name: file.name }]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to upload file');
      }

      const uploaded = json.data as {
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        isImage: boolean;
      };

      setAttachments((prev) => [
        ...prev,
        {
          url: uploaded.url,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
          isImage: uploaded.isImage,
        },
      ]);
    } catch (err: unknown) {
      console.error('File upload error:', err);
      const msg = err instanceof Error ? err.message : 'Upload failed';
      alert(`Gagal mengunggah ${file.name}: ${msg}`);
    } finally {
      setUploadingFiles((prev) => prev.filter((item) => item.id !== uploadId));
    }
  };

  // TipTap Editor instance
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        heading: false,
        codeBlock: false,
        blockquote: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      CustomMention,
    ],
    editorProps: {
      attributes: {
        class:
          'tiptap prose prose-sm max-w-none focus:outline-none min-h-[42px] max-h-[160px] overflow-y-auto px-1 py-1 text-sm text-gray-800 leading-relaxed scrollbar-thin',
      },
      handleDOMEvents: {
        paste: (_view, event) => {
          const items = event.clipboardData?.items;
          if (!items) return false;

          let handled = false;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                event.preventDefault();
                handled = true;
                const namedFile =
                  file.name === 'image.png' || !file.name
                    ? new File([file], `screenshot_${Date.now()}.png`, { type: file.type })
                    : file;
                uploadFile(namedFile);
              }
            }
          }
          return handled;
        },
        keydown: (_view, event) => {
          const { query, candidates, index, selectMention } = mentionStateRef.current;

          // When mention autocomplete popup is open with candidates
          if (query !== null && candidates.length > 0) {
            // Tab or Enter: Apply the selected mention candidate
            if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
              event.preventDefault();
              event.stopPropagation();
              const chosen = candidates[index] || candidates[0];
              if (chosen) {
                selectMention(chosen);
              }
              return true;
            }

            // ArrowDown: navigate to next candidate
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.stopPropagation();
              setMentionIndex((prev) => (prev + 1) % candidates.length);
              return true;
            }

            // ArrowUp: navigate to previous candidate
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              event.stopPropagation();
              setMentionIndex((prev) => (prev - 1 + candidates.length) % candidates.length);
              return true;
            }

            // Escape: close mention popup
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setMentionQuery(null);
              return true;
            }
          }

          // If Enter pressed without Shift: submit
          if (event.key === 'Enter' && !event.shiftKey) {
            if (query !== null) {
              return false;
            }
            event.preventDefault();
            handleSendRef.current();
            return true;
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Check for @mention trigger
      const { state } = ed;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 20), from, '\n', '\0');
      const match = textBefore.match(/@([a-zA-Z0-9_.-]*)$/);

      if (match) {
        setMentionQuery(match[1].toLowerCase());
        setMentionIndex(0);
      } else {
        setMentionQuery(null);
      }
    },
  });

  // Handle selecting a mention candidate
  const handleSelectMention = (user: MentionUserDTO) => {
    if (!editor) return;

    const { state } = editor;
    const { from } = state.selection;
    const textBefore = state.doc.textBetween(Math.max(0, from - 20), from, '\n', '\0');
    const match = textBefore.match(/@([a-zA-Z0-9_.-]*)$/);

    const displayName = user.name || user.username;

    if (match) {
      const matchLength = match[0].length;
      editor
        .chain()
        .focus()
        .deleteRange({ from: from - matchLength, to: from })
        .insertContent([
          {
            type: 'mention',
            attrs: {
              id: String(user.id),
              label: displayName,
              username: user.username,
            },
          },
          {
            type: 'text',
            text: ' ',
          },
        ])
        .run();
    }

    setMentionQuery(null);
  };

  const filteredCandidates =
    mentionQuery !== null
      ? mentionCandidates
          .filter((u) => {
            const query = mentionQuery.toLowerCase();
            return (
              u.username.toLowerCase().includes(query) ||
              u.name.toLowerCase().includes(query)
            );
          })
          .slice(0, 6)
      : [];

  // Keep state ref in sync for keydown handler closures
  const mentionStateRef = useRef({
    query: mentionQuery,
    candidates: filteredCandidates,
    index: mentionIndex,
    selectMention: handleSelectMention,
  });
  mentionStateRef.current = {
    query: mentionQuery,
    candidates: filteredCandidates,
    index: mentionIndex,
    selectMention: handleSelectMention,
  };

  // Adjust mentionIndex if filtered candidates count decreases
  useEffect(() => {
    if (mentionIndex >= filteredCandidates.length && filteredCandidates.length > 0) {
      setMentionIndex(0);
    }
  }, [filteredCandidates.length, mentionIndex]);

  // Focus editor when replyingTo changes
  useEffect(() => {
    if (replyingTo && editor) {
      editor.commands.focus('end');
    }
  }, [replyingTo, editor]);

  const handleSendRef = useRef<() => void>(() => {});

  const handleSend = async () => {
    if (!editor || isSubmitting || disabled || uploadingFiles.length > 0) return;

    // Get plain text and HTML
    const plainText = editor.getText().trim();
    const hasAttachments = attachments.length > 0;

    if (!plainText && !hasAttachments) return;

    // Use HTML if styled, or fallback to plain text
    const html = editor.getHTML();
    // Normalize empty paragraph
    const content = plainText ? (html === '<p></p>' ? '' : html) : '';

    setIsSubmitting(true);
    try {
      await onSendMessage({
        content,
        replyTo: replyingTo || null,
        attachments: hasAttachments ? attachments : undefined,
      });

      editor.commands.clearContent();
      setAttachments([]);
      if (onCancelReply) onCancelReply();
    } finally {
      setIsSubmitting(false);
    }
  };
  handleSendRef.current = handleSend;

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const isEditorEmpty = !editor || editor.isEmpty;
  const canSubmit =
    (!isEditorEmpty || attachments.length > 0) &&
    !isSubmitting &&
    !disabled &&
    uploadingFiles.length === 0;

  return (
    <div className="p-3 bg-[#f8fafc] border-t border-gray-100 flex flex-col gap-1.5 shrink-0">
      {/* Mention Autocomplete Dropdown */}
      {mentionQuery !== null && filteredCandidates.length > 0 && (
        <div className="relative z-30">
          <div className="absolute bottom-2 left-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 max-h-56 overflow-y-auto scrollbar-thin">
            <div className="px-3.5 py-1.5 flex items-center justify-between border-b border-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              <span>Mention Member</span>
              <span className="text-[9px] font-medium lowercase bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                tekan tab ⇥
              </span>
            </div>
            {filteredCandidates.map((user, i) => (
              <button
                key={user.id}
                type="button"
                onMouseEnter={() => setMentionIndex(i)}
                onClick={() => handleSelectMention(user)}
                className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                  i === mentionIndex
                    ? 'bg-emerald-50 text-[#15803d]'
                    : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.profilePicture ? (
                    <Image
                      src={user.profilePicture}
                      alt={user.name}
                      width={24}
                      height={24}
                      unoptimized
                      className="w-6 h-6 rounded-full object-cover border border-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#15803d] font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
                      {user.initials || 'U'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate leading-tight">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
                {i === mentionIndex && (
                  <span className="text-[10px] font-semibold bg-emerald-100/90 text-emerald-800 px-1.5 py-0.5 rounded text-xs shrink-0 shadow-2xs">
                    Tab ↵
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quoted Reply Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100/80 border border-gray-200/80 rounded-xl text-xs text-gray-600 animate-fadeIn">
          <div className="flex items-center gap-1.5 min-w-0 pr-2">
            <CornerDownRight className="w-3.5 h-3.5 text-[#15803d] shrink-0" />
            <span className="text-[10.5px] text-gray-400 whitespace-nowrap">
              Membalas <strong className="text-gray-700 font-semibold">@{replyingTo.authorName}</strong>:
            </span>
            <span className="text-[11px] text-gray-500 truncate italic">
              &ldquo;{replyingTo.snippet}&rdquo;
            </span>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-full transition-colors shrink-0 cursor-pointer"
              title="Batalkan balasan"
              aria-label="Batalkan balasan"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Modern Floating Bubble Input Card */}
      <div className="relative bg-white rounded-2xl border border-gray-200/90 shadow-2xs focus-within:border-emerald-600/40 focus-within:ring-1 focus-within:ring-emerald-600/20 transition-all overflow-hidden flex flex-col p-2.5">
        {/* TipTap Floating Bubble Menu (appears upon text selection) */}
        {editor && (
          <BubbleMenu
            editor={editor}
            className="flex items-center gap-0.5 bg-gray-900/95 text-white backdrop-blur-md rounded-2xl px-1.5 py-1 shadow-2xl border border-gray-800 text-xs z-50 animate-fadeIn"
          >
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer ${
                editor.isActive('bold') ? 'bg-white/25 text-emerald-400 font-bold' : 'text-gray-200'
              }`}
              title="Tebal (Bold)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer ${
                editor.isActive('italic') ? 'bg-white/25 text-emerald-400 font-bold' : 'text-gray-200'
              }`}
              title="Miring (Italic)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer ${
                editor.isActive('underline') ? 'bg-white/25 text-emerald-400 font-bold' : 'text-gray-200'
              }`}
              title="Garis Bawah (Underline)"
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer ${
                editor.isActive('strike') ? 'bg-white/25 text-emerald-400 font-bold' : 'text-gray-200'
              }`}
              title="Coret (Strikethrough)"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer ${
                editor.isActive('code') ? 'bg-white/25 text-emerald-400 font-bold' : 'text-gray-200'
              }`}
              title="Kode (Inline Code)"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const prev = editor.getAttributes('link').href;
                const url = window.prompt('Masukkan tautan URL:', prev || 'https://');
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                } else if (url === '') {
                  editor.chain().focus().unsetLink().run();
                }
              }}
              className={`p-1.5 rounded-lg hover:bg-white/20 transition-colors cursor-pointer ${
                editor.isActive('link') ? 'bg-white/25 text-emerald-400 font-bold' : 'text-gray-200'
              }`}
              title="Tautan (Link)"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
          </BubbleMenu>
        )}

        {/* Draft Attachments Preview Chips */}
        {(attachments.length > 0 || uploadingFiles.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-gray-100">
            {uploadingFiles.map((up) => (
              <div
                key={up.id}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50/60 border border-dashed border-emerald-300 rounded-xl text-xs text-emerald-700 animate-pulse"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="truncate max-w-[130px]">{up.name}</span>
              </div>
            ))}

            {attachments.map((att, i) => (
              <div
                key={i}
                className="relative group/chip flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 shadow-2xs"
              >
                {att.isImage ? (
                  <Image
                    src={att.url}
                    alt={att.fileName}
                    width={20}
                    height={20}
                    unoptimized
                    className="w-5 h-5 rounded-xs object-cover"
                  />
                ) : (
                  <FileText className="w-4 h-4 text-emerald-600" />
                )}
                <span className="truncate max-w-[120px] font-medium">
                  {att.fileName}
                </span>
                {att.fileSize ? (
                  <span className="text-[10px] text-gray-400">
                    {formatFileSize(att.fileSize)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="p-0.5 text-gray-400 hover:text-red-500 rounded-full cursor-pointer ml-1"
                  title="Hapus lampiran"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TipTap Editor Content */}
        <div className="min-h-[42px] px-1 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:text-gray-400 [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none">
          <EditorContent editor={editor} />
        </div>

        {/* Bottom Toolbar & Send Button Row */}
        <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-gray-50">
          <div className="flex items-center gap-1 text-gray-400">
            {/* Image Upload Button */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="p-1.5 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors cursor-pointer"
              title="Unggah gambar (atau paste screenshot langsung)"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
                e.target.value = '';
              }}
            />

            {/* File Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors cursor-pointer"
              title="Lampirkan dokumen (maks. 10 MB)"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
                e.target.value = '';
              }}
            />

            <span className="text-[11px] text-gray-400 hidden sm:inline ml-1 select-none">
              Blok teks untuk menu format • Maks. 10 MB
            </span>
          </div>

          {/* Circular Emerald Send Button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!canSubmit}
            className="w-8 h-8 rounded-full bg-[#15803d] hover:bg-[#166534] active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white transition-all flex items-center justify-center shadow-xs cursor-pointer shrink-0"
            title="Kirim pesan (Enter)"
            aria-label="Kirim pesan"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SendHorizontal className="w-3.5 h-3.5 -ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Caption under editor */}
      <p className="text-[10.5px] text-gray-400 pl-2 select-none">
        Gunakan <span className="font-semibold text-emerald-600">@</span> untuk mention • <span className="font-semibold text-gray-500">Enter</span> untuk kirim • <span className="font-semibold text-gray-500">Shift+Enter</span> baris baru
      </p>
    </div>
  );
};
