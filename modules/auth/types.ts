export interface UserDTO {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  profilePicture?: string | null;
  guid?: string | null;
  domain?: string | null;
  createdAt: Date;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
}

