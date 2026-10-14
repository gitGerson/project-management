'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent, posToDOMRect } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
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
} from 'lucide-react';

interface CardDescriptionEditorProps {
  cardId: number;
  initialDescription: string | null;
  canUpdate?: boolean;
  onSave: (newDesc: string | null) => Promise<boolean>;
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
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
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
          'tiptap tiptap-content focus:outline-none max-h-[420px] overflow-y-auto leading-relaxed select-text text-xs sm:text-[13px]',
      },
      handleDOMEvents: {
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

  // Empty state in view mode
  const hasContent = initialDescription && initialDescription.trim().length > 0;

  if (!isEditing && !hasContent) {
    return (
      <div
        onClick={() => canUpdate && onEditingChange(true)}
        className={`px-1.5 py-2 text-xs rounded-xl transition-colors select-none ${
          canUpdate
            ? 'cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-gray-50/70'
            : 'text-gray-400 italic'
        }`}
      >
        {canUpdate ? (
          <span>Add a more detailed description...</span>
        ) : (
          <span>No description provided.</span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col">
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
      <div
        onClick={() => {
          if (!isEditing && canUpdate) {
            onEditingChange(true);
          }
        }}
        className={`rounded-xl transition-all ${
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

      {/* Action Bar (Only visible while editing) */}
      {isEditing && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Description'}</span>
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>

          <span className="text-[11px] text-gray-400 hidden sm:inline select-none">
            Select text to format • Ctrl+Enter to save • Esc to cancel
          </span>
        </div>
      )}
    </div>
  );
};

