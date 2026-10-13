export interface ListDTO {
  id: number;
  boardId: number;
  title: string;
  name?: string;
  code: string;
  position: number;
  sortOrder?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListInput {
  boardId: number;
  title: string;
  code?: string;
  position?: number;
  isActive?: boolean;
}

export interface UpdateListInput {
  title?: string;
  code?: string;
  position?: number;
  isActive?: boolean;
}

export interface ListPermissionsDTO {
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

