export type BoardMemberRole = 'owner' | 'member' | 'monitor' | 'guest';

export interface BoardMemberUserDTO {
  id: number;
  name: string;
  username: string;
  email: string;
  profilePicture: string | null;
}

export interface BoardMemberDTO {
  boardId: number;
  userId: number;
  role: BoardMemberRole;
  user: BoardMemberUserDTO;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddBoardMemberInput {
  boardId: number;
  userId: number;
  role?: BoardMemberRole;
}

export interface UpdateBoardMemberRoleInput {
  boardId: number;
  userId: number;
  role: BoardMemberRole;
}

export interface RemoveBoardMemberInput {
  boardId: number;
  userId: number;
}

export interface SyncBoardMemberItem {
  userId: number;
  role: BoardMemberRole;
}

export interface SyncBoardMembersInput {
  boardId: number;
  members: SyncBoardMemberItem[];
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}
