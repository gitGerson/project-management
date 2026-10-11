import type { Metadata } from 'next';
import RegisterForm from '@/modules/auth/components/RegisterForm';

export const metadata: Metadata = {
  title: 'Create an Account - Project Management',
  description: 'Register for a new account',
};

export default function RegisterPage() {
  return <RegisterForm />;
}

