import type { Metadata } from 'next';
import LoginForm from '@/modules/auth/components/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In - Project Management',
  description: 'Sign in to access your account',
};

export default function LoginPage() {
  return <LoginForm />;
}

