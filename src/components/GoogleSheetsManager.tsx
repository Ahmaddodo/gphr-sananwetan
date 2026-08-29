import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  Code2,
  Trash2,
  AlertCircle,
  Database,
  Link2,
  Sparkles,
  Send,
  HelpCircle,
  PlayCircle,
  Loader2,
  KeyRound,
  Users,
  Github,
  FilePlus
} from "lucide-react";
import {
  ConnectedSheetConfig,
  getAppsScriptTemplateCode,
  saveSheetConfig,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
  DEFAULT_WEB_APP_URL,
  sendToAppsScript,
  repairSpreadsheetStructure
} from "../lib/googleSheets";
import {
  syncOfficerProfilesFromGoogleSheets,
  syncPatientsFromGoogleSheets
} from "../lib/patientMonitoring";
import { OfficerAccountManager } from "./OfficerAccountManager";
import { GitHubSyncManager } from "./GitHubSyncManager";
import { AdminDeviceSyncPanel } from "./AdminDeviceSyncPanel";
import { AdminFlexiblePatientForm } from "./AdminFlexiblePatientForm";

interface GoogleSheetsManagerProps {
  sheetConfig: ConnectedSheetConfig | null;
  setSheetConfig: (config: ConnectedSheetConfig | null) => void;
  webAppUrl: string;
  setWebAppUrl: (url: string) => void;
  initialTab?: "accounts" | "sync" | "sheets" | "github" | "flexible_form";
  onAccountsUpdated?: () => void;
  onSwitchToMonitoring?: () => void;
}

export const GoogleSheetsManager: React.FC<GoogleSheetsManagerProps> = ({
  sheetConfig,
  setSheetConfig,
  webAppUrl,
  setWebAppUrl,
  initialTab = "accounts",
  onAccountsUpdated,
  onSwitchToMonitoring
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<"accounts" | "sync" | "sheets" | "github" | "flexible_form">(initialTab);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveAdminTab(initialTab);
    }
  }, [initialTab]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [localEndpointInput, setLocalEndpointInput] = useState(webAppUrl);
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const [isRepairingSheet, setIsRepairingSheet] = useState(false);
  const [repairResult, setRepairResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setLocalEndpointInput(webAppUrl);
  }, [webAppUrl]);

  const normalizeEndpointUrl = (raw: string): string => {
    let u = raw.trim();
    if (!u) return DEFAULT_WEB_APP_URL;
    if (u.includes("docs.google.com/spreadsheets/")) return u;
    
    // Perbaiki jika bagian awal URL terpotong saat disalin
    if (!u.startsWith("http")) {
      if (u.startsWith("AKfycb")) {
        u = `https://script.google.com/macros/s/${u}`;
      } else if (u.startsWith("wUedDGkOK") || u.startsWith("wUed")) {
        u = `https://script.google.com/macros/s/AKfycb${u}`;
      } else if (u.startsWith("script.google.com")) {
        u = `https://${u.replace(/^\/+/, "")}`;
      } else if (u.includes("/exec")) {
        u = `https://script.google.com/macros/s/${u.replace(/^\/+/, "")}`;
      }
    }
    return u;
  };

  const validateEndpointUrl = (url: string): string | null => {
    const trimmed = normalizeEndpointUrl(url);
    if (!trimmed) return "URL Web App tidak boleh kosong.";
    if (trimmed.includes("docs.google.com/spreadsheets/")) {
      return "URL yang dimasukkan adalah link Spreadsheet, BUKAN link Web App. Salin URL Web App yang berakhiran '/exec' dari menu Deploy Apps Script.";
    }
    if (trimmed.includes("script.google.com/home/projects/") || trimmed.includes("/edit")) {
      return "URL ini adalah link editor skrip (/edit). Silakan klik Deploy > New Deployment > pilih Web App untuk mendapatkan URL yang berakhiran '/exec'.";
    }
    if (!trimmed.startsWith("http")) {
      return "URL harus diawali dengan https://";
    }
    return null;
  };

  const handleSaveEndpoint = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setTestResult(null);

    const normalized = normalizeEndpointUrl(localEndpointInput);
    const validationError = validateEndpointUrl(normalized);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setLocalEndpointInput(normalized);
    setWebAppUrl(normalized);
    try {
      localStorage.setItem("ghpr_google_sheets_url_v1", normalized);
      setSuccessMsg("Web App Endpoint URL berhasil disimpan! Menyinkronkan data petugas & pasien dari spreadsheet...");

      // Tarik seketika data petugas dan pasien dari spreadsheet baru agar data lokal diperbarui
      syncOfficerProfilesFromGoogleSheets(normalized).then((res) => {
        if (onAccountsUpdated) onAccountsUpdated();
      });
      syncPatientsFromGoogleSheets(normalized);

      setTimeout(() => setSuccessMsg(""), 4500);
    } catch (e) {
      console.warn("Gagal menyimpan ke localStorage:", e);
    }
  };

  const handleResetToDefault = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setTestResult(null);
    setLocalEndpointInput(DEFAULT_WEB_APP_URL);
    setWebAppUrl(DEFAULT_WEB_APP_URL);
    try {
      localStorage.setItem("ghpr_google_sheets_url_v1", DEFAULT_WEB_APP_URL);
      setSuccessMsg("URL Web App telah dikembalikan ke URL aktif bawaan!");
      syncOfficerProfilesFromGoogleSheets(DEFAULT_WEB_APP_URL).then(() => {
        if (onAccountsUpdated) onAccountsUpdated();
      });
      syncPatientsFromGoogleSheets(DEFAULT_WEB_APP_URL);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (e) {
      console.warn("Gagal reset URL:", e);
    }
  };

  const handleTestEndpoint = async () => {
    setErrorMsg("");
    setTestResult(null);

    const normalized = normalizeEndpointUrl(localEndpointInput);
    const validationError = validateEndpointUrl(normalized);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    setLocalEndpointInput(normalized);

    setIsTestingEndpoint(true);
    const testPayload = {
      id_kasus: "TEST-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(),
      timestamp_submit: new Date().toLocaleString("id-ID"),
      waktuKejadian: new Date().toISOString().slice(0, 16).replace("T", " "),
      alamatKejadian: "Jl. Sudanco Supriyadi No. 22 (Uji Sistem)",
      kelurahan: "Sananwetan",
      kecamatan: "Sananwetan",
      kabupatenKota: "Kota Blitar",
      provinsi: "Jawa Timur",
      sumberInfo: "Pengujian Langsung Web App",
      kronologi: "Pengujian transmisi data dari tombol Uji Coba Endpoint di Aplikasi Web Form GHPR.",
      spesiesHPR: "Anjing",
      ras: "Lokal",
      jkHewan: "Jantan",
      umurHewan: "1 Tahun",
      metodePelihara: "Deliarkan",
      kondisiHewan: "Sehat / Normal",
      riwayatVaksin: "Sudah Pernah",
      tanggalVaksin: "2026-01-10",
      pemilikHewan: "Bpk. Tester",
      alamatPemilik: "Sananwetan Kota Blitar",
      kontakPemilik: "081234567890",
      namaKorban: "Uji Coba Sistem",
      noHpKorban: "081234567890",
      umurKorban: "30 Tahun",
      alamatKorban: "Kota Blitar",
      jkKorban: "Laki-laki",
      kondisiLuka: "Kategori 2",
      lokasiLuka: "Tangan",
      pertolonganPertama: "Cuci Sabun 15 Menit",
      tindakanKasus: "Observasi & Profilaksis",
      rekomendasi: "Uji coba berhasil.",
      timKetua: "dr. Widodo",
      timAnggota: "Petugas Surveilans",
      tanggalPelaksanaan: new Date().toISOString().slice(0, 10),
      pelaksanaNama: "Widodo",
      pelaksanaNIP: "198501012010011001"
    };

    try {
      // Simpan URL terlebih dahulu
      setWebAppUrl(normalized);
      localStorage.setItem("ghpr_google_sheets_url_v1", normalized);

      await sendToAppsScript(normalized, testPayload);

      setTestResult({
        status: "success",
        message: `Paket data uji coba (${testPayload.id_kasus}) telah dikirimkan ke Google Apps Script! Silakan buka Google Spreadsheet Anda untuk memeriksa baris baru.`
      });
    } catch (err: any) {
      setTestResult({
        status: "error",
        message: `Pengiriman gagal: ${err?.message || "Koneksi terputus"}. Pastikan di Apps Script 'Who has access' diset 'Anyone'.`
      });
    } finally {
      setIsTestingEndpoint(false);
    }
  };

  const handleRepairSpreadsheet = async () => {
    const target = localEndpointInput.trim() || webAppUrl.trim();
    if (!target) {
      setRepairResult({
        status: "error",
        message: "URL Web App belum diatur. Mohon isi URL Web App terlebih dahulu."
      });
      return;
    }

    setIsRepairingSheet(true);
    setRepairResult(null);

    try {
      const res = await repairSpreadsheetStructure(target);
      setRepairResult({
        status: res.success ? "success" : "error",
        message: res.message
      });
    } catch (err: any) {
      setRepairResult({
        status: "error",
        message: `Gagal mengirim instruksi perbaikan: ${err?.message || "Kesalahan jaringan"}`
      });
    } finally {
      setIsRepairingSheet(false);
    }
  };

  const handleConnectRealSheet = () => {
    setErrorMsg("");
    setSuccessMsg("");

    const title = "Laporan GHPR - UPT Puskesmas Sananwetan";
    const rawInput = sheetUrlInput.trim();

    if (!rawInput) {
      setErrorMsg("Mohon masukkan URL atau ID Google Spreadsheet.");
      return;
    }

    // Jika pengguna tidak sengaja menempelkan URL Web App Apps Script di kolom ini
    if (rawInput.includes("script.google.com/macros/s/")) {
      setWebAppUrl(rawInput);
      setLocalEndpointInput(rawInput);
      localStorage.setItem("ghpr_google_sheets_url_v1", rawInput);
      setSheetUrlInput("");
      setSuccessMsg("Terdeteksi URL Apps Script Web App! URL telah otomatis disimpan ke kolom Web App Endpoint.");
      setTimeout(() => setSuccessMsg(""), 4500);
      return;
    }

    let realUrl = rawInput;
    let realId = rawInput;

    const match = rawInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      realId = match[1];
      realUrl = `https://docs.google.com/spreadsheets/d/${realId}/edit`;
    } else if (!rawInput.startsWith("http")) {
      realUrl = `https://docs.google.com/spreadsheets/d/${rawInput}/edit`;
    }

    const config: ConnectedSheetConfig = {
      spreadsheetId: realId,
      spreadsheetUrl: realUrl,
      spreadsheetTitle: title,
      createdAt: new Date().toLocaleDateString("id-ID"),
      sheetName: "Data Laporan GHPR",
      totalRecorded: 0
    };

    saveSheetConfig(config);
    setSheetConfig(config);
    setSuccessMsg(`Google Spreadsheet baru (${realId.slice(0, 8)}...) berhasil dihubungkan! Menyinkronkan data petugas & kasus...`);
    setSheetUrlInput("");

    // Tarik seketika data dari sheet baru
    syncOfficerProfilesFromGoogleSheets().then(() => {
      if (onAccountsUpdated) onAccountsUpdated();
    });
    syncPatientsFromGoogleSheets();

    setTimeout(() => setSuccessMsg(""), 4500);
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(getAppsScriptTemplateCode());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDisconnect = () => {
    if (confirm("Apakah Anda yakin ingin memutuskan sambungan dari Google Spreadsheet ini?")) {
      saveSheetConfig(null);
      setSheetConfig(null);
      setSuccessMsg("Koneksi Google Spreadsheet telah dilepas.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  const currentSheetUrl =
    sheetConfig?.spreadsheetUrl && !sheetConfig.spreadsheetUrl.includes("script.google.com")
      ? sheetConfig.spreadsheetUrl
      : DEFAULT_SPREADSHEET_URL;
  const currentSheetId =
    sheetConfig?.spreadsheetId && !sheetConfig.spreadsheetId.includes("script.google.com")
      ? sheetConfig.spreadsheetId
      : DEFAULT_SPREADSHEET_ID;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      {/* Header Panel */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Panel Pengembang & Administrator Sistem
            </h3>
            <p className="text-xs text-slate-500">
              Kelola kredensial login (username & password petugas) dan integrasi Google Sheets.
            </p>
          </div>
        </div>

        {activeAdminTab === "sheets" && (
          <button
            type="button"
            onClick={() => setShowAppsScriptModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs hover:bg-blue-100 transition cursor-pointer shadow-sm"
          >
            <Code2 size={14} className="text-blue-600" />
            Lihat Kode Script & Panduan
          </button>
        )}
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveAdminTab("flexible_form")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === "flexible_form"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
          }`}
        >
          <FilePlus size={15} />
          <span>Input Pasien Baru (Salinan Form Bebas)</span>
          <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded">
            Tanpa Bintang *
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab("accounts")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === "accounts"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          <KeyRound size={15} />
          <span>Atur Username & Password Petugas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab("sync")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === "sync"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          <Users size={15} />
          <span>Sinkronisasi Sumber Admin (Multi-Perangkat)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab("sheets")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === "sheets"
              ? "bg-teal-700 text-white shadow-xs"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          <FileSpreadsheet size={15} />
          <span>Koneksi Google Sheets & Endpoint</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab("github")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeAdminTab === "github"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          <Github size={15} />
          <span>Sinkronisasi Repositori GitHub</span>
        </button>
      </div>

      {/* TAB 0: SALINAN FORMULIR PE GHPR (INPUT PASIEN BARU FLEKSIBEL - TANPA BINTANG) */}
      {activeAdminTab === "flexible_form" && (
        <AdminFlexiblePatientForm
          webAppUrl={webAppUrl}
          onSwitchToMonitoring={onSwitchToMonitoring}
        />
      )}

      {/* TAB 1: MANAJEMEN AKUN PETUGAS */}
      {activeAdminTab === "accounts" && (
        <OfficerAccountManager onAccountsUpdated={onAccountsUpdated} />
      )}

      {/* TAB 2: SINKRONISASI SUMBER ADMIN (MULTI-PERANGKAT) */}
      {activeAdminTab === "sync" && (
        <AdminDeviceSyncPanel
          webAppUrl={webAppUrl}
          sheetConfig={sheetConfig}
          onDataSynced={onAccountsUpdated}
        />
      )}

      {/* TAB 3: INTEGRASI GOOGLE SHEETS */}
      {activeAdminTab === "sheets" && (
        <>
          {/* STATUS TERHUBUNG: SPREADSHEET & WEB APP ENDPOINT */}
          <div className="rounded-xl bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-blue-50/70 border border-emerald-200 p-4 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SPREADSHEET TARGET */}
          <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-emerald-200/60 pb-3 md:pb-0 md:pr-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database size={14} className="text-emerald-600" /> 1. Spreadsheet Target (Tempat Melihat Data)
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {sheetConfig?.spreadsheetTitle || "Laporan PE GHPR - UPT Puskesmas Sananwetan"}
            </div>
            <div className="text-xs font-mono text-slate-700 bg-white/90 border border-emerald-200 px-2 py-0.5 rounded inline-block">
              ID: <b>{currentSheetId}</b>
            </div>
            <div className="pt-1">
              <a
                href={currentSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <FileSpreadsheet size={14} /> Buka Spreadsheet di Google Drive <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* WEB APP ENDPOINT AKTIF */}
          <div className="space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Send size={14} className="text-blue-600" /> 2. Web App Endpoint Aktif (Perekam Data)
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">
                  {webAppUrl ? "Tersimpan" : "Belum Diatur"}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-800 bg-white/90 border border-blue-200 p-2 rounded break-all mt-1 max-h-16 overflow-y-auto leading-relaxed">
                {webAppUrl || <span className="text-slate-400 italic">Belum ada URL Web App</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DUA KOLOM: WEB APP ENDPOINT & GANTI SPREADSHEET */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* KOLOM 1: WEB APP ENDPOINT URL */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wide">
                <Send size={15} className="text-blue-600" />
                Google Apps Script Web App Endpoint
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Perekam Data
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              URL deployment dari Google Apps Script spreadsheet Anda yang bertugas menambahkan baris baru saat submit.
            </p>

            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Web App URL (berakhiran /exec) *
                </label>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  title="Gunakan URL Web App resmi bawaan"
                >
                  Kembalikan ke URL Bawaan
                </button>
              </div>
              <input
                type="text"
                value={localEndpointInput}
                onChange={(e) => setLocalEndpointInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-inner"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEndpoint}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 size={15} /> Simpan URL
              </button>
              <button
                type="button"
                onClick={handleTestEndpoint}
                disabled={isTestingEndpoint}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
                title="Kirim 1 baris data tes ke Google Sheets untuk memeriksa apakah URL Web App aktif"
              >
                {isTestingEndpoint ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Menguji...
                  </>
                ) : (
                  <>
                    <PlayCircle size={14} /> Uji Kirim Data
                  </>
                )}
              </button>
              {localEndpointInput && (
                <a
                  href={`${localEndpointInput.trim()}${localEndpointInput.includes("?") ? "&" : "?"}test=browser`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm"
                  title="Buka URL Web App di Tab Baru untuk menguji respon langsung dari server Google"
                >
                  <ExternalLink size={13} /> Buka di Tab Baru
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowAppsScriptModal(true)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
                title="Panduan Deployment"
              >
                <HelpCircle size={14} className="text-slate-500" /> Panduan
              </button>
            </div>

            {localEndpointInput && (
              <div className="text-[11px] text-slate-500 bg-white/80 border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                <span>Tips: Klik <b>Buka di Tab Baru</b> untuk melihat apakah server Google membalas <code>status: ok</code>.</span>
              </div>
            )}

            {testResult && (
              <div
                className={`rounded-lg p-2.5 text-xs font-medium flex items-start gap-2 ${
                  testResult.status === "success"
                    ? "bg-emerald-100/90 text-emerald-900 border border-emerald-300"
                    : "bg-rose-100/90 text-rose-900 border border-rose-300"
                }`}
              >
                {testResult.status === "success" ? (
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-700 mt-0.5" />
                ) : (
                  <AlertCircle size={15} className="shrink-0 text-rose-700 mt-0.5" />
                )}
                <div className="flex-1 leading-snug">{testResult.message}</div>
              </div>
            )}
          </div>
        </div>

        {/* KOLOM 2: HUBUNGKAN / GANTI SPREADSHEET */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wide">
              <Link2 size={15} className="text-emerald-600" />
              Ganti Google Spreadsheet Target
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Jika ingin mengarahkan penyimpanan ke spreadsheet Google Drive yang lain, masukkan URL atau ID di bawah.
            </p>

            <div className="pt-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                URL / ID Spreadsheet Baru
              </label>
              <input
                type="text"
                value={sheetUrlInput}
                onChange={(e) => setSheetUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2">
            <a
              href="https://sheets.new"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-bold underline"
            >
              <Sparkles size={12} /> Buat Sheet Baru (sheets.new)
            </a>
            <button
              type="button"
              onClick={handleConnectRealSheet}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <CheckCircle2 size={15} /> Simpan Sheet
            </button>
          </div>
        </div>
      </div>

      {/* PANEL PERBAIKAN STRUKTUR SPREADSHEET & PEMULIHAN KOLOM BERGESER */}
      <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50/90 to-amber-100/40 p-4.5 space-y-3.5 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500 text-white font-black text-xs shadow-xs">
                ⚡
              </span>
              <h4 className="font-bold text-amber-950 text-xs uppercase tracking-wide">
                Solusi Kolom Bergeser & Pemulihan Spreadsheet Otomatis (46 Kolom Resmi Lengkap)
              </h4>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed max-w-3xl">
              Jika data yang masuk ke Google Sheet Anda sebelumnya bergeser atau Anda telah memperluas hingga kolom 46 (mencakup status pemantauan harian, suhu tubuh, dan jadwal vaksinasi VAR dosis 0, 3, 7, 21), gunakan fitur ini untuk menata ulang 46 kolom resmi secara otomatis.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyAppsScript}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-amber-300 hover:bg-amber-50 text-amber-900 font-bold text-xs shadow-xs transition cursor-pointer"
              title="Salin kode Google Apps Script terbaru"
            >
              {copiedCode ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span className="text-emerald-700">Kode Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy size={14} className="text-amber-700" />
                  <span>Salin Skrip Baru</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRepairSpreadsheet}
              disabled={isRepairingSheet}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition cursor-pointer"
            >
              {isRepairingSheet ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Merapikan Spreadsheet...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Perbaiki & Rapikan Spreadsheet Otomatis
                </>
              )}
            </button>
          </div>
        </div>

        {repairResult && (
          <div
            className={`rounded-lg p-3 text-xs font-medium flex items-start gap-2 ${
              repairResult.status === "success"
                ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                : "bg-rose-100 text-rose-950 border border-rose-300"
            }`}
          >
            {repairResult.status === "success" ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-700 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 text-rose-700 mt-0.5" />
            )}
            <div className="flex-1 leading-relaxed">{repairResult.message}</div>
          </div>
        )}

        <div className="bg-white/80 border border-amber-200/80 rounded-lg p-3 text-[11px] text-amber-950 space-y-1.5">
          <div className="font-bold text-amber-900 flex items-center gap-1">
            <CheckCircle2 size={13} className="text-amber-600" />
            3 Langkah Memastikan Sinkronisasi Spreadsheet Sempurna:
          </div>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-700 pl-1">
            <li>Buka spreadsheet Anda &gt; menu <b>Ekstensi</b> &gt; <b>Apps Script</b>.</li>
            <li>Hapus kode lama di <code>Code.gs</code>, lalu <b>Paste (Tempel)</b> kode baru yang disalin dari tombol di atas, lalu <b>Simpan (Ctrl+S)</b>.</li>
            <li>Klik tombol <b>Terapkan (Deploy)</b> &gt; <b>Kelola Penerapan</b> &gt; ikon pensil &gt; <b>Versi Baru</b> &gt; <b>Terapkan</b> (atau Penerapan Baru &gt; Web App &gt; Anyone &gt; Terapkan).</li>
          </ol>
        </div>
      </div>

      {/* ALERT / MESSAGE NOTIFICATION */}
      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
        </>
      )}

      {/* TAB 3: SINKRONISASI REPOSITORI GITHUB */}
      {activeAdminTab === "github" && (
        <GitHubSyncManager />
      )}

      {/* MODAL GOOGLE APPS SCRIPT CODE TEMPLATE */}
      {showAppsScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 size={18} className="text-blue-400" />
                <h3 className="font-bold text-sm">Kode Google Apps Script & Cara Pasang</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAppsScriptModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs text-slate-700">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 space-y-1.5">
                <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-600" /> Langkah Pemasangan & Uji Coba (2 Menit):
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1 leading-relaxed">
                  <li>
                    Buka Spreadsheet Anda (
                    <a
                      href={currentSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 underline font-semibold"
                    >
                      Klik Di Sini untuk Membuka
                    </a>
                    ).
                  </li>
                  <li>
                    Klik menu <b>Ekstensi</b> (<i>Extensions</i>) &gt; <b>Apps Script</b>.
                  </li>
                  <li>Hapus seluruh kode lama dan tempelkan kode di bawah ini.</li>
                  <li>
                    <b>Uji Coba Langsung di Editor:</b> Pada menu dropdown fungsi (di sebelah tombol 'Jalankan'), pilih <b>testSimpanData</b> lalu klik <b>Jalankan (Run)</b>. Berikan izin akses (<i>Review Permissions</i> &gt; <i>Advanced</i> &gt; <i>Allow</i>). Data uji coba akan langsung muncul di Spreadsheet Anda!
                  </li>
                  <li>
                    Klik tombol <b>Deploy (Terapkan)</b> &gt; <b>New deployment (Penerapan baru)</b> &gt; Pilih ikon roda gigi ⚙️ <b>Web App</b>.
                  </li>
                  <li>
                    Atur <b>Execute as: Me</b> dan <b>Who has access: Anyone (Siapa saja)</b> (<i>Wajib agar formulir web bisa mengirim data</i>).
                  </li>
                  <li>Salin <b>Web App URL</b> (yang berakhiran <code>/exec</code>) dan tempelkan ke kolom Web App Endpoint di atas.</li>
                </ol>
              </div>

              <div className="relative pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Kode Google Apps Script (doPost)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAppsScript}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check size={13} /> Berhasil Tersalin!
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Salin Kode Script
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-64 border border-slate-800 select-all">
                  {getAppsScriptTemplateCode()}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <a
                href={currentSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold text-xs"
              >
                <ExternalLink size={13} /> Buka Spreadsheet Target
              </a>
              <button
                type="button"
                onClick={() => setShowAppsScriptModal(false)}
                className="rounded-lg bg-slate-800 text-white px-5 py-2 text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


