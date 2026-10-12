import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions, getUserRoles } from '@/lib/access';
import { authService } from '@/modules/auth/services/auth.service';
import { boardService } from '@/modules/boards/services/board.service';
import { Header } from '@/components/layout/Header';
import { FloatingNavbar } from '@/components/layout/FloatingNavbar';
import { BoardGallery } from '@/components/boards/BoardGallery';

export const instant = false;

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const [user, boards, permissions, roles] = await Promise.all([
    authService.getUserById(session.userId),
    boardService.listBoards(),
    getUserPermissions(session.userId),
    getUserRoles(session.userId),
  ]);

  const userWithRoles = user ? { ...user, roles } : null;

  return (
    <div className="min-h-screen bg-[#f4f5fa] flex flex-col justify-between relative selection:bg-green-100 selection:text-green-800">
      {/* Top Floating Header */}
      <Header user={userWithRoles} />

      {/* Main Board Gallery Content */}
      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-6 pb-24 flex-1">
        <BoardGallery initialBoards={boards} permissions={permissions} />
      </main>

      {/* Center Floating Pill Navbar */}
      <FloatingNavbar permissions={permissions} />
    </div>
  );
}
