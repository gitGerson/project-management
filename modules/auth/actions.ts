'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loginSchema, registerSchema } from '@/modules/auth/schemas/auth.schema';
import { authService } from '@/modules/auth/services/auth.service';
import { createSessionToken, setSessionCookie, clearSessionCookie } from '@/lib/auth';
import type { ActionResponse } from '@/modules/auth/types';

export async function loginAction(
  _prevState: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    username: formData.get('username'),
    password: formData.get('password'),
  };

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const user = await authService.authenticate(parsed.data);
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
    });
    await setSessionCookie(token);
    revalidatePath('/');
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: err.message || 'Login failed. Please check your credentials.',
    };
  }

  redirect('/');
}

export async function registerAction(
  _prevState: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    username: formData.get('username'),
    password: formData.get('password'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
  };

  const parsed = registerSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const user = await authService.register(parsed.data);
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
    });
    await setSessionCookie(token);
    revalidatePath('/');
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: err.message || 'Registration failed.',
    };
  }

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  revalidatePath('/');
  redirect('/login');
}

