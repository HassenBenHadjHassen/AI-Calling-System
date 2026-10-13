'use client';

import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export default function UserNav({
  user,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    assignedBusiness?: string | null;
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

  const getBadge = () => {
    if (user.assignedBusiness === 'CABINET_MICHELLE') {
      return { label: 'Cabinet Michelle', icon: '🩺', color: 'bg-teal-50 text-teal-700 border-teal-200' };
    }
    if (user.assignedBusiness === 'DANI_BATIMENT') {
      return { label: 'Dani Bâtiment', icon: '🏗️', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: 'Super Admin', icon: '👑', color: 'bg-purple-50 text-purple-700 border-purple-200' };
  };

  const badge = getBadge();

  return (
    <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shadow-2xs">
          {user.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
        </div>
        <div className="hidden sm:block text-left">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-slate-900 leading-tight truncate max-w-[130px]">
              {user.name || 'Opérateur'}
            </p>
            <span className={`px-1.5 py-0.5 rounded-full text-3xs font-bold border ${badge.color}`}>
              {badge.icon} {badge.label}
            </span>
          </div>
          <p className="text-2xs text-slate-400 truncate max-w-[130px]">
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
        <span className="hidden md:inline">Déconnexion</span>
      </button>
    </div>
  );
}
