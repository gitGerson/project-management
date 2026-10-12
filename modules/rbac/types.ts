export interface PermissionDTO {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface RoleDTO {
  id: number;
  name: string;
  description: string | null;
  permissions?: PermissionDTO[];
  createdAt: Date;
}

export interface UserRoleAssignmentDTO {
  userId: number;
  roleId: number;
  roleName: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds?: number[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionIds?: number[];
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
}

