import { userRepository } from '@/modules/auth/repositories/user.repository';
import { hashPassword } from '@/lib/auth';
import { authenticateLdapUser } from '@/lib/ldap';
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
    guid: user.guid,
    domain: user.domain,
    createdAt: user.createdAt,
  };
}

export const authService = {
  /**
   * Authenticate a user with LDAP and synchronize with local database.
   * Flow:
   * 1. Authenticate against LDAP directory (no local password fallback).
   * 2. If valid and not stored in DB yet, create user record in DB.
   * 3. If valid and already stored, update/sync password and profile attributes.
   */
  async authenticate(input: LoginInput): Promise<UserDTO> {
    // 1. Authenticate directly against LDAP
    const ldapUser = await authenticateLdapUser({
      username: input.username,
      password: input.password,
    });

    // 2. Hash password to keep local hash synchronized
    const hashedPassword = await hashPassword(input.password);

    // 3. Sync or insert user record into our database
    const user = await userRepository.syncLdapUser({
      username: ldapUser.uid,
      password: hashedPassword,
      name: ldapUser.name,
      email: ldapUser.email,
      phone: ldapUser.phone,
      guid: ldapUser.guid,
      domain: ldapUser.domain,
    });

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

