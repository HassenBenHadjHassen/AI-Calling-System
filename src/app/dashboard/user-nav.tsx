'use client';

import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export default function UserNav({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
  };
}) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
          {user.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
        </div>
        <div className="hidden sm:block text-left">
          <p className="font-semibold text-slate-900 leading-tight truncate max-w-[140px]">
            {user.name || 'Opérateur'}
          </p>
          <p className="text-2xs text-slate-400 truncate max-w-[140px]">
            {user.email || ''}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        title="Se déconnecter"
        className="cursor-pointer px-2 py-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors text-xs font-medium flex items-center gap-1"
      >
        <span>🚪</span>
        <span className="hidden md:inline">Déconnexion</span>
      </button>
    </div>
  );
}
