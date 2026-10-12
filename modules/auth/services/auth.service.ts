import { userRepository } from '@/modules/auth/repositories/user.repository';
import { hashPassword, verifyPassword } from '@/lib/auth';
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
    profilePicture: user.profilePicture,
    guid: user.guid,
    domain: user.domain,
    createdAt: user.createdAt,
  };
}

export const authService = {
  /**
   * Authenticate a user with LDAP and synchronize with local database.
   * Flow:
   * 1. Try to authenticate against LDAP directory.
   * 2. If valid and not stored in DB yet, create user record in DB.
   * 3. If LDAP fails or is unreachable, fallback to checking local database credentials.
   */
  async authenticate(input: LoginInput): Promise<UserDTO> {
    // 1. Authenticate against LDAP if available
    try {
      const ldapUser = await authenticateLdapUser({
        username: input.username,
        password: input.password,
      });

      // Hash password to keep local hash synchronized
      const hashedPassword = await hashPassword(input.password);

      // Sync or insert user record into our database
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
    } catch (ldapErr) {
      // If LDAP credentials failed or server is unreachable, check local user fallback
      const localUser = await userRepository.findByUsername(input.username);
      if (localUser && localUser.password) {
        const isValid = await verifyPassword(input.password, localUser.password);
        if (isValid) {
          return toUserDTO(localUser);
        }
      }

      // If neither worked, rethrow standard error
      throw new Error('Invalid username or password');
    }
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

  /**
   * Update user profile information (name, profile picture)
   */
  async updateProfile(
    userId: number,
    input: { name?: string; profilePicture?: string | null }
  ): Promise<UserDTO> {
    const existing = await userRepository.findById(userId);
    if (!existing) {
      throw new Error('User not found');
    }

    const updated = await userRepository.updateUser(userId, {
      name: input.name?.trim() || undefined,
      profilePicture: input.profilePicture !== undefined ? input.profilePicture : undefined,
    });

    return toUserDTO(updated);
  },
};

