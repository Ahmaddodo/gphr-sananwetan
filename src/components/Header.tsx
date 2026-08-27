import React, { useState } from "react";
import {
  Eye,
  Settings2,
  Shield,
  Printer,
  Save,
  RotateCcw,
  FileSpreadsheet,
  CheckCircle2,
  Search,
  Edit3,
  LogIn,
  LogOut,
  UserCheck,
  KeyRound,
  Github,
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Smartphone
} from "lucide-react";
import { ConnectedSheetConfig, getSavedSheetConfig, saveSheetConfig } from "../lib/googleSheets";
import { GoogleSheetsManager } from "./GoogleSheetsManager";
import { PUSKESMAS_LOGO_URL } from "./SignatureData";
import { UserAccessProfile } from "../types";
import { NotificationBell } from "./NotificationBell";
import { AppNotification } from "../lib/notificationService";

interface HeaderProps {
  webAppUrl: string;
  defaultUrl: string;
  showConfig: boolean;
  setShowConfig: React.Dispatch<React.SetStateAction<boolean>>;
  setShowJsonModal: (val: boolean) => void;
  setShowPdfModal?: (val: boolean) => void;
  setWebAppUrl: (val: string) => void;
  lastSavedTime: string | null;
  handleResetForm: () => void;
  onOpenSearchModal?: () => void;
  editingCaseId?: string | null;
  onCancelEdit?: () => void;
  currentUser?: UserAccessProfile | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  onOpenSettingsTab?: (targetSubTab?: "accounts" | "sheets" | "github") => void;
  notifications?: AppNotification[];
  onSelectNotificationAction?: (
    patientId: string,
    actionType?: "update_var" | "open_detail" | "update_log"
  ) => void;
  onRefreshNotifications?: () => void;
  isOnline?: boolean;
  pendingOfflineCount?: number;
  onOpenOfflineSync?: () => void;
}

export const Header: React.FC<HeaderProps & {
  isAdminMode: boolean;
  setIsAdminMode: (val: boolean | ((prev: boolean) => boolean)) => void;
}> = ({
  webAppUrl,
  defaultUrl,
  showConfig,
  setShowConfig,
  setShowJsonModal,
  setShowPdfModal,
  setWebAppUrl,
  lastSavedTime,
  handleResetForm,
  onOpenSearchModal,
  editingCaseId,
  onCancelEdit,
  isAdminMode,
  setIsAdminMode,
  currentUser,
  onOpenLogin,
  onLogout,
  onOpenSettingsTab,
  notifications = [],
  onSelectNotificationAction = () => {},
  onRefreshNotifications = () => {},
  isOnline = true,
  pendingOfflineCount = 0,
  onOpenOfflineSync
}) => {
  const [sheetConfig, setSheetConfig] = useState<ConnectedSheetConfig | null>(() => getSavedSheetConfig());
  const [activeDrawerTab, setActiveDrawerTab] = useState<"accounts" | "sheets" | "github">("accounts");
  const isConnected = (webAppUrl && webAppUrl.trim() !== "") || !!sheetConfig;

  const handleUrlChange = (newUrl: string) => {
    setWebAppUrl(newUrl);
    try {
      localStorage.setItem("ghpr_google_sheets_url_v1", newUrl);
    } catch (err) {
      console.warn("Gagal simpan URL web app:", err);
    }
  };

  const toggleAdminMode = () => {
    setIsAdminMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ghpr_app_view_mode", next ? "admin" : "public");
      } catch (e) {}
      if (!next) setShowConfig(false);
      return next;
    });
  };

  const handleOpenAccountSettings = () => {
    if (onOpenSettingsTab) {
      onOpenSettingsTab("accounts");
    } else {
      setActiveDrawerTab("accounts");
      setShowConfig(true);
    }
  };

  const handleOpenSheetsSettings = () => {
    if (onOpenSettingsTab) {
      onOpenSettingsTab("sheets");
    } else {
      setActiveDrawerTab("sheets");
      setShowConfig(true);
    }
  };

  const handleOpenGitHubSettings = () => {
    if (onOpenSettingsTab) {
      onOpenSettingsTab("github");
    } else {
      setActiveDrawerTab("github");
      setShowConfig(true);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm print:hidden">
      {/* Active Edit Mode Banner */}
      {editingCaseId && (
        <div className="bg-amber-600 text-white px-6 py-2 text-xs font-semibold flex items-center justify-between border-b border-amber-700 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
            <span className="font-bold uppercase tracking-wider text-[11px] bg-amber-800 px-2 py-0.5 rounded text-amber-100">
              Mode Perbaikan / Edit Laporan Aktif
            </span>
            <span className="font-mono text-white bg-amber-700 px-2 py-0.5 rounded font-bold">
              {editingCaseId}
            </span>
            <span className="text-amber-100 hidden md:inline">
              (Perubahan akan memperbarui baris data di Spreadsheet saat disimpan)
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-[11px] font-bold text-amber-900 bg-white hover:bg-amber-100 px-3 py-1 rounded-lg transition shadow-xs cursor-pointer"
          >
            Batal Edit / Buat Laporan Baru
          </button>
        </div>
      )}

      {/* Admin Mode Ribbon if active */}
      {isAdminMode && !editingCaseId && (
        <div className="bg-slate-900 text-slate-200 px-4 sm:px-6 py-1.5 text-xs font-semibold flex items-center justify-between border-b border-slate-800 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-300 font-bold uppercase tracking-wider text-[11px]">
              Mode Admin / Pengembang Aktif
            </span>
            
            {/* Quick action buttons in admin bar */}
            <div className="flex items-center gap-1.5 ml-1 flex-wrap">
              <button
                type="button"
                onClick={handleOpenAccountSettings}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600/80 hover:bg-blue-600 text-white text-[11px] font-bold border border-blue-400/40 transition cursor-pointer shadow-2xs"
                title="Buka pengaturan login dan ganti password petugas"
              >
                <KeyRound size={11} className="text-amber-300" />
                <span>⚙️ Setting Login & Akun</span>
              </button>

              <button
                type="button"
                onClick={handleOpenSheetsSettings}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] font-bold border border-emerald-400/40 transition cursor-pointer shadow-2xs"
                title="Buka pengaturan Google Sheets"
              >
                <FileSpreadsheet size={11} className="text-emerald-200" />
                <span>📊 Google Sheets</span>
              </button>

              <button
                type="button"
                onClick={handleOpenGitHubSettings}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold border border-slate-500/40 transition cursor-pointer shadow-2xs"
                title="Buka status dan link sinkronisasi repositori GitHub"
              >
                <Github size={11} className="text-white" />
                <span>🐙 GitHub Sync</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleAdminMode}
            className="text-[11px] font-bold text-amber-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-0.5 rounded border border-slate-700 transition cursor-pointer"
          >
            Tutup Mode Admin
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden border-2 border-slate-200 bg-white flex items-center justify-center shadow-xs shrink-0 p-0.5 transition-transform hover:scale-105">
            <img
              src={PUSKESMAS_LOGO_URL}
              alt="Logo UPT Puskesmas Sananwetan Kota Blitar"
              className="h-full w-full object-contain rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="leading-tight min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight uppercase truncate">
                <span className="text-blue-700 font-black mr-1.5">PE GHPR</span>
                <span>UPT PUSKESMAS SANANWETAN</span>
              </h1>
              {lastSavedTime && (
                <span
                  className="hidden md:inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700"
                  title="Formulir otomatis tersimpan di memori lokal browser (localStorage)"
                >
                  <Save size={11} className="text-blue-600" />
                  Auto-Save ({lastSavedTime})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Status Koneksi Online / Antrean Offline */}
          {onOpenOfflineSync && (
            <button
              id="btn-header-network-status"
              type="button"
              onClick={onOpenOfflineSync}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs cursor-pointer ${
                !isOnline
                  ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                  : pendingOfflineCount > 0
                  ? "bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              }`}
              title={
                !isOnline
                  ? "Mode Offline Terdeteksi: Data disimpan di antrean lokal. Klik untuk buka panel sinkronisasi."
                  : pendingOfflineCount > 0
                  ? `${pendingOfflineCount} antrean offline siap disinkronkan ke Google Sheets.`
                  : "Perangkat Online (Terkoneksi) & Siap Sinkronisasi"
              }
            >
              {!isOnline ? (
                <>
                  <WifiOff size={14} className="text-amber-600 animate-pulse" />
                  <span className="hidden md:inline">Offline</span>
                  {pendingOfflineCount > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-black">
                      {pendingOfflineCount}
                    </span>
                  ) : null}
                </>
              ) : pendingOfflineCount > 0 ? (
                <>
                  <RefreshCw size={14} className="text-blue-600 animate-spin" />
                  <span className="hidden md:inline">Sinkron</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-black">
                    {pendingOfflineCount}
                  </span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="hidden md:inline text-emerald-700">Online</span>
                </>
              )}
            </button>
          )}

          {/* Tombol Pasang / Install Aplikasi Mandiri (PWA) */}
          <button
            id="btn-header-install-pwa"
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.triggerPWAInstallPrompt) {
                window.triggerPWAInstallPrompt();
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Pasang aplikasi ke Layar Utama (Layar Penuh Standalone tanpa bar browser)"
          >
            <Download size={14} className="text-sky-600" />
            <span className="hidden sm:inline">Install App</span>
          </button>

          {/* Pusat Notifikasi & Pengingat (Jatuh Tempo & Pasien Baru) */}
          <NotificationBell
            notifications={notifications}
            onSelectNotificationAction={onSelectNotificationAction}
            onRefreshNotifications={onRefreshNotifications}
          />

          {/* Status User Logged In & Tombol Log Out (Tampil saat petugas sedang login) */}
          {currentUser && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-1 sm:pr-2 transition shadow-2xs">
              <button
                type="button"
                onClick={currentUser.username.toLowerCase() === "admin" || currentUser.role === "admin" ? onOpenLogin : undefined}
                className={`flex items-center gap-1.5 text-left transition px-1 ${
                  currentUser.username.toLowerCase() === "admin" || currentUser.role === "admin"
                    ? "cursor-pointer hover:opacity-90"
                    : "cursor-default"
                }`}
                title={
                  currentUser.username.toLowerCase() === "admin" || currentUser.role === "admin"
                    ? "Klik untuk ganti profil petugas"
                    : `Petugas Aktif: ${currentUser.nama}`
                }
              >
                <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {currentUser.nama.charAt(0)}
                </div>
                <div className="hidden lg:block leading-tight">
                  <div className="text-[11px] font-bold text-slate-900 truncate max-w-[130px]">
                    {currentUser.nama.split(",")[0]}
                  </div>
                  <div className="text-[9px] text-blue-700 font-semibold truncate max-w-[130px]">
                    {currentUser.isKoordinator ? "Koordinator" : `Kel. ${currentUser.kelurahan}`}
                  </div>
                </div>
              </button>

              {onLogout && (
                <button
                  id="btn-header-logout"
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title={`Log out / Keluar dari akun ${currentUser.nama}`}
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          )}

          {/* Tombol Tampilan Admin Khusus Hak Akses Admin Saat Berada di Form Publik */}
          {!isAdminMode && currentUser?.username?.toLowerCase() === "admin" && (
            <div className="flex items-center gap-1.5">
              <button
                id="btn-switch-to-admin-mode"
                type="button"
                onClick={toggleAdminMode}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer ring-2 ring-indigo-500/20"
                title="Beralih ke Tampilan Admin (Khusus Akun Admin)"
              >
                <ShieldCheck size={14} className="text-amber-300" />
                <span>Tampilan Admin</span>
              </button>
            </div>
          )}

          {/* Controls Khusus Admin Mode / Koordinator */}
          {isAdminMode && (
            <>
              {/* TOMBOL UTAMA: SETTING LOGIN & AKUN */}
              <button
                id="btn-admin-login-settings"
                type="button"
                onClick={handleOpenAccountSettings}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 active:scale-[0.98] px-3 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Buka panel untuk melihat & mengedit username, password, dan akun petugas"
              >
                <KeyRound size={14} className="text-indigo-700" />
                <span className="hidden sm:inline">Setting Login</span>
              </button>

              <button
                id="btn-toggle-google-sheets-config"
                type="button"
                onClick={handleOpenSheetsSettings}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 active:scale-[0.98] px-2.5 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Pengaturan Google Sheets & Web App Endpoint"
              >
                <FileSpreadsheet size={14} className="text-emerald-700" />
                <span className="hidden sm:inline">Sheets</span>
              </button>

              <button
                id="btn-toggle-github-sync"
                type="button"
                onClick={handleOpenGitHubSettings}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white active:scale-[0.98] px-2.5 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer"
                title="Sinkronisasi & Link Repositori GitHub"
              >
                <Github size={14} className="text-white" />
                <span className="hidden sm:inline">GitHub</span>
              </button>

              <button
                id="btn-admin-search-cases"
                type="button"
                onClick={onOpenSearchModal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] px-2.5 py-1.5 text-xs font-bold text-blue-800 transition shadow-2xs cursor-pointer"
                title="Cari dan edit laporan kasus PE GHPR yang sudah tersimpan"
              >
                <Search size={13} className="text-blue-600" />
                <span className="hidden sm:inline">Cari Kasus</span>
              </button>

              <button
                id="btn-preview-json"
                type="button"
                onClick={() => setShowJsonModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 active:scale-[0.98] px-2.5 py-1.5 text-xs font-bold text-slate-800 transition shadow-2xs cursor-pointer"
                title="Lihat struktur data JSON"
              >
                <Eye size={13} className="text-slate-600" />
                <span className="hidden sm:inline">JSON</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isAdminMode && showConfig && (
        <div className="border-t border-slate-200 bg-slate-50/90 px-6 py-5 animate-in fade-in">
          <div className="mx-auto max-w-[1200px] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Panel Pengaturan Terbuka:
                </span>
                <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                  {activeDrawerTab === "accounts"
                    ? "Setting Akun & Login"
                    : activeDrawerTab === "sheets"
                    ? "Integrasi Google Sheets"
                    : "Sinkronisasi Repositori GitHub"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 bg-white border border-slate-300 px-2.5 py-1 rounded-lg"
              >
                Tutup Panel
              </button>
            </div>

            <GoogleSheetsManager
              sheetConfig={sheetConfig}
              setSheetConfig={setSheetConfig}
              webAppUrl={webAppUrl}
              setWebAppUrl={handleUrlChange}
              initialTab={activeDrawerTab}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
              <span className="text-xs text-slate-500 font-medium">
                Setiap laporan yang dikirim akan secara otomatis tersimpan di baris baru Google Sheets.
              </span>
              <button
                onClick={handleResetForm}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 transition shadow-sm cursor-pointer"
                title="Hapus semua isian formulir dan bersihkan memori lokal (localStorage)"
              >
                <RotateCcw size={14} /> Reset Form & Draf Lokal
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
