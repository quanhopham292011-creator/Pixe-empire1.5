import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Nếu đang mở dưới dạng App cài đặt sẵn, ẩn nút
  if (isInstalled) {
    return null;
  }

  // Dành cho điện thoại Android / Chrome
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="w-full py-3 px-4 bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 border border-emerald-500/40 shadow-lg min-h-[46px] transition-all"
      >
        <Download className="w-4 h-4 text-emerald-200" />
        <span>Cài Đặt App Về Điện Thoại (Chơi Offline)</span>
      </button>
    );
  }

  // Hướng dẫn cài trên iOS Safari
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 border border-slate-700 min-h-[44px]"
        >
          <Smartphone className="w-4 h-4 text-slate-400" />
          <span>Thêm Vào Màn Hình Chính (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-black text-white">Cài Đặt Trên iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed space-y-1 mb-4">
                1. Bấm vào nút <strong>Chia sẻ (Share)</strong> ở thanh công cụ Safari.<br />
                2. Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700"
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
