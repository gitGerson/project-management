export type ScopeType = 'board' | 'card' | 'checklist';

export interface CommentAuthorDTO {
  id: number;
  name: string;
  username: string;
  profilePicture: string | null;
  initials: string;
}

export interface CommentDTO {
  id: number;
  commentableType: ScopeType | string;
  commentableId: number;
  userId: number;
  author: CommentAuthorDTO;
  content: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  isPending?: boolean;
  tempId?: string;
}

export interface ChatGroupDTO {
  id: string; // e.g. "board:1"
  scopeType: ScopeType;
  scopeId: number;
  title: string;
  subtitle?: string;
  image?: string | null;
  lastComment?: {
    content: string;
    authorName: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string; // ISO 8601
}

export interface SendCommentInput {
  commentableType: ScopeType | string;
  commentableId: number;
  content: string;
  tempId?: string;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

