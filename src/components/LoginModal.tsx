import React, { useState } from "react";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  AlertCircle,
  X,
  LogIn
} from "lucide-react";
import { UserAccessProfile } from "../types";
import { authenticatePetugas } from "../lib/patientMonitoring";
import { PUSKESMAS_LOGO_URL } from "./SignatureData";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserAccessProfile) => void;
  currentActiveUser: UserAccessProfile | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentActiveUser
}) => {
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExecuteLogin = () => {
    setErrorMessage("");
    const cleanUser = usernameInput.trim();
    const cleanPass = passwordInput.trim();

    if (!cleanUser) {
      setErrorMessage("Silakan masukkan Username atau NIP.");
      return;
    }
    if (!cleanPass) {
      setErrorMessage("Silakan masukkan Kata Sandi.");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const result = authenticatePetugas(cleanUser, cleanPass);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
        setIsSubmitting(false);
        onClose();
      } else {
        setErrorMessage(result.message || "Gagal masuk. Periksa kembali kredensial Anda.");
        setIsSubmitting(false);
      }
    }, 250);
  };

  return (
    <div
      id="login-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="login-modal-card"
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto"
      >
        {/* Modal Header */}
        <div className="relative bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 text-white">
          <button
            id="btn-close-login-modal"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Tutup"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="h-13 w-13 rounded-2xl bg-white p-1 shadow-md shrink-0 flex items-center justify-center">
              <img
                src={PUSKESMAS_LOGO_URL}
                alt="Logo Puskesmas Sananwetan"
                className="h-full w-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-[10px] font-bold uppercase tracking-wider mb-1">
                <ShieldCheck size={12} /> Portal Autentikasi Resmi
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight leading-tight">
                Sistem Login Petugas Surveilans
              </h2>
              <p className="text-xs text-blue-100/90 mt-0.5">
                UPT Puskesmas Sananwetan Kota Blitar
              </p>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Info Box */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <Building2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Hak Akses Otomatis Sesuai Wilayah:</p>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                Saat login, sistem akan secara otomatis membatasi data pasien, formulir PE, dan rekap pemantauan hanya untuk wilayah kelurahan tugas Anda.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteLogin();
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username / NIP Petugas <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={15} />
                </div>
                <input
                  id="input-login-username"
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Masukkan username atau NIP..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kata Sandi / Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  id="input-login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Masukkan kata sandi..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-10 py-2 text-xs sm:text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="btn-submit-login"
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white py-2.5 px-4 text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
              >
                <LogIn size={16} />
                <span>{isSubmitting ? "Memverifikasi..." : "Masuk ke Sistem Pemantauan"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Surveilans Rabies • UPT Puskesmas Sananwetan</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
