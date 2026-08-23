import React, { useState, useEffect } from "react";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  AlertCircle,
  Clock
} from "lucide-react";
import { UserAccessProfile } from "../types";
import {
  authenticatePetugas,
  syncOfficerProfilesFromGoogleSheets,
  syncPatientsFromGoogleSheets
} from "../lib/patientMonitoring";
import { PUSKESMAS_LOGO_URL } from "./SignatureData";
import { GvizSyncErrorBanner } from "./GvizSyncErrorBanner";

interface UserLoginViewProps {
  onLoginSuccess: (user: UserAccessProfile) => void;
  sessionExpiredNotice?: string;
}

export const UserLoginView: React.FC<UserLoginViewProps> = ({
  onLoginSuccess,
  sessionExpiredNotice
}) => {
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSecurityInfo, setShowSecurityInfo] = useState<boolean>(false);
  const [isSyncingWithCloud, setIsSyncingWithCloud] = useState<boolean>(false);

  // Otomatis sinkronisasi akun & data dari Google Sheets saat aplikasi pertama dibuka di perangkat
  useEffect(() => {
    let isMounted = true;
    const fetchCloudData = async () => {
      try {
        setIsSyncingWithCloud(true);
        await Promise.allSettled([
          syncOfficerProfilesFromGoogleSheets(),
          syncPatientsFromGoogleSheets()
        ]);
      } catch (e) {
        console.warn("Auto-sync Google Sheets saat login notice:", e);
      } finally {
        if (isMounted) setIsSyncingWithCloud(false);
      }
    };
    fetchCloudData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const cleanUser = usernameInput.trim();
    const cleanPass = passwordInput.trim();

    if (!cleanUser) {
      setErrorMessage("Silakan masukkan Username atau NIP Petugas.");
      return;
    }

    if (!cleanPass) {
      setErrorMessage("Silakan masukkan Password / Kata Sandi.");
      return;
    }

    setIsSubmitting(true);

    // 1. Coba autentikasi lokal
    let result = authenticatePetugas(cleanUser, cleanPass);

    // 2. Jika gagal di lokal, coba sinkronkan live dari Google Sheets siapa tahu admin baru saja mengubah username/password di cloud
    if (!result.success) {
      try {
        await syncOfficerProfilesFromGoogleSheets();
        result = authenticatePetugas(cleanUser, cleanPass);
      } catch (err) {}
    }

    if (result.success && result.user) {
      // Pastikan pasien terbaru juga ditarik agar data di dashboard selaras
      syncPatientsFromGoogleSheets().catch(() => {});
      setIsSubmitting(false);
      onLoginSuccess(result.user);
    } else {
      setIsSubmitting(false);
      setErrorMessage(
        result.message || "Username atau Password yang Anda masukkan tidak cocok."
      );
    }
  };

  return (
    <div
      id="user-login-view"
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-slate-800 flex flex-col justify-between p-4 sm:p-6"
    >
      {/* Top Brand Bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white p-1 shadow-md flex items-center justify-center shrink-0">
            <img
              src={PUSKESMAS_LOGO_URL}
              alt="Logo Puskesmas Sananwetan"
              className="h-full w-full object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-wide">
              UPT PUSKESMAS SANANWETAN
            </div>
            <div className="text-[11px] text-blue-200">
              Dinas Kesehatan Kota Blitar • Wilayah Kerja 7 Kelurahan
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowSecurityInfo(true)}
          className="text-[11px] font-semibold text-blue-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 transition cursor-pointer"
        >
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Keamanan Terenkripsi</span>
        </button>
      </div>

      {/* Global Sync Error Banner if Sheet is unshared */}
      <div className="w-full max-w-5xl mx-auto pt-3">
        <GvizSyncErrorBanner />
      </div>

      {/* Main Login Card - Centered */}
      <div className="my-auto w-full max-w-lg mx-auto py-6">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100/90 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 text-white text-center relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center">
              <div className="h-14 w-14 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center mb-3 ring-4 ring-white/20">
                <img
                  src={PUSKESMAS_LOGO_URL}
                  alt="Logo Puskesmas Sananwetan"
                  className="h-full w-full object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/30 text-blue-100 text-[11px] font-bold tracking-wider uppercase mb-1 border border-blue-400/30">
                <Lock size={12} className="text-emerald-300" /> Autentikasi Kriptografis
              </div>

              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Sistem Surveilans Rabies (GHPR)
              </h1>
              <p className="text-xs text-blue-100/90 mt-0.5 max-w-xs leading-relaxed">
                Formulir PE & Pemantauan Pasien Gigitan Hewan Penular Rabies
              </p>
            </div>

            {/* Decorative circles */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          </div>

          {/* Card Body */}
          <div className="p-6 sm:p-7">
            {/* Session Expired Notice */}
            {sessionExpiredNotice && !errorMessage && (
              <div
                id="login-session-expired-alert"
                className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs animate-in fade-in"
              >
                <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-semibold">
                  {sessionExpiredNotice}
                </div>
              </div>
            )}

            {/* Feedback Notifications */}
            {errorMessage && (
              <div
                id="login-error-alert"
                className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in"
              >
                <AlertCircle size={17} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">
                  {errorMessage}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              autoComplete="off"
              className="space-y-4"
            >
              {/* Kolom 1: Username */}
              <div>
                <label
                  htmlFor="input-username"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Username / NIP / Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={17} />
                  </div>
                  <input
                    id="input-username"
                    name="username"
                    type="text"
                    required
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-lpignore="true"
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="Masukkan username atau NIP..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 transition"
                  />
                </div>
              </div>

              {/* Kolom 2: Password */}
              <div>
                <label
                  htmlFor="input-password"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={17} />
                  </div>
                  <input
                    id="input-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-lpignore="true"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="Masukkan password..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white py-3 px-5 text-sm font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-70"
                >
                  <LogIn size={18} />
                  <span>{isSubmitting ? "Memverifikasi Kredensial..." : "Masuk ke Sistem"}</span>
                </button>
              </div>
            </form>

            {/* Bottom Actions: Security info & Sync Status */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 text-slate-500 text-[11px]">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>Autentikasi SHA-256</span>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsSyncingWithCloud(true);
                    await Promise.all([
                      syncOfficerProfilesFromGoogleSheets(),
                      syncPatientsFromGoogleSheets()
                    ]);
                  } catch (e) {
                  } finally {
                    setIsSyncingWithCloud(false);
                  }
                }}
                disabled={isSyncingWithCloud}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer disabled:opacity-50"
                title="Tarik data akun terbaru yang baru diubah oleh admin dari server cloud"
              >
                <Clock size={12} className={isSyncingWithCloud ? "animate-spin text-emerald-600" : ""} />
                <span>{isSyncingWithCloud ? "Menyinkronkan..." : "Sinkronkan Akun"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info below card */}
        <div className="text-center mt-4 text-xs text-slate-400">
          Surveilans Epidemiologi Zoonosis & GHPR • UPT Puskesmas Sananwetan Kota Blitar
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="w-full max-w-5xl mx-auto text-center text-xs text-slate-500 pb-2">
        @2026_Widodo _Suprianto A.Md.Kep Form PE GHPR UPT Puskesmas Sananwetan
      </div>

      {/* Modal Edukasi Keamanan */}
      {showSecurityInfo && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4>Standar Keamanan Kredensial Sistem</h4>
                <p className="text-xs text-slate-500 font-normal">Proteksi Data Medis GHPR Puskesmas Sananwetan</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 shrink-0">✓</span>
                <span><b>Enkripsi Kriptografis Satu Arah (SHA-256 + Salt):</b> Kata sandi tidak pernah disimpan dalam bentuk teks polos. Siapa pun tidak dapat membaca password yang telah disetting.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 shrink-0">✓</span>
                <span><b>Proteksi Histori & Autocomplete:</b> Form login telah dimatikan fitur penyimpanan riwayat isiannya (`autocomplete="off"`), sehingga orang lain yang memakai komputer yang sama tidak dapat melihat apa yang pernah diketik.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 shrink-0">✓</span>
                <span><b>Dukungan Multi-Metode Login:</b> Petugas dapat masuk menggunakan Username, NIP lengkap, atau Email resmi instansi.</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSecurityInfo(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
