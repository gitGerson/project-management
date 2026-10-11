import { prisma } from '@/lib/prisma';
import type { User } from '@prisma/client';

export interface CreateUserData {
  username: string;
  password: string;
  name: string;
  email: string;
  phone?: string | null;
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
      },
    });
  },
};

