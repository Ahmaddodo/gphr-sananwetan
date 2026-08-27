import React, { useState } from "react";
import { FileText, Users, PlusCircle, ShieldCheck, KeyRound, Settings, Clock, Sparkles, LogOut } from "lucide-react";
import { UserAccessProfile } from "../types";

export type ActiveAppTab = "form" | "monitoring" | "settings";

interface NavigationTabsProps {
  activeTab: ActiveAppTab;
  setActiveTab: (tab: ActiveAppTab) => void;
  activePatientCount: number;
  userProfile: UserAccessProfile;
  editingCaseId: string | null;
  onNewInputClick: () => void;
  isAdminMode?: boolean;
  dueCount?: number;
  newPatientCount?: number;
  onLogout?: () => void;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  setActiveTab,
  activePatientCount,
  userProfile,
  editingCaseId,
  onNewInputClick,
  isAdminMode = false,
  dueCount = 0,
  newPatientCount = 0,
  onLogout
}) => {
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);
  const isAdmin = (userProfile?.username || "").toLowerCase() === "admin";

  return (
    <div className="bg-white border-b border-slate-200 shadow-2xs print:hidden">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar py-2">
          {/* Main Navigation Tabs */}
          <div className="flex items-center gap-2">
            {/* Tab Formulir PE GHPR: Tampil untuk SEMUA USERNAME (Mode Publik Sesuai Hak Akses) */}
            <button
              id="nav-tab-form"
              type="button"
              onClick={() => setActiveTab("form")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "form"
                  ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileText size={16} />
              <span>{editingCaseId ? "Edit Form Kasus" : "Formulir PE GHPR"}</span>
              {editingCaseId && (
                <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded ml-1 animate-pulse">
                  Edit
                </span>
              )}
            </button>

            <button
              id="nav-tab-monitoring"
              type="button"
              onClick={() => setActiveTab("monitoring")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer relative ${
                activeTab === "monitoring"
                  ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Users size={16} />
              <span>Daftar Pasien Dipantau</span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full transition ${
                  activeTab === "monitoring"
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "bg-blue-600 text-white"
                }`}
                title="Jumlah kasus aktif dalam pemantauan di wilayah Anda"
              >
                {activePatientCount}
              </span>

              {/* Alert Badge if there are due VAR or new patients */}
              {dueCount > 0 && (
                <span
                  className="bg-amber-400 text-amber-950 font-black text-[9px] px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shadow-2xs animate-bounce"
                  title={`${dueCount} pasien memiliki jadwal jatuh tempo / terlambat`}
                >
                  <Clock size={10} />
                  <span>{dueCount} Jatuh Tempo</span>
                </span>
              )}

              {dueCount === 0 && newPatientCount > 0 && (
                <span
                  className="bg-emerald-400 text-emerald-950 font-black text-[9px] px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shadow-2xs"
                  title={`${newPatientCount} pasien baru ditambahkan`}
                >
                  <Sparkles size={10} />
                  <span>{newPatientCount} Baru</span>
                </span>
              )}
            </button>

            {/* TAB SETTING LOGIN & AKUN - HANYA TAMPIL DI MODE ADMIN */}
            {isAdminMode && (
              <button
                id="nav-tab-settings"
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-indigo-700 text-white shadow-sm ring-2 ring-indigo-500/20"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
                title="Buka panel pengaturan username, kata sandi login, dan integrasi sistem (Hanya Admin)"
              >
                <KeyRound size={16} className={activeTab === "settings" ? "text-amber-300" : "text-slate-600"} />
                <span>Setting Login & Akun</span>
                <span className="bg-amber-400 text-slate-900 text-[9px] font-extrabold px-1.5 py-0.2 rounded ml-0.5">
                  Admin
                </span>
              </button>
            )}
          </div>

          {/* Quick Info / Quick Action Button / Log Out */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === "monitoring" ? (
              <button
                id="btn-quick-new-case"
                type="button"
                onClick={onNewInputClick}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
                title="Buka form input kasus baru (Mode Publik)"
              >
                <PlusCircle size={15} />
                <span>+ Input Pasien Baru</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span className="truncate max-w-[220px]">
                  {userProfile.isKoordinator
                    ? `Semua Kelurahan (${userProfile.nama.split(",")[0]})`
                    : `Kel. ${userProfile.kelurahan} (${userProfile.nama.split(",")[0]})`}
                </span>
              </div>
            )}

            {/* Tombol Logout Cepat di Nav Tabs */}
            {onLogout && (
              <button
                id="btn-nav-logout"
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700 hover:text-rose-800 transition shadow-2xs cursor-pointer"
                title="Keluar (Log Out) dari akun petugas"
              >
                <LogOut size={14} className="text-rose-600" />
                <span className="hidden md:inline">Log Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Log Out dari Tab Navigasi */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <LogOut size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Konfirmasi Keluar (Log Out)
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin keluar dari akun <span className="font-bold text-slate-800">{userProfile.nama}</span>? Anda dapat login kembali kapan saja.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-nav-logout"
                type="button"
                onClick={() => {
                  setShowLogoutModal(false);
                  if (onLogout) onLogout();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
