import type { Metadata } from 'next';
import LoginForm from '@/modules/auth/components/LoginForm';

export const metadata: Metadata = {
  title: 'Tong Tji Board | Login',
  description: 'Sign in with your LDAP account to access Tong Tji Board',
};

export const instant = false;

interface LoginPageProps {
  searchParams?: Promise<{
    callbackUrl?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = (await searchParams) || {};
  return <LoginForm callbackUrl={callbackUrl} />;
}

