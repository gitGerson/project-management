import { userRepository } from '@/modules/auth/repositories/user.repository';
import { hashPassword, verifyPassword } from '@/lib/auth';
import type { LoginInput, RegisterInput } from '@/modules/auth/schemas/auth.schema';
import type { UserDTO } from '@/modules/auth/types';
import type { User } from '@prisma/client';

function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

export const authService = {
  /**
   * Authenticate a user with username and password
   */
  async authenticate(input: LoginInput): Promise<UserDTO> {
    const user = await userRepository.findByUsername(input.username);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    const isValid = await verifyPassword(input.password, user.password);
    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    return toUserDTO(user);
  },

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<UserDTO> {
    const [existingUsername, existingEmail] = await Promise.all([
      userRepository.findByUsername(input.username),
      userRepository.findByEmail(input.email),
    ]);

    if (existingUsername) {
      throw new Error('Username is already taken');
    }

    if (existingEmail) {
      throw new Error('Email is already registered');
    }

    const hashedPassword = await hashPassword(input.password);

    const newUser = await userRepository.createUser({
      username: input.username,
      password: hashedPassword,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
    });

    return toUserDTO(newUser);
  },

  /**
   * Get user profile by ID
   */
  async getUserById(id: number): Promise<UserDTO | null> {
    const user = await userRepository.findById(id);
    if (!user) return null;
    return toUserDTO(user);
  },
};

