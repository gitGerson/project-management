import type { CommentAttachmentDTO, CommentReplyDTO, MentionUserDTO } from '../types';

/**
 * Escapes HTML entities for safe embedding
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Unescapes basic HTML entities
 */
export function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * Strips all HTML tags and collapses spaces for clean previews and quotes
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return unescapeHtml(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedComment {
  cleanContent: string;
  replyTo: CommentReplyDTO | null;
  attachments: CommentAttachmentDTO[];
}

/**
 * Parses raw HTML / stored comment text into clean text, attachments, and reply context.
 * Compatible with v1 Laravel HTML format and v2 markup.
 */
export function parseCommentContent(rawHtml: string): ParsedComment {
  if (!rawHtml) {
    return {
      cleanContent: '',
      replyTo: null,
      attachments: [],
    };
  }

  let text = rawHtml;
  let replyTo: CommentReplyDTO | null = null;
  const attachments: CommentAttachmentDTO[] = [];
  const seenAttachmentUrls = new Set<string>();

  // 1. Extract blockquote reply context: <blockquote data-reply-id="42" data-author="User">...</blockquote>
  const replyMatch = text.match(
    /<blockquote\b[^>]*data-reply-id=["'](\d+)["'][^>]*data-author=["']([^"']*)["'][^>]*>([\s\S]*?)<\/blockquote>/i
  );
  if (replyMatch) {
    const [, replyIdStr, replyAuthor, replySnippet] = replyMatch;
    replyTo = {
      id: parseInt(replyIdStr, 10),
      authorName: unescapeHtml(replyAuthor || 'User'),
      snippet: stripHtml(replySnippet),
    };
    // Remove the blockquote from the remaining text
    text = text.replace(replyMatch[0], '');
  }

  // 2. Extract <img> tags: <img src="url" alt="name" data-file-size="123" />
  const imgRegex = /<img\b[^>]*src=["']([^"']+)["'][^>]*\/?>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(rawHtml)) !== null) {
    const fullTag = imgMatch[0];
    const src = imgMatch[1];
    if (src && !seenAttachmentUrls.has(src)) {
      seenAttachmentUrls.add(src);

      // Extract alt for filename
      const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
      const sizeMatch = fullTag.match(/data-file-size=["'](\d+)["']/i);
      const fileName = altMatch ? unescapeHtml(altMatch[1]) : src.split('/').pop() || 'image.png';
      const fileSize = sizeMatch ? parseInt(sizeMatch[1], 10) : undefined;

      attachments.push({
        url: src,
        fileName,
        fileSize,
        mimeType: 'image/png',
        isImage: true,
      });
    }
  }
  // Strip img tags from clean text
  text = text.replace(/<img\b[^>]*\/?>/gi, '');

  // 3. Extract v1 attachment markers: <span data-comment-attachment="1" data-file-path="..." data-file-name="..." ...>
  const fileRegex = /<span\b[^>]*data-comment-attachment=["']1["'][^>]*>([\s\S]*?)<\/span>/gi;
  let fileMatch: RegExpExecArray | null;
  while ((fileMatch = fileRegex.exec(rawHtml)) !== null) {
    const spanTag = fileMatch[0];
    const pathMatch = spanTag.match(/data-file-path=["']([^"']*)["']/i);
    const nameMatch = spanTag.match(/data-file-name=["']([^"']*)["']/i);
    const mimeMatch = spanTag.match(/data-mime-type=["']([^"']*)["']/i);
    const sizeMatch = spanTag.match(/data-file-size=["'](\d+)["']/i);

    const filePath = pathMatch ? pathMatch[1] : '';
    if (filePath && !seenAttachmentUrls.has(filePath)) {
      seenAttachmentUrls.add(filePath);
      const fileName = nameMatch ? unescapeHtml(nameMatch[1]) : filePath.split('/').pop() || 'attachment';
      const mimeType = mimeMatch ? mimeMatch[1] : undefined;
      const fileSize = sizeMatch ? parseInt(sizeMatch[1], 10) : undefined;
      const isImage = Boolean(mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(filePath));

      attachments.push({
        url: filePath,
        fileName,
        fileSize,
        mimeType,
        isImage,
      });
    }
  }
  // Strip attachment spans from clean text
  text = text.replace(/<span\b[^>]*data-comment-attachment=["']1["'][^>]*>[\s\S]*?<\/span>/gi, '');

  // 4. Extract mention spans: <span data-type="mention" data-label="ADMIN" ...>@ADMIN</span>
  text = text.replace(
    /<span\b[^>]*data-type=["']mention["'][^>]*data-label=["']([^"']*)["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_match, label, inner) => `@${label || inner.replace(/^@/, '')}`
  );
  text = text.replace(
    /<span\b[^>]*data-type=["']mention["'][^>]*>([\s\S]*?)<\/span>/gi,
    '$1'
  );

  const cleanContent = text.trim();

  return {
    cleanContent,
    replyTo,
    attachments,
  };
}

/**
 * Prepares and highlights HTML content with member mentions in clean full-name style
 */
export function formatCommentHtml(
  content: string,
  isMine: boolean,
  mentionCandidates?: MentionUserDTO[]
): string {
  if (!content) return '';

  let html = content.trim();

  // If plain text (doesn't contain html tags), wrap linebreaks
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);
  if (!hasHtmlTags) {
    html = escapeHtml(html).replace(/\n/g, '<br />');
  }

  // Clean mention text style: full name in brand emerald text
  const mentionClass = isMine
    ? 'font-semibold text-emerald-800 select-none'
    : 'font-semibold text-[#15803d] select-none';

  // 1. If we have mentionCandidates, match either @username or @FullName, and display the full name
  if (mentionCandidates && mentionCandidates.length > 0) {
    // Sort candidates by name length descending so longer full names match first
    const sorted = [...mentionCandidates].sort(
      (a, b) => (b.name?.length || 0) - (a.name?.length || 0)
    );

    for (const member of sorted) {
      const fullName = member.name?.trim();
      const username = member.username?.trim();

      const escapedFull = fullName ? fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
      const escapedUser = username ? username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

      const pattern = [escapedFull, escapedUser].filter(Boolean).join('|');
      if (!pattern) continue;

      const regex = new RegExp(`(^|[\\s>])@(?:${pattern})(?=[\\s<,.:;!?]|$)`, 'gi');
      html = html.replace(regex, (_match, prefix) => {
        return `${prefix}<span class="${mentionClass}">@${escapeHtml(fullName || username || '')}</span>`;
      });
    }
  }

  // 2. Generic fallback for any remaining @mentions not in candidate list
  html = html.replace(/(^|[\s>])@([a-zA-Z0-9_.-]+)(?=[\s<,.:;!?]|$)/g, (_match, prefix, user) => {
    return `${prefix}<span class="${mentionClass}">@${escapeHtml(user)}</span>`;
  });

  return html;
}

/**
 * Serializes message input into storage HTML string.
 */
export function serializeCommentContent(input: {
  content: string;
  replyTo?: CommentReplyDTO | null;
  attachments?: CommentAttachmentDTO[];
}): string {
  const parts: string[] = [];

  // 1. Quoted reply block (stripped of html to ensure clean quote)
  if (input.replyTo) {
    const cleanSnippet = stripHtml(input.replyTo.snippet);
    parts.push(
      `<blockquote data-reply-id="${input.replyTo.id}" data-author="${escapeHtml(
        input.replyTo.authorName
      )}">${escapeHtml(cleanSnippet)}</blockquote>`
    );
  }

  // 2. Attachments
  if (input.attachments && input.attachments.length > 0) {
    for (const att of input.attachments) {
      if (att.isImage) {
        parts.push(
          `<img src="${escapeHtml(att.url)}" alt="${escapeHtml(att.fileName)}" data-file-size="${att.fileSize || 0}" />`
        );
      } else {
        parts.push(
          `<span data-comment-attachment="1" data-file-path="${escapeHtml(
            att.url
          )}" data-file-name="${escapeHtml(att.fileName)}" data-mime-type="${escapeHtml(
            att.mimeType || ''
          )}" data-file-size="${att.fileSize || 0}">${escapeHtml(att.fileName)}</span>`
        );
      }
    }
  }

  // 3. User content
  if (input.content) {
    parts.push(input.content.trim());
  }

  return parts.join('\n');
}

/**
 * Formats file size in bytes to human readable string (KB, MB)
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
