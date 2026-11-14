import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Tự động đăng ký Service Worker lưu sẵn tài nguyên để chơi offline (chỉ kích hoạt ở bản build production)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.log('Pixel Empire đã sẵn sàng chơi offline!');
      },
    });
  } else {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => { r.unregister().catch(() => {}); }))
      .catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(<App />);
