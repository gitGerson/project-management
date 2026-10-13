export interface CardOwnerDTO {
  id: number;
  name: string;
  username: string;
  profilePicture: string | null;
}

export interface LabelDTO {
  id: number;
  boardId: number;
  title: string | null;
  color: string | null;
}

export interface CardDTO {
  id: number;
  boardId: number;
  listId: number;
  ownerId: number;
  title: string;
  description: string | null;
  status: string;
  rank: string;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  owner?: CardOwnerDTO;
  labels?: LabelDTO[];
}

export interface CreateLabelInput {
  boardId: number;
  title?: string | null;
  color?: string | null;
}

export interface UpdateLabelInput {
  title?: string | null;
  color?: string | null;
}

export interface ToggleCardLabelInput {
  cardId: number;
  labelId: number;
}

export interface CreateCardInput {
  boardId: number;
  listId: number;
  title: string;
  description?: string | null;
  position?: 'top' | 'bottom';
}

export interface UpdateCardInput {
  title?: string;
  description?: string | null;
  status?: string;
}

export interface MoveCardInput {
  cardId: number;
  targetListId: number;
  previousCardId?: number | null;
  nextCardId?: number | null;
}

export interface CardPermissionsDTO {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

