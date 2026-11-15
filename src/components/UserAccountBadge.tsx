import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { isUserAdmin } from '../firebase';
import { PlayerProfile } from '../types';
import { User as UserIcon, LogOut, ShieldCheck, Sparkles, Cloud, LogIn } from 'lucide-react';

interface UserAccountBadgeProps {
  currentUser: FirebaseUser | null;
  playerProfile: PlayerProfile;
  onOpenAuth: () => void;
  onOpenAdminPanel?: () => void;
  onSignOut: () => void;
  compact?: boolean;
}

export const UserAccountBadge: React.FC<UserAccountBadgeProps> = ({
  currentUser,
  playerProfile,
  onOpenAuth,
  onOpenAdminPanel,
  onSignOut,
  compact = false,
}) => {
  const isAdmin = isUserAdmin(currentUser);

  if (!currentUser) {
    return (
      <button
        type="button"
        onClick={onOpenAuth}
        className="min-h-[44px] px-3.5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 text-sm flex items-center gap-2 border border-blue-400/60 transition-all active:scale-95"
      >
        <LogIn className="w-4 h-4" />
        <span>Đăng Nhập / Đồng Bộ Cloud</span>
      </button>
    );
  }

  const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Chỉ Huy';
  const initial = displayName.charAt(0).toUpperCase();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isAdmin && onOpenAdminPanel && (
          <button
            type="button"
            onClick={onOpenAdminPanel}
            className="min-h-[44px] px-3 py-1.5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-600 text-white font-black rounded-xl text-sm flex items-center gap-1.5 border border-amber-400/70 shadow-lg shadow-amber-950/40 animate-pulse active:scale-95"
            title="Mở Bảng Điều Khiển Admin (Chỉ Admin thấy)"
          >
            <ShieldCheck className="w-4 h-4 text-amber-200" />
            <span className="font-mono text-sm">ADMIN</span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenAuth}
          className="min-h-[44px] flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-600 rounded-xl text-sm hover:border-slate-400 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
            {initial}
          </div>
          <span className="text-sm font-bold text-white max-w-[100px] truncate">{displayName}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-slate-700 flex items-center justify-between gap-3 text-left">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="relative">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-base flex items-center justify-center shadow border border-indigo-400/50">
            {initial}
          </div>
          <div className="absolute -bottom-1 -right-1 p-0.5 bg-emerald-500 rounded-full border-2 border-slate-900" title="Đã đồng bộ Cloud" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-black text-white break-words">{displayName}</span>
            {isAdmin && (
              <span className="text-sm font-black bg-amber-500/25 text-amber-200 border border-amber-400/60 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                ADMIN
              </span>
            )}
          </div>
          <div className="text-sm text-slate-200 truncate flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="truncate">{currentUser.email}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isAdmin && onOpenAdminPanel && (
          <button
            type="button"
            onClick={onOpenAdminPanel}
            className="min-h-[44px] px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black rounded-xl text-sm flex items-center gap-1.5 border border-amber-400/70 shadow-lg shadow-amber-950/40 transition-all active:scale-95"
            title="Mở Bảng Điều Khiển Admin (Chỉ Admin thấy)"
          >
            <ShieldCheck className="w-4 h-4 text-amber-200" />
            <span>Admin Panel</span>
          </button>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-200 hover:text-red-300 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
          title="Đăng xuất tài khoản"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
