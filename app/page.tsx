import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { authService } from '@/modules/auth/services/auth.service';
import { Header } from '@/components/layout/Header';
import { FloatingNavbar } from '@/components/layout/FloatingNavbar';
import { BoardCard, type BoardData } from '@/components/boards/BoardCard';


export const instant = false;

const INITIAL_BOARDS: BoardData[] = [
  {
    id: 1,
    name: 'Tong Tji Go Digital',
    isPinned: true,
    coverType: 'go-digital',
  },
  {
    id: 2,
    name: 'IT Operational',
    isPinned: true,
    coverType: 'it-operational',
  },
  {
    id: 3,
    name: 'Plan Program It Untuk R...',
    isPinned: false,
    coverType: 'empty',
  },
];

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const user = await authService.getUserById(session.userId);

  return (
    <div className="min-h-screen bg-[#f4f5fa] flex flex-col justify-between relative selection:bg-green-100 selection:text-green-800">
      {/* Top Floating Header */}
      <Header user={user} />

      {/* Main Board Gallery Content */}
      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 pt-6 pb-24 flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {INITIAL_BOARDS.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      </main>

      {/* Center Floating Pill Navbar */}
      <FloatingNavbar />
    </div>
  );
}
