export interface UserRoleInfo {
  id: number;
  name: string;
  description: string | null;
}

export interface UserListItemDTO {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  profilePicture: string | null;
  domain: string | null;
  roles: string[];
  createdAt: Date;
}

export interface UserDetailDTO {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  profilePicture: string | null;
  domain: string | null;
  roles: UserRoleInfo[];
  permissions: string[];
  createdAt: Date;
}

export interface UserFilterInput {
  search?: string;
  roleId?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
}

