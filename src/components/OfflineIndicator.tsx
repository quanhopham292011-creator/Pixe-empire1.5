import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-950/95 border border-amber-400 text-amber-200 text-sm font-bold shadow-lg shadow-black/60 backdrop-blur-md">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        <WifiOff className="w-4 h-4 text-amber-300 flex-shrink-0" />
        <span>Đang chơi offline</span>
      </div>
    </div>
  );
};
