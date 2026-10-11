import { Suspense } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { authService } from '@/modules/auth/services/auth.service';
import { logoutAction } from '@/modules/auth/actions';

export const instant = false;

async function AuthSection() {
  const session = await getSession();
  const user = session ? await authService.getUserById(session.userId) : null;

  if (!user) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Please sign in with your corporate account to continue.
        </p>
        <div>
          <Link
            href="/login"
            className="block w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition shadow-sm text-center"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center space-x-2 text-green-800 font-semibold mb-1">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
          <span>Authenticated Session Active</span>
        </div>
        <p className="text-sm text-green-700">
          Welcome back, <span className="font-medium">{user.name}</span>!
        </p>
      </div>

      <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          User Profile
        </h2>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <span className="text-gray-500 font-medium">Username:</span>
          <span className="col-span-2 text-gray-900 font-semibold">{user.username}</span>

          <span className="text-gray-500 font-medium">Full Name:</span>
          <span className="col-span-2 text-gray-900">{user.name}</span>

          <span className="text-gray-500 font-medium">Email:</span>
          <span className="col-span-2 text-gray-900">{user.email}</span>

          <span className="text-gray-500 font-medium">Phone:</span>
          <span className="col-span-2 text-gray-900">
            {user.phone || <span className="italic text-gray-400">Not provided</span>}
          </span>

          <span className="text-gray-500 font-medium">Joined:</span>
          <span className="col-span-2 text-gray-900">
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition shadow-sm"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}

function AuthSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-200 rounded-lg"></div>
      <div className="h-24 bg-gray-200 rounded-xl"></div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
          Project Management
        </h1>
        <p className="text-gray-500 mb-8">
          Next.js App Router with MySQL & Prisma ORM
        </p>

        <Suspense fallback={<AuthSkeleton />}>
          <AuthSection />
        </Suspense>
      </div>
    </div>
  );
}
