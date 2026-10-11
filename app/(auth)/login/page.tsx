import type { Metadata } from 'next';
import LoginForm from '@/modules/auth/components/LoginForm';

export const metadata: Metadata = {
  title: 'Tong Tji Board | Login',
  description: 'Sign in with your LDAP account to access Tong Tji Board',
};

export default function LoginPage() {
  return <LoginForm />;
}

