import React, { useState } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  syncProfileToFirestore,
  loadProfileFromFirestore,
  isUserAdmin,
  ADMIN_EMAIL,
} from '../firebase';
import { PlayerProfile } from '../types';
import { X, Mail, Lock, User as UserIcon, LogIn, UserPlus, ShieldAlert, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerProfile: PlayerProfile;
  onProfileLoaded: (profile: PlayerProfile, isAdmin: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  playerProfile,
  onProfileLoaded,
}) => {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const { profile, isAdmin } = await loadProfileFromFirestore(user, playerProfile);
      onProfileLoaded(profile, isAdmin);
      setSuccessMsg(`Đăng nhập Google thành công! Chào mừng ${user.displayName || user.email}`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Cửa sổ đăng nhập Google đã bị đóng.');
      } else {
        setErrorMsg(err.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    if (!isLoginTab && password.length < 6) {
      setErrorMsg('Mật khẩu đăng ký phải có ít nhất 6 ký tự.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isLoginTab) {
        // Đăng nhập
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const { profile, isAdmin } = await loadProfileFromFirestore(cred.user, playerProfile);
        onProfileLoaded(profile, isAdmin);
        setSuccessMsg(`Đăng nhập thành công! Chào mừng ${cred.user.displayName || cred.user.email}`);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        // Đăng ký
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = cred.user;
        const nameToSet = displayName.trim() || email.split('@')[0];
        await updateProfile(user, { displayName: nameToSet });
        // Đồng bộ tiến trình hiện tại lên Firestore
        await syncProfileToFirestore(user, playerProfile);
        const isAdmin = isUserAdmin(user);
        onProfileLoaded(playerProfile, isAdmin);
        setSuccessMsg(`Tạo tài khoản thành công! Đã lưu tiến trình game.`);
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      let msg = 'Thao tác không thành công. Vui lòng thử lại.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Email này đã được đăng ký tài khoản. Vui lòng chuyển sang Đăng nhập.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Địa chỉ email không đúng định dạng.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email hoặc mật khẩu không chính xác.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Mật khẩu quá yếu (tối thiểu 6 ký tự).';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tiêu đề */}
        <div className="text-center mb-5">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-blue-500/20 border border-amber-500/30 mb-2">
            <Sparkles className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-white">Tài Khoản Pixel Empire</h2>
          <p className="text-xs text-slate-400 mt-1">
            Lưu trữ tiến trình cấp độ, Tướng và dữ liệu game trên Cloud
          </p>
        </div>

        {/* Chuyển tab Đăng nhập / Đăng ký */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setIsLoginTab(true);
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              isLoginTab ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng Nhập</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoginTab(false);
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              !isLoginTab ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Đăng Ký</span>
          </button>
        </div>

        {/* Thông báo lỗi / thành công */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Nút Đăng nhập bằng Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-white hover:bg-slate-100 active:scale-98 text-slate-800 font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2.5 text-sm mb-4 border border-slate-200"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isLoading ? 'Đang xử lý...' : 'Đăng nhập với Google'}</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-slate-800 flex-1" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">hoặc email</span>
          <div className="h-px bg-slate-800 flex-1" />
        </div>

        {/* Form Email + Password */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          {!isLoginTab && (
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Tên Hiển Thị (Display Name):</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  maxLength={32}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ví dụ: Chỉ Huy Việt Nam"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500 outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Email:</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@gmail.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">Mật khẩu:</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-500 outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:scale-98 text-white font-black rounded-xl shadow-lg shadow-amber-900/30 transition-all text-xs flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <span>Đang kết nối...</span>
            ) : isLoginTab ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Đăng Nhập Tài Khoản</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Tạo Tài Khoản Mới</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Tài khoản quản trị đặc quyền dành riêng cho email: <strong>{ADMIN_EMAIL}</strong></span>
        </div>
      </div>
    </div>
  );
};
