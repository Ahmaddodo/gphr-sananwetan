import React, { useState, useMemo, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  PlusCircle,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Syringe,
  Dog,
  Activity,
  Shield,
  ShieldCheck,
  RotateCcw,
  Printer,
  Calendar,
  UserCheck,
  ArrowUpDown,
  RefreshCw,
  Sparkles,
  AlertTriangle
} from "lucide-react";
import {
  PatientMonitoringItem,
  UserAccessProfile,
  KelurahanWilayah
} from "../types";
import {
  KELURAHAN_LIST,
  PREDEFINED_USER_PROFILES,
  getFilteredPatientsByAccess,
  saveActiveUserProfile,
  deletePatientById,
  canUserDeleteCases,
  syncPatientsFromGoogleSheets
} from "../lib/patientMonitoring";
import { checkPatientNotificationBadge } from "../lib/notificationService";
import { PatientUpdateModal } from "./PatientUpdateModal";
import { PatientDetailModal } from "./PatientDetailModal";
import { DeletePatientConfirmModal } from "./DeletePatientConfirmModal";
import { LogIn, LogOut, KeyRound, Check, Github, ExternalLink, Wifi, WifiOff } from "lucide-react";
import { getPendingQueueCount, isAppOnline } from "../lib/offlineSyncService";

interface PatientMonitoringDashboardProps {
  patientsList: PatientMonitoringItem[];
  currentUser: UserAccessProfile;
  onRefreshPatients: () => void;
  onNewInputCase: () => void;
  onEditFullFormCase: (patient: PatientMonitoringItem) => void;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onOpenGitHubSync?: () => void;
  onOpenOfflineSync?: () => void;
  webAppUrl?: string;
  initialTargetPatientId?: string | null;
  initialTargetAction?: "update_var" | "open_detail" | "update_log";
  onClearTargetPatient?: () => void;
}

export const PatientMonitoringDashboard: React.FC<PatientMonitoringDashboardProps> = ({
  patientsList,
  currentUser,
  onRefreshPatients,
  onNewInputCase,
  onEditFullFormCase,
  onOpenLoginModal,
  onLogout,
  onOpenSettings,
  onOpenGitHubSync,
  onOpenOfflineSync,
  webAppUrl,
  initialTargetPatientId,
  initialTargetAction,
  onClearTargetPatient
}) => {
  const [selectedKelurahanFilter, setSelectedKelurahanFilter] = useState<string>(
    currentUser.isKoordinator ? "Semua" : currentUser.kelurahan
  );
  const [statusFilter, setStatusFilter] = useState<string>("Semua");
  const [quickFilter, setQuickFilter] = useState<"all" | "due" | "new">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states
  const [selectedPatientForUpdate, setSelectedPatientForUpdate] = useState<PatientMonitoringItem | null>(null);
  const [selectedPatientForDetail, setSelectedPatientForDetail] = useState<PatientMonitoringItem | null>(null);
  const [selectedPatientForDelete, setSelectedPatientForDelete] = useState<PatientMonitoringItem | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [isSyncingSheets, setIsSyncingSheets] = useState<boolean>(false);

  // Handler sync dari Google Sheets
  const handleSyncFromGoogleSheets = async () => {
    setIsSyncingSheets(true);
    try {
      const res = await syncPatientsFromGoogleSheets(webAppUrl || "");
      onRefreshPatients();
      setToastMessage(res.message);
      setTimeout(() => setToastMessage(""), 6000);
    } catch (err: any) {
      onRefreshPatients();
      setToastMessage("Gagal menyinkronkan data Google Sheets: " + (err?.message || ""));
      setTimeout(() => setToastMessage(""), 6000);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Handler auto-open saat ada notifikasi yang diklik
  useEffect(() => {
    if (initialTargetPatientId && patientsList.length > 0) {
      const found = patientsList.find((p) => p.id_kasus === initialTargetPatientId);
      if (found) {
        if (initialTargetAction === "open_detail") {
          setSelectedPatientForDetail(found);
        } else {
          setSelectedPatientForUpdate(found);
        }
        if (onClearTargetPatient) {
          onClearTargetPatient();
        }
      }
    }
  }, [initialTargetPatientId, initialTargetAction, patientsList, onClearTargetPatient]);

  // Handler auto-sync saat dashboard dimuat
  useEffect(() => {
    let isMounted = true;
    const runAutoSync = async () => {
      if (webAppUrl && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const res = await syncPatientsFromGoogleSheets(webAppUrl);
          if (isMounted) {
            onRefreshPatients();
            if (res.added > 0 || res.updated > 0) {
              setToastMessage(`Sinkronisasi Google Sheets: ${res.total} data pasien selaras dengan cloud.`);
              setTimeout(() => {
                if (isMounted) setToastMessage("");
              }, 4000);
            }
          }
        } catch (e) {
          // Silent fallback on background sync
        }
      }
    };
    runAutoSync();
    return () => {
      isMounted = false;
    };
  }, [webAppUrl, onRefreshPatients]);

  // Hak akses admin untuk input pasien baru & menu admin (hanya role/username admin)
  const isAdminUser = (currentUser?.username || "").toLowerCase() === "admin" || currentUser?.role === "admin";

  // Filtered Patients List with quickFilter consideration
  const displayedPatients = useMemo(() => {
    let list = getFilteredPatientsByAccess(
      currentUser,
      selectedKelurahanFilter,
      statusFilter,
      searchQuery,
      patientsList
    );

    if (quickFilter === "due") {
      list = list.filter((p) => {
        const badge = checkPatientNotificationBadge(p);
        return badge.isDue || p.statusHewanObservasi.includes("Mati") || p.statusHewanObservasi.includes("Positif");
      });
    } else if (quickFilter === "new") {
      list = list.filter((p) => {
        const badge = checkPatientNotificationBadge(p);
        return badge.isNew;
      });
    }

    return list;
  }, [patientsList, currentUser, selectedKelurahanFilter, statusFilter, searchQuery, quickFilter]);

  // Hak akses hapus: HANYA tampil dan diizinkan untuk username "admin"
  const canDelete = useMemo(() => {
    return canUserDeleteCases(currentUser);
  }, [currentUser]);

  // Statistics calculation for user's scope
  const stats = useMemo(() => {
    const scopedList = patientsList.filter((p) => {
      if (!currentUser.isKoordinator && currentUser.kelurahan !== "Semua") {
        return p.kelurahan.toLowerCase() === currentUser.kelurahan.toLowerCase();
      }
      return true;
    });

    const total = scopedList.length;
    const aktif = scopedList.filter((p) => p.statusPemantauan === "Dalam Pemantauan (Aktif)").length;
    const perluVar = scopedList.filter((p) => p.statusPemantauan === "Perlu Follow-up VAR").length;
    const selesai = scopedList.filter((p) => p.statusPemantauan === "Selesai Observasi (14 Hari)").length;
    const dueCount = scopedList.filter((p) => checkPatientNotificationBadge(p).isDue).length;
    const newCount = scopedList.filter((p) => checkPatientNotificationBadge(p).isNew).length;

    return { total, aktif, perluVar, selesai, dueCount, newCount };
  }, [patientsList, currentUser]);

  const handleDeleteConfirmed = async (id_kasus: string) => {
    try {
      await deletePatientById(id_kasus);
      onRefreshPatients();
      setToastMessage(`Data pasien ${id_kasus} telah dibersihkan dari layar pemantauan aktif. Arsip di Google Spreadsheet tetap tersimpan.`);
      setTimeout(() => setToastMessage(""), 5000);
    } catch (err) {
      console.error("Gagal menghapus pasien dari layar:", err);
      onRefreshPatients();
      setToastMessage(`Data pasien ${id_kasus} telah dihapus dari tampilan layar.`);
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  const handlePatientUpdated = () => {
    onRefreshPatients();
    setToastMessage("Pembaruan status pemantauan pasien berhasil disimpan.");
    setTimeout(() => setToastMessage(""), 3500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage("")}
            className="text-emerald-600 hover:text-emerald-800 text-sm font-black"
          >
            ×
          </button>
        </div>
      )}

      {/* 1. User Hak Akses & Profil Wilayah Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <UserCheck size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {currentUser.nama}
              </span>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                NIP. {currentUser.nip}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                currentUser.isKoordinator
                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}>
                {currentUser.isKoordinator ? "Koordinator (Akses Semua Wilayah)" : `Wilayah Kerja: Kel. ${currentUser.kelurahan}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentUser.role} • <b>{currentUser.jabatan}</b>
            </p>
          </div>
        </div>

        {/* Petugas Session Actions */}
        <div className="w-full md:w-auto flex items-center justify-end gap-2 shrink-0 flex-wrap">
          {onOpenOfflineSync && (
            <button
              id="btn-offline-sync-dashboard"
              type="button"
              onClick={onOpenOfflineSync}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-2 text-xs font-bold text-blue-800 transition shadow-2xs cursor-pointer"
              title="Buka panel antrean & sinkronisasi data offline"
            >
              <RefreshCw size={14} className="text-blue-600" />
              <span>Sinkron Offline</span>
            </button>
          )}

          {onOpenGitHubSync && isAdminUser && (
            <button
              id="btn-github-sync-dashboard"
              type="button"
              onClick={onOpenGitHubSync}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-bold text-white transition shadow-2xs cursor-pointer"
              title="Buka panel sinkronisasi repositori GitHub (ahmaddodo/form-ghpr-sananwetan)"
            >
              <Github size={14} className="text-white" />
              <span>GitHub Sync</span>
            </button>
          )}

          {onOpenSettings && isAdminUser && (
            <button
              id="btn-setting-login-dashboard"
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 text-xs font-bold text-indigo-800 transition shadow-2xs cursor-pointer"
              title="Buka panel untuk melihat & mengedit pengaturan login petugas"
            >
              <KeyRound size={14} className="text-indigo-600" />
              <span>Setting Login Petugas</span>
            </button>
          )}

          {onOpenLoginModal && isAdminUser && (
            <button
              id="btn-switch-account-dashboard"
              type="button"
              onClick={onOpenLoginModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition shadow-2xs cursor-pointer"
              title="Ganti akun petugas"
            >
              <UserCheck size={14} className="text-blue-600" />
              <span>Ganti Akun</span>
            </button>
          )}

          {onLogout && (
            <button
              id="btn-logout-dashboard"
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs font-bold text-rose-700 hover:text-rose-800 transition shadow-2xs cursor-pointer"
              title="Keluar dari sesi akun petugas saat ini"
            >
              <LogOut size={14} className="text-rose-600" />
              <span>Keluar (Log Out)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. KPI Summary Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pasien */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Pasien Wilayah
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              {stats.total}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              {currentUser.isKoordinator ? "Seluruh 7 Kelurahan" : `Kel. ${currentUser.kelurahan}`}
            </span>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={22} />
          </div>
        </div>

        {/* Aktif Dipantau */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Observasi Aktif (14 Hari)
            </span>
            <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-1">
              {stats.aktif}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Sedang dipantau harian
            </span>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Activity size={22} />
          </div>
        </div>

        {/* Perlu Follow-up VAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Perlu Follow-up VAR
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">
              {stats.perluVar}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Jadwal VAR mendatang
            </span>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Syringe size={22} />
          </div>
        </div>

        {/* Selesai Observasi Aman */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Selesai Observasi (Aman)
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
              {stats.selesai}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Tuntas 14 hari bebas rabies
            </span>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-search-monitoring-patient"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pasien berdasarkan nama, ID Kasus, NIK, jenis hewan..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {/* Action Buttons: Tarik Data Sheets, Input Baru (Khusus Admin) & Refresh */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              id="btn-sync-sheets-dashboard"
              type="button"
              onClick={handleSyncFromGoogleSheets}
              disabled={isSyncingSheets}
              className="px-3 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              title="Tarik seluruh data laporan terbaru dari Google Spreadsheet ke sistem pemantauan"
            >
              <RefreshCw size={14} className={`text-emerald-700 ${isSyncingSheets ? "animate-spin" : ""}`} />
              <span>{isSyncingSheets ? "Menyinkronkan..." : "Tarik Data Spreadsheet"}</span>
            </button>

            <button
              id="btn-refresh-monitoring-data"
              type="button"
              onClick={onRefreshPatients}
              className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              title="Perbarui tampilan daftar data"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {isAdminUser && (
              <button
                id="btn-dashboard-new-patient"
                type="button"
                onClick={onNewInputCase}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-4 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <PlusCircle size={15} />
                <span>Input Pasien Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Buttons & Dropdowns */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Filter Pills */}
            <button
              type="button"
              onClick={() => setQuickFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                quickFilter === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Semua ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter("due")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                quickFilter === "due"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              <Clock size={12} />
              <span>Jatuh Tempo VAR / Hewan ({stats.dueCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter("new")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                quickFilter === "new"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              <Sparkles size={12} />
              <span>Pasien Baru ({stats.newCount})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Kelurahan */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 flex items-center gap-1">
                <MapPin size={13} className="text-slate-400" />
                Kelurahan:
              </span>
              {currentUser.isKoordinator ? (
                <select
                  id="filter-kelurahan-select"
                  value={selectedKelurahanFilter}
                  onChange={(e) => setSelectedKelurahanFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
                >
                  <option value="Semua">Semua Kelurahan (7 Wilayah)</option>
                  {KELURAHAN_LIST.map((kel) => (
                    <option key={kel} value={kel}>
                      Kel. {kel}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 font-bold text-blue-800 text-xs">
                  <ShieldCheck size={12} className="text-blue-600" />
                  Kel. {currentUser.kelurahan} (Terkunci)
                </span>
              )}
            </div>

            {/* Filter Status Pemantauan */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 flex items-center gap-1">
                <Filter size={13} className="text-slate-400" />
                Status:
              </span>
              <select
                id="filter-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="Semua">Semua Status</option>
                <option value="Dalam Pemantauan (Aktif)">Dalam Pemantauan (Aktif)</option>
                <option value="Perlu Follow-up VAR">Perlu Follow-up VAR</option>
                <option value="Selesai Observasi (14 Hari)">Selesai Observasi (14 Hari)</option>
                <option value="Dirujuk / Perawatan Lanjut">Dirujuk / Lanjut</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Table & Cards of Monitored Patients */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Active Filter Notice */}
        {(selectedKelurahanFilter !== "Semua" || statusFilter !== "Semua" || quickFilter !== "all" || searchQuery.trim() !== "") && (
          <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 font-medium">
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-amber-700 shrink-0" />
              <span>
                Filter aktif: Menampilkan <b>{displayedPatients.length}</b> dari <b>{stats.total}</b> pasien
                {selectedKelurahanFilter !== "Semua" && ` • Kel. ${selectedKelurahanFilter}`}
                {statusFilter !== "Semua" && ` • Status: ${statusFilter}`}
                {quickFilter === "due" && " • Jatuh Tempo"}
                {quickFilter === "new" && " • Pasien Baru"}
                {searchQuery.trim() && ` • Cari: "${searchQuery}"`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedKelurahanFilter(currentUser.isKoordinator ? "Semua" : currentUser.kelurahan);
                setStatusFilter("Semua");
                setQuickFilter("all");
                setSearchQuery("");
              }}
              className="underline text-amber-800 hover:text-amber-950 font-bold shrink-0 cursor-pointer"
            >
              Reset Semua Filter
            </button>
          </div>
        )}

        {displayedPatients.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Users size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">
                Tidak ada data pasien yang cocok
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? `Tidak ditemukan pasien dengan kata kunci "${searchQuery}" pada filter saat ini.`
                  : "Belum ada rekam pemantauan pasien di wilayah kerja ini."}
              </p>
            </div>
            {isAdminUser && (
              <button
                type="button"
                onClick={onNewInputCase}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer mt-2"
              >
                <PlusCircle size={14} /> + Input Pasien Baru
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3.5 px-4">ID Kasus & Tgl</th>
                    <th className="py-3.5 px-4">Nama Korban</th>
                    <th className="py-3.5 px-4">Kelurahan & Alamat</th>
                    <th className="py-3.5 px-4">HPR & Hewan</th>
                    <th className="py-3.5 px-4">Observasi 14 Hari</th>
                    <th className="py-3.5 px-4">Status Pemantauan</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedPatients.map((patient) => (
                    <tr
                      key={patient.id_kasus}
                      id={`patient-row-${patient.id_kasus}`}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      {/* ID Kasus & Tgl */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded block w-fit">
                          {patient.id_kasus}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-1">
                          {patient.waktuKejadian ? patient.waktuKejadian.slice(0, 10) : "-"}
                        </span>
                      </td>

                      {/* Nama Korban */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {patient.namaKorban}
                          </span>
                          {(() => {
                            const badge = checkPatientNotificationBadge(patient);
                            if (badge.isDue) {
                              return (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md flex items-center gap-0.5 animate-pulse">
                                  <Clock size={10} />
                                  <span>{badge.dueLabel || "Jatuh Tempo"}</span>
                                </span>
                              );
                            }
                            if (badge.isNew) {
                              return (
                                <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                  <Sparkles size={10} />
                                  <span>Pasien Baru</span>
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {patient.umurKorban} Th • {patient.jkKorban}
                        </span>
                        {patient.kontakKorban && patient.kontakKorban !== "-" && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Tel: {patient.kontakKorban}
                          </div>
                        )}
                      </td>

                      {/* Kelurahan & Alamat */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="inline-block font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                          Kel. {patient.kelurahan}
                        </span>
                        <p className="text-[11px] text-slate-500 truncate max-w-[180px] mt-0.5">
                          {patient.alamatKorban || "-"}
                        </p>
                      </td>

                      {/* HPR & Hewan */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-800">
                          {patient.spesiesHPR} {patient.rasHewan ? `(${patient.rasHewan})` : ""}
                        </div>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 ${
                          patient.statusHewanObservasi.includes("Mati") || patient.statusHewanObservasi.includes("Positif")
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {patient.statusHewanObservasi}
                        </span>
                      </td>

                      {/* Observasi 14 Hari Progress */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                          <span>Hari ke-{patient.hariObservasiKe || 1} / 14</span>
                          <span className="text-[10px] text-slate-400">
                            {Math.round(((patient.hariObservasiKe || 1) / 14) * 100)}%
                          </span>
                        </div>
                        <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (patient.hariObservasiKe || 1) >= 14 ? "bg-emerald-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${Math.min(100, ((patient.hariObservasiKe || 1) / 14) * 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Status Pemantauan Badge */}
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            patient.statusPemantauan === "Selesai Observasi (14 Hari)"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : patient.statusPemantauan === "Perlu Follow-up VAR"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {patient.statusPemantauan}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Update Status Button */}
                          <button
                            id={`btn-update-patient-${patient.id_kasus}`}
                            type="button"
                            onClick={() => setSelectedPatientForUpdate(patient)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white px-2.5 py-1.5 text-xs font-bold transition shadow-2xs cursor-pointer"
                            title="Update status pemantauan & log harian"
                          >
                            <Activity size={12} />
                            <span>Update</span>
                          </button>

                          {/* Detail Button */}
                          <button
                            id={`btn-detail-patient-${patient.id_kasus}`}
                            type="button"
                            onClick={() => setSelectedPatientForDetail(patient)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                            title="Lihat resume kartu pemantauan"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Edit Full Form Button */}
                          <button
                            id={`btn-edit-full-${patient.id_kasus}`}
                            type="button"
                            onClick={() => onEditFullFormCase(patient)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 text-blue-700 transition cursor-pointer"
                            title="Buka form penyelidikan PE GHPR lengkap"
                          >
                            <Edit3 size={14} />
                          </button>

                          {/* Delete Button (HANYA tampil untuk username admin) */}
                          {canDelete && (
                            <button
                              id={`btn-delete-patient-${patient.id_kasus}`}
                              type="button"
                              onClick={() => setSelectedPatientForDelete(patient)}
                              className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 transition cursor-pointer"
                              title="Hapus dari tampilan layar pemantauan (selesai observasi)"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards View */}
            <div className="md:hidden divide-y divide-slate-200">
              {displayedPatients.map((patient) => (
                <div key={patient.id_kasus} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                      {patient.id_kasus}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        patient.statusPemantauan === "Selesai Observasi (14 Hari)"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : patient.statusPemantauan === "Perlu Follow-up VAR"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-blue-50 text-blue-800 border-blue-200"
                      }`}
                    >
                      {patient.statusPemantauan}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900">{patient.namaKorban}</h4>
                      {(() => {
                        const badge = checkPatientNotificationBadge(patient);
                        if (badge.isDue) {
                          return (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md flex items-center gap-0.5 animate-pulse">
                              <Clock size={10} />
                              <span>{badge.dueLabel || "Jatuh Tempo"}</span>
                            </span>
                          );
                        }
                        if (badge.isNew) {
                          return (
                            <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                              <Sparkles size={10} />
                              <span>Pasien Baru</span>
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-slate-500">
                      {patient.umurKorban} Th • Kel. <b>{patient.kelurahan}</b>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      HPR: <b>{patient.spesiesHPR}</b> ({patient.statusHewanObservasi})
                    </p>
                  </div>

                  {/* Progress Observasi */}
                  <div className="bg-slate-50 rounded-xl p-2.5 space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-700">
                      <span>Observasi Hari ke-{patient.hariObservasiKe || 1} / 14</span>
                      <span>{Math.round(((patient.hariObservasiKe || 1) / 14) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.min(100, ((patient.hariObservasiKe || 1) / 14) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Buttons Mobile */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPatientForDetail(patient)}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Detail</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditFullFormCase(patient)}
                        className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>Form PE</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPatientForUpdate(patient)}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Activity size={13} />
                        <span>Update</span>
                      </button>
                      {/* Delete Button Mobile (Hanya tampil untuk username admin & widodo) */}
                      {canDelete && (
                        <button
                          id={`btn-delete-patient-mob-${patient.id_kasus}`}
                          type="button"
                          onClick={() => setSelectedPatientForDelete(patient)}
                          className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition cursor-pointer"
                          title="Hapus data pemantauan"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Update Patient Modal */}
      <PatientUpdateModal
        isOpen={!!selectedPatientForUpdate}
        onClose={() => setSelectedPatientForUpdate(null)}
        patient={selectedPatientForUpdate}
        currentUser={currentUser}
        onPatientUpdated={handlePatientUpdated}
        onOpenFullFormEdit={onEditFullFormCase}
        webAppUrl={webAppUrl}
      />

      {/* Patient Detail Modal */}
      <PatientDetailModal
        isOpen={!!selectedPatientForDetail}
        onClose={() => setSelectedPatientForDetail(null)}
        patient={selectedPatientForDetail}
        currentUser={currentUser}
        onOpenUpdateModal={(p) => setSelectedPatientForUpdate(p)}
        onOpenFullFormEdit={onEditFullFormCase}
      />

      {/* Delete Confirmation Modal */}
      <DeletePatientConfirmModal
        isOpen={!!selectedPatientForDelete}
        onClose={() => setSelectedPatientForDelete(null)}
        patient={selectedPatientForDelete}
        currentUser={currentUser}
        onConfirmDelete={handleDeleteConfirmed}
      />

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <LogOut size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Konfirmasi Keluar (Log Out)
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin keluar dari akun <span className="font-bold text-slate-800">{currentUser.nama}</span>? Anda akan dialihkan ke layar login petugas.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-logout"
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
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
