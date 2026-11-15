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
        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 border border-emerald-400/60 shadow-lg min-h-[46px] transition-all"
      >
        <Download className="w-4 h-4 text-emerald-100" />
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
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-100 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 border border-slate-600 min-h-[44px]"
        >
          <Smartphone className="w-4 h-4 text-slate-200" />
          <span>Thêm Vào Màn Hình Chính (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="w-full max-w-sm rounded-3xl bg-slate-950 border-2 border-slate-600 p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-black text-white">Cài Đặt Trên iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-100 leading-relaxed space-y-1 mb-4">
                1. Bấm vào nút <strong>Chia sẻ (Share)</strong> ở thanh công cụ Safari.<br />
                2. Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] py-3 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 border border-slate-600"
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
