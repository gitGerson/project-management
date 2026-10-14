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

export interface CardMemberUserDTO {
  id: number;
  name: string;
  username: string;
  email: string;
  profilePicture: string | null;
}

export interface CardMemberDTO {
  id: number;
  cardId: number;
  userId: number;
  createdAt: string;
  user: CardMemberUserDTO;
}

export interface CardAttachmentUserDTO {
  id: number;
  name: string;
  username: string;
  profilePicture: string | null;
}

export interface CardAttachmentDTO {
  id: number;
  cardId: number;
  userId: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
  updatedAt: string;
  user?: CardAttachmentUserDTO;
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
  coverUrl: string | null;
  startDate: string | null;
  dueDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  owner?: CardOwnerDTO;
  labels?: LabelDTO[];
  members?: CardMemberDTO[];
  attachments?: CardAttachmentDTO[];
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

export interface ToggleCardMemberInput {
  cardId: number;
  userId: number;
}

export interface CreateCardInput {
  boardId: number;
  listId: number;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  position?: 'top' | 'bottom';
}

export interface UpdateCardInput {
  title?: string;
  description?: string | null;
  status?: string;
  coverUrl?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  ownerId?: number;
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

export interface CreateCardAttachmentInput {
  cardId: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

