import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Tự động đăng ký Service Worker lưu sẵn tài nguyên để chơi offline
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.log('Pixel Empire đã sẵn sàng chơi offline!');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
