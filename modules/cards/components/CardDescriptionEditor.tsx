'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, posToDOMRect } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExtension from '@tiptap/extension-image';
import { uploadFileDirectly } from '@/lib/upload-client';
import { addCardAttachmentAction } from '../actions';
import type { CardAttachmentDTO } from '../types';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
  Unlink,
  Check,
  X,
  Image as ImageIcon,
  Paperclip,
  Loader2,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CardDescriptionEditorProps {
  cardId: number;
  initialDescription: string | null;
  canUpdate?: boolean;
  onSave: (newDesc: string | null) => Promise<boolean>;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
  onAttachmentAdded?: (attachment: CardAttachmentDTO) => void;
}

const BUBBLE_MENU_OPTIONS = {
  strategy: 'fixed' as const,
  placement: 'top' as const,
  offset: 8,
  flip: true,
  shift: { padding: 12 },
};

const getAppendToBody = () => document.body;

type BubbleMenuShouldShowProps = Parameters<
  NonNullable<React.ComponentProps<typeof BubbleMenu>['shouldShow']>
>[0];

export const CardDescriptionEditor: React.FC<CardDescriptionEditorProps> = ({
  cardId,
  initialDescription,
  canUpdate = true,
  onSave,
  isEditing,
  onEditingChange,
  onAttachmentAdded,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const effectivelyExpanded = isEditing || isExpanded;
  const containerRef = useRef<HTMLDivElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  // Measure content overflow to conditionally show gradient overlay and expand button
  useEffect(() => {
    const el = contentMeasureRef.current;
    if (!el) return;

    const checkOverflow = () => {
      if (contentMeasureRef.current) {
        const sh = contentMeasureRef.current.scrollHeight;
        setContentHeight(sh);
        // If content height exceeds 180px threshold, allow expanding
        setCanExpand(sh > 195);
      }
    };

    checkOverflow();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(checkOverflow);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [initialDescription]);

  // Close lightbox on Escape key without bubbling to parent modal
  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [lightboxImage]);

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      const currentEditor = editorRef.current;
      if (!files.length || !currentEditor || currentEditor.isDestroyed) return;

      setIsUploading(true);
      setUploadError(null);

      try {
        for (const file of files) {
          const isImg = file.type.startsWith('image/');
          const res = await uploadFileDirectly(file, { folder: 'card-attachments' });

          if (isImg) {
            currentEditor
              .chain()
              .focus()
              .setImage({ src: res.publicUrl, alt: res.fileName })
              .run();
          } else {
            currentEditor
              .chain()
              .focus()
              .insertContent({
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    marks: [
                      {
                        type: 'link',
                        attrs: {
                          href: res.publicUrl,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          class: 'attachment-file-badge',
                        },
                      },
                    ],
                    text: `📎 ${res.fileName} (${formatFileSize(res.fileSize)})`,
                  },
                ],
              })
              .run();
          }

          // Register in card_attachments and notify parent ATTACHMENTS section
          try {
            const attRes = await addCardAttachmentAction({
              cardId,
              fileName: res.fileName,
              fileUrl: res.publicUrl,
              fileSize: res.fileSize,
              fileType:
                res.contentType || file.type || (isImg ? 'image/png' : 'application/octet-stream'),
            });
            if (attRes.success && attRes.data) {
              onAttachmentAdded?.(attRes.data);
            }
          } catch (attErr) {
            console.error('Failed to register card attachment:', attErr);
          }
        }
      } catch (err) {
        const error = err as Error;
        setUploadError(error.message || 'Failed to upload attachment');
      } finally {
        setIsUploading(false);
      }
    },
    [cardId, onAttachmentAdded]
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable: isEditing && canUpdate,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      ImageExtension.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class:
            'rounded-lg max-w-full max-h-[160px] object-contain my-2 mx-1 border border-gray-200/80 shadow-2xs cursor-pointer hover:border-gray-300 hover:shadow-md transition-all',
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: 'text-emerald-600 hover:text-emerald-700 underline font-medium cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: 'Add a more detailed description for this card...',
      }),
    ],
    content: initialDescription || '',
    editorProps: {
      attributes: {
        class:
          'tiptap tiptap-content focus:outline-none leading-relaxed select-text text-xs sm:text-[13px] px-1',
      },
      handlePaste: (_view, event) => {
        if (!canUpdate) return false;
        const files = event.clipboardData?.files;
        if (!files || files.length === 0) return false;

        event.preventDefault();
        if (!isEditing) {
          onEditingChange(true);
        }
        handleUploadFiles(Array.from(files));
        return true;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved || !canUpdate) return false;
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        event.preventDefault();
        if (!isEditing) {
          onEditingChange(true);
        }
        handleUploadFiles(Array.from(files));
        return true;
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null;
        const img = target?.closest('img');
        if (img && img.src) {
          event.preventDefault();
          event.stopPropagation();
          setLightboxImage({
            src: img.src,
            alt: img.getAttribute('alt') || 'Attachment preview',
          });
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        click: (_view, event) => {
          const target = event.target as HTMLElement | null;
          const img = target?.closest('img');
          if (img && img.src) {
            event.preventDefault();
            event.stopPropagation();
            setLightboxImage({
              src: img.src,
              alt: img.getAttribute('alt') || 'Attachment preview',
            });
            return true;
          }

          if (!isEditing) {
            const link = target?.closest('a');
            if (link && link.href) {
              window.open(link.href, '_blank', 'noopener,noreferrer');
              return true;
            }
          }
          return false;
        },
        keydown: (_view, event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            handleCancel();
            return true;
          }
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            handleSave();
            return true;
          }
          return false;
        },
      },
    },
  });

  // Store latest editor instance in ref for async upload handlers
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync editable state with isEditing prop
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(isEditing && canUpdate);
      if (isEditing) {
        setTimeout(() => {
          editor.commands.focus('end');
        }, 50);
      }
    }
  }, [editor, isEditing, canUpdate]);

  // Sync content when card changes
  useEffect(() => {
    if (editor && !editor.isDestroyed && !isEditing) {
      const currentHTML = editor.getHTML();
      const targetContent = initialDescription || '';
      if (currentHTML !== targetContent && (!editor.isEmpty || targetContent !== '')) {
        editor.commands.setContent(targetContent);
      }
    }
  }, [cardId, initialDescription, editor, isEditing]);

  const handleSave = useCallback(async () => {
    if (!editor || isSaving) return;

    let content: string | null = null;
    if (!editor.isEmpty) {
      content = editor.getHTML().trim();
      // If it's just an empty paragraph (<p></p>), treat as null
      if (content === '<p></p>' || content === '') {
        content = null;
      }
    }

    setIsSaving(true);
    const success = await onSave(content);
    setIsSaving(false);

    if (success) {
      onEditingChange(false);
    }
  }, [editor, isSaving, onSave, onEditingChange]);

  const handleCancel = useCallback(() => {
    if (editor) {
      editor.commands.setContent(initialDescription || '');
    }
    onEditingChange(false);
  }, [editor, initialDescription, onEditingChange]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL link:', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  // Precise referenced virtual element clamped strictly to visible editor viewport
  const getReferencedVirtualElement = useCallback(() => {
    if (!editor || editor.isDestroyed) return null;
    const { view, state } = editor;
    const { selection } = state;
    if (!selection || selection.empty) return null;

    const editorDom = view.dom;
    if (!editorDom || !editorDom.isConnected) return null;

    const editorRect = editorDom.getBoundingClientRect();

    // Prefer native DOM Range rect for precise multi-line and select-all bounding box
    let rawRect: DOMRect | null = null;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorDom.contains(range.commonAncestorContainer)) {
        rawRect = range.getBoundingClientRect();
      }
    }

    // Fallback to TipTap's posToDOMRect
    if (!rawRect || (rawRect.width === 0 && rawRect.height === 0)) {
      rawRect = posToDOMRect(view, selection.from, selection.to);
    }

    // If selection is totally out of visible editor view, return empty
    if (rawRect.bottom <= editorRect.top || rawRect.top >= editorRect.bottom) {
      return {
        getBoundingClientRect: () => new DOMRect(0, 0, 0, 0),
        getClientRects: () => [],
      };
    }

    // Clamp coordinates strictly to the editor's visible bounds
    const top = Math.max(rawRect.top, editorRect.top);
    const bottom = Math.min(rawRect.bottom, editorRect.bottom);
    const left = Math.max(rawRect.left, editorRect.left);
    const right = Math.min(rawRect.right, editorRect.right);

    const clampedRect = new DOMRect(
      left,
      top,
      Math.max(0, right - left),
      Math.max(0, bottom - top)
    );

    return {
      getBoundingClientRect: () => clampedRect,
      getClientRects: () => [clampedRect],
    };
  }, [editor]);

  // Keep bubble menu position synchronized when scrolling inside editor or modal
  useEffect(() => {
    if (!editor || !isEditing) return;

    const handleScroll = () => {
      if (!editor.isDestroyed && editor.view) {
        editor.view.dispatch(editor.state.tr.setMeta('bubbleMenu', 'updatePosition'));
      }
    };

    const dom = editor.view.dom;
    dom?.addEventListener('scroll', handleScroll, { passive: true });

    const scrollContainer = dom?.closest('.overflow-y-auto');
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      dom?.removeEventListener('scroll', handleScroll);
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [editor, isEditing]);

  const shouldShowBubbleMenu = useCallback(
    ({ editor: currentEditor, view, state, from, to }: BubbleMenuShouldShowProps) => {
      if (!currentEditor || !isEditing) return false;
      const { doc, selection } = state;
      const { empty } = selection;
      const isEmptyTextBlock = !doc.textBetween(from, to).length;
      if (
        !currentEditor.isEditable ||
        (!view.hasFocus() && !currentEditor.isFocused) ||
        empty ||
        isEmptyTextBlock
      ) {
        return false;
      }
      // Check if selection is scrolled completely out of view
      const editorDom = view.dom;
      if (editorDom) {
        const editorRect = editorDom.getBoundingClientRect();
        const rawRect = posToDOMRect(view, from, to);
        if (rawRect.bottom <= editorRect.top || rawRect.top >= editorRect.bottom) {
          return false;
        }
      }
      return true;
    },
    [isEditing]
  );

  const handleContainerPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!canUpdate) return;
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        if (!isEditing) {
          onEditingChange(true);
        }
        handleUploadFiles(Array.from(files));
      }
    },
    [canUpdate, isEditing, onEditingChange, handleUploadFiles]
  );

  // Empty state in view mode
  const hasContent = initialDescription && initialDescription.trim().length > 0;

  if (!isEditing && !hasContent) {
    return (
      <div
        onPaste={handleContainerPaste}
        onClick={() => canUpdate && onEditingChange(true)}
        className={`px-1.5 py-2 text-xs rounded-lg transition-colors select-none ${
          canUpdate
            ? 'cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-gray-50/70'
            : 'text-gray-400 italic'
        }`}
      >
        {canUpdate ? (
          <span>Add a more detailed description or paste files/images...</span>
        ) : (
          <span>No description provided.</span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} onPaste={handleContainerPaste} className="flex flex-col">
      {/* TipTap Bubble Menu (Floats centered above selected/blocked text) */}
      {editor && isEditing && (
        <BubbleMenu
          editor={editor}
          updateDelay={30}
          appendTo={getAppendToBody}
          getReferencedVirtualElement={getReferencedVirtualElement}
          options={BUBBLE_MENU_OPTIONS}
          shouldShow={shouldShowBubbleMenu}
          className="flex items-center gap-0.5 p-1 bg-white border border-gray-200/90 rounded-xl shadow-xl z-50 text-gray-700 animate-in fade-in zoom-in-95 duration-100 max-w-[calc(100vw-24px)] overflow-x-auto scrollbar-none"
        >
          {/* Bold */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('bold')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('italic')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          {/* Underline */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('underline')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          {/* Strike */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('strike')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          {/* Inline Code */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('code')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Inline code"
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-gray-200 mx-0.5" />

          {/* Heading 2 */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>

          {/* Heading 3 */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Heading 3"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-gray-200 mx-0.5" />

          {/* Bullet List */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('bulletList')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Bullet list"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          {/* Ordered List */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('orderedList')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Numbered list"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          {/* Blockquote */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('blockquote')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          {/* Horizontal Rule */}
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer flex items-center justify-center"
            title="Horizontal divider"
          >
            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <div className="w-px h-4 bg-gray-200 mx-0.5" />

          {/* Link */}
          <button
            type="button"
            onClick={setLink}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
              editor.isActive('link')
                ? 'bg-emerald-50 text-emerald-700 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={editor.isActive('link') ? 'Edit link' : 'Add link'}
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>

          {editor.isActive('link') && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex items-center justify-center"
              title="Remove link"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          )}
        </BubbleMenu>
      )}

      {/* Editor Content Area */}
      <div className="relative">
        <div
          ref={contentMeasureRef}
          onClickCapture={(e) => {
            const target = e.target as HTMLElement | null;
            const img = target?.closest('img');
            if (img && img.src) {
              e.preventDefault();
              e.stopPropagation();
              setLightboxImage({
                src: img.src,
                alt: img.getAttribute('alt') || 'Attachment preview',
              });
            }
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement | null;
            const img = target?.closest('img');
            if (img && img.src) {
              e.preventDefault();
              e.stopPropagation();
              setLightboxImage({
                src: img.src,
                alt: img.getAttribute('alt') || 'Attachment preview',
              });
              return;
            }

            if (target?.closest('a')) {
              return;
            }

            if (!isEditing && canUpdate) {
              onEditingChange(true);
            }
          }}
          style={{
            maxHeight: effectivelyExpanded
              ? contentHeight > 0
                ? `${contentHeight + 35}px`
                : '3000px'
              : '180px',
          }}
          className={`rounded-lg transition-[max-height] duration-300 ease-in-out ${
            !effectivelyExpanded && canExpand ? 'overflow-hidden' : 'overflow-visible'
          } ${
            isEditing
              ? 'min-h-[100px] p-3 bg-white border border-emerald-500/80 ring-2 ring-emerald-500/10 shadow-2xs'
              : 'px-1.5 py-1 bg-transparent border border-transparent'
          } ${
            !isEditing && canUpdate
              ? 'cursor-pointer hover:bg-gray-50/60'
              : ''
          }`}
          title={!isEditing && canUpdate ? 'Click to edit description' : undefined}
        >
          <EditorContent editor={editor} />
        </div>

        {/* Overlay gradient with arrow down expand button */}
        {!isEditing && canExpand && (
          <div
            className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-1.5 rounded-b-lg transition-all duration-300 ${
              !effectivelyExpanded
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 rounded-full shadow-xs text-xs font-semibold transition-all cursor-pointer group"
              title="Show more"
            >
              <span>Show more</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}

        {/* Collapse button when expanded */}
        {!isEditing && isExpanded && canExpand && (
          <div className="flex justify-center mt-2.5 animate-in fade-in duration-200">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 rounded-full shadow-xs text-xs font-semibold transition-all cursor-pointer group"
              title="Show less"
            >
              <span>Show less</span>
              <ChevronUp className="w-3.5 h-3.5 text-gray-500 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* Action Bar (Only visible while editing) */}
      {isEditing && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Description'}</span>
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving || isUploading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>

            <div className="w-px h-4 bg-gray-200 mx-0.5" />

            {/* Image upload button */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isSaving || isUploading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-gray-700 hover:text-gray-900 bg-gray-100/90 hover:bg-gray-200/90 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Upload image"
            >
              <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
              <span>Image</span>
            </button>

            {/* File upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving || isUploading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-gray-700 hover:text-gray-900 bg-gray-100/90 hover:bg-gray-200/90 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Upload file (PDF, doc, zip, etc.)"
            >
              <Paperclip className="w-3.5 h-3.5 text-gray-500" />
              <span>File</span>
            </button>

            {/* Uploading progress indicator */}
            {isUploading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium ml-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading...</span>
              </span>
            )}
          </div>

          <span className="text-[11px] text-gray-400 hidden sm:inline select-none">
            Paste images or files directly • Ctrl+Enter to save
          </span>
        </div>
      )}

      {/* Hidden file pickers for direct button trigger */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
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

      {/* Upload error banner */}
      {uploadError && (
        <div className="mt-2 px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between">
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

