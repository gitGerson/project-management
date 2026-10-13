export interface BoardDTO {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  isPinned?: boolean;
  pinnedAt?: Date | null;
  currentUserRole?: 'owner' | 'member' | 'monitor' | 'guest' | null;
  canEdit?: boolean;
  slug?: string;
}

export interface CreateBoardInput {
  name: string;
  description?: string | null;
  image?: string | null;
}

export interface UpdateBoardInput {
  name?: string;
  description?: string | null;
  image?: string | null;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

