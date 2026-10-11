import { prisma } from '@/lib/prisma';
import type { User } from '@prisma/client';

export interface CreateUserData {
  username: string;
  password: string;
  name: string;
  email: string;
  phone?: string | null;
  guid?: string | null;
  domain?: string | null;
}

export interface UpdateUserData {
  password?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  guid?: string | null;
  domain?: string | null;
}

export const userRepository = {
  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username },
    });
  },

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  async findByGuid(guid: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { guid },
    });
  },

  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  async createUser(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data: {
        username: data.username,
        password: data.password,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        guid: data.guid || null,
        domain: data.domain || null,
      },
    });
  },

  async updateUser(id: number, data: UpdateUserData): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  /**
   * Syncs LDAP user to local database.
   * If user exists (by guid, username, or email), updates record and syncs password.
   * If not, creates new user record.
   */
  async syncLdapUser(data: CreateUserData): Promise<User> {
    // 1. Look up by guid if present
    if (data.guid) {
      const byGuid = await prisma.user.findUnique({ where: { guid: data.guid } });
      if (byGuid) {
        return prisma.user.update({
          where: { id: byGuid.id },
          data: {
            username: data.username,
            name: data.name,
            email: data.email,
            phone: data.phone ?? byGuid.phone,
            password: data.password,
            domain: data.domain || byGuid.domain,
          },
        });
      }
    }

    // 2. Look up by username
    const byUsername = await prisma.user.findUnique({ where: { username: data.username } });
    if (byUsername) {
      return prisma.user.update({
        where: { id: byUsername.id },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone ?? byUsername.phone,
          password: data.password,
          guid: data.guid || byUsername.guid,
          domain: data.domain || byUsername.domain,
        },
      });
    }

    // 3. Look up by email
    const byEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          username: data.username,
          name: data.name,
          phone: data.phone ?? byEmail.phone,
          password: data.password,
          guid: data.guid || byEmail.guid,
          domain: data.domain || byEmail.domain,
        },
      });
    }

    // 4. Otherwise create new user
    return prisma.user.create({
      data: {
        username: data.username,
        password: data.password,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        guid: data.guid || null,
        domain: data.domain || null,
      },
    });
  },
};

