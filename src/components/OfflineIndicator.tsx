import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/95 border border-amber-500/50 text-amber-300 text-[11px] font-bold shadow-lg shadow-black/50 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <span>Đang chơi offline</span>
      </div>
    </div>
  );
};
