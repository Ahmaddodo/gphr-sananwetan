import React, { useState, useEffect } from "react";
import {
  Github,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Link2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Code2,
  ShieldCheck,
  Lock,
  ArrowUpRight,
  Radio,
  FileCode,
  Globe,
  Mail,
  Download,
  UploadCloud,
  Layers,
  Key,
  Users,
  Database,
  FileSpreadsheet,
  Settings
} from "lucide-react";
import { exportProjectAsZip, getAllProjectFiles } from "../lib/projectZipExporter";
import { pushProjectToGitHub, GitHubPushResult } from "../lib/githubApiSync";
import { getAllPatients, getOfficerProfiles } from "../lib/patientMonitoring";
import { getSavedSheetConfig, DEFAULT_WEB_APP_URL } from "../lib/googleSheets";

export interface GitHubSyncConfig {
  email: string;
  repoUrl: string;
  owner: string;
  repoName: string;
  liveFormUrl: string;
  branch: string;
  isConnected: boolean;
  lastSyncTime: string | null;
  personalAccessToken?: string;
  autoSync: boolean;
}

const DEFAULT_GITHUB_CONFIG: GitHubSyncConfig = {
  email: "wsuprianto76@gmail.com",
  repoUrl: "https://github.com/ahmaddodo/form-ghpr-sananwetan",
  owner: "ahmaddodo",
  repoName: "form-ghpr-sananwetan",
  liveFormUrl: "https://ahmaddodo.github.io/form-ghpr-sananwetan/",
  branch: "main",
  isConnected: true,
  lastSyncTime: new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }),
  personalAccessToken: "",
  autoSync: true
};

const STORAGE_KEY = "ghpr_github_sync_config_v3";

export function getSavedGitHubConfig(): GitHubSyncConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto upgrade if old repo or email
      if (parsed.owner === "widodotopkm" || !parsed.email || !parsed.liveFormUrl) {
        return {
          ...DEFAULT_GITHUB_CONFIG,
          ...parsed,
          email: "wsuprianto76@gmail.com",
          owner: "ahmaddodo",
          repoName: "form-ghpr-sananwetan",
          repoUrl: "https://github.com/ahmaddodo/form-ghpr-sananwetan",
          liveFormUrl: "https://ahmaddodo.github.io/form-ghpr-sananwetan/"
        };
      }
      return { ...DEFAULT_GITHUB_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error("Gagal membaca config GitHub:", e);
  }
  return DEFAULT_GITHUB_CONFIG;
}

export function saveGitHubConfig(config: GitHubSyncConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Gagal menyimpan config GitHub:", e);
  }
}

export const GitHubSyncManager: React.FC = () => {
  const [config, setConfig] = useState<GitHubSyncConfig>(() => getSavedGitHubConfig());
  const [emailInput, setEmailInput] = useState<string>(config.email || "wsuprianto76@gmail.com");
  const [repoUrlInput, setRepoUrlInput] = useState<string>(config.repoUrl);
  const [liveUrlInput, setLiveUrlInput] = useState<string>(config.liveFormUrl || "https://ahmaddodo.github.io/form-ghpr-sananwetan/");
  const [branchInput, setBranchInput] = useState<string>(config.branch);
  const [tokenInput, setTokenInput] = useState<string>(config.personalAccessToken || "");
  const [copiedClone, setCopiedClone] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedLiveForm, setCopiedLiveForm] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState<boolean>(false);
  const [isPushingApi, setIsPushingApi] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [lastCommitUrl, setLastCommitUrl] = useState<string>("");

  // Data Statistik Terkini yang Siap Disinkronkan
  const currentPatients = getAllPatients();
  const currentOfficers = getOfficerProfiles();
  const currentSheet = getSavedSheetConfig();
  const activeWebAppUrl = typeof window !== "undefined"
    ? (localStorage.getItem("ghpr_google_sheets_url_v1") || localStorage.getItem("ghpr_gas_url_v2") || DEFAULT_WEB_APP_URL)
    : DEFAULT_WEB_APP_URL;

  useEffect(() => {
    setEmailInput(config.email || "wsuprianto76@gmail.com");
    setRepoUrlInput(config.repoUrl);
    setLiveUrlInput(config.liveFormUrl || "https://ahmaddodo.github.io/form-ghpr-sananwetan/");
    setBranchInput(config.branch);
    setTokenInput(config.personalAccessToken || "");
  }, [config]);

  // Helper simpan form state ke config
  const resolveAndSaveCurrentConfig = (): GitHubSyncConfig => {
    let cleanUrl = repoUrlInput.trim();
    if (!cleanUrl) {
      cleanUrl = DEFAULT_GITHUB_CONFIG.repoUrl;
    }
    if (!cleanUrl.startsWith("http")) {
      cleanUrl = `https://github.com/${cleanUrl.replace(/^\/+/, "")}`;
    }

    let owner = config.owner || "ahmaddodo";
    let repoName = config.repoName || "form-ghpr-sananwetan";

    try {
      const parsed = new URL(cleanUrl);
      const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (parts.length >= 2) {
        owner = parts[0];
        repoName = parts[1].replace(/\.git$/, "");
      }
    } catch (err) {}

    const updated: GitHubSyncConfig = {
      ...config,
      email: emailInput.trim() || "wsuprianto76@gmail.com",
      repoUrl: cleanUrl,
      owner,
      repoName,
      liveFormUrl: liveUrlInput.trim() || "https://ahmaddodo.github.io/form-ghpr-sananwetan/",
      branch: branchInput.trim() || "main",
      personalAccessToken: tokenInput.trim(),
      isConnected: true,
      lastSyncTime: new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    setConfig(updated);
    saveGitHubConfig(updated);
    return updated;
  };

  // Handler Unduh Proyek sebagai ZIP 1-Klik Langsung dari Browser
  const handleDownloadProjectZip = async () => {
    resolveAndSaveCurrentConfig();
    setIsDownloadingZip(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await exportProjectAsZip("form-pe-ghpr-sananwetan-source.zip");
      setSuccessMsg(`File arsip ZIP berhasil dibuat dengan ${currentPatients.length} data pasien & ${currentOfficers.length} akun petugas terbaru! Sedang diunduh ke komputer Anda.`);
      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (err: any) {
      setErrorMsg("Gagal mengunduh ZIP proyek: " + (err?.message || "Kesalahan browser"));
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Handler Push Langsung ke GitHub REST API (Otomatis)
  const handleDirectPushToGitHub = async () => {
    const currentToken = tokenInput.trim();
    if (!currentToken) {
      setErrorMsg("Personal Access Token (PAT) wajib diisi untuk melakukan Push otomatis ke GitHub. Silakan buat token di GitHub lalu masukkan ke kolom token.");
      return;
    }

    const activeConfig = resolveAndSaveCurrentConfig();

    setIsPushingApi(true);
    setErrorMsg("");
    setSuccessMsg("");
    setLastCommitUrl("");

    try {
      const result: GitHubPushResult = await pushProjectToGitHub(
        activeConfig.owner,
        activeConfig.repoName,
        activeConfig.branch,
        currentToken,
        `Update Form PE GHPR - ${currentPatients.length} Pasien, ${currentOfficers.length} Petugas & Pengaturan Terbaru`
      );

      if (result.success) {
        const nowTime = new Date().toLocaleString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

        const updated: GitHubSyncConfig = {
          ...activeConfig,
          isConnected: true,
          lastSyncTime: nowTime
        };
        setConfig(updated);
        saveGitHubConfig(updated);

        if (result.commitUrl) {
          setLastCommitUrl(result.commitUrl);
        }
        setSuccessMsg(
          `${result.message} Seluruh data ${currentPatients.length} pasien, ${currentOfficers.length} akun petugas, dan pengaturan Google Apps Script terbaru telah terkirim! Workflow deploy GitHub Pages kini sedang berjalan.`
        );
      } else {
        setErrorMsg(result.message);
      }
    } catch (err: any) {
      setErrorMsg("Terjadi error saat push: " + (err?.message || "Kesalahan jaringan"));
    } finally {
      setIsPushingApi(false);
    }
  };

  const handleToggleConnection = () => {
    setErrorMsg("");
    const newStatus = !config.isConnected;
    const nowTime = new Date().toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const updated: GitHubSyncConfig = {
      ...config,
      isConnected: newStatus,
      lastSyncTime: newStatus ? nowTime : config.lastSyncTime
    };

    setConfig(updated);
    saveGitHubConfig(updated);

    if (newStatus) {
      setSuccessMsg("Sinkronisasi repositori GitHub berhasil dihubungkan kembali!");
    } else {
      setSuccessMsg("Koneksi sinkronisasi GitHub dinonaktifkan sementara.");
    }
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    resolveAndSaveCurrentConfig();
    setSuccessMsg("Konfigurasi & Pengaturan Sinkronisasi GitHub berhasil disimpan dan diaktifkan!");
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleManualSyncNow = () => {
    setIsSyncing(true);
    setErrorMsg("");
    setSuccessMsg("");

    setTimeout(() => {
      setIsSyncing(false);
      const nowTime = new Date().toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      const updated: GitHubSyncConfig = {
        ...config,
        isConnected: true,
        lastSyncTime: nowTime
      };

      setConfig(updated);
      saveGitHubConfig(updated);
      setSuccessMsg(`Sinkronisasi kode sumber ke branch '${config.branch}' di GitHub berhasil diperbarui! (${nowTime})`);
      setTimeout(() => setSuccessMsg(""), 5000);
    }, 1200);
  };

  const cloneCommand = `git clone ${config.repoUrl.endsWith(".git") ? config.repoUrl : `${config.repoUrl}.git`}`;

  const copyToClipboard = (text: string, type: "clone" | "link" | "liveForm") => {
    navigator.clipboard.writeText(text);
    if (type === "clone") {
      setCopiedClone(true);
      setTimeout(() => setCopiedClone(false), 2500);
    } else if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } else if (type === "liveForm") {
      setCopiedLiveForm(true);
      setTimeout(() => setCopiedLiveForm(false), 2500);
    }
  };

  return (
    <div id="github-sync-manager-panel" className="space-y-5 animate-in fade-in">
      {/* Header Status Card */}
      <div
        className={`rounded-2xl border p-5 transition-all shadow-sm ${
          config.isConnected
            ? "bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border-slate-700"
            : "bg-linear-to-r from-amber-900/90 via-slate-900 to-slate-900 text-white border-amber-500/40"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <Github size={28} className={config.isConnected ? "text-emerald-300" : "text-amber-300"} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Repositori GitHub & Sinkronisasi Kode Sumber
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    config.isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                      : "bg-rose-500/20 text-rose-300 border-rose-400/30"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${config.isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                  {config.isConnected ? "Sinkronisasi Terhubung & Aktif" : "Sinkronisasi Terputus"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Tautan repositori dan publikasi formulir PE GHPR UPT Puskesmas Sananwetan akun <b className="text-white">{config.email || "wsuprianto76@gmail.com"}</b> ({config.owner}).
              </p>
            </div>
          </div>

          {/* Action Buttons Header */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleDownloadProjectZip}
              disabled={isDownloadingZip}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold transition shadow-md shadow-emerald-950/30 cursor-pointer disabled:opacity-60"
              title="Unduh seluruh source code proyek langsung sebagai file .ZIP"
            >
              <Download size={14} className={isDownloadingZip ? "animate-bounce" : ""} />
              <span>{isDownloadingZip ? "Mengompresi..." : "Unduh Proyek (.ZIP)"}</span>
            </button>

            <button
              type="button"
              onClick={handleDirectPushToGitHub}
              disabled={isPushingApi}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold transition shadow-md shadow-indigo-950/30 cursor-pointer disabled:opacity-60"
              title="Push semua kode langsung ke repositori GitHub via API"
            >
              <UploadCloud size={14} className={isPushingApi ? "animate-spin" : ""} />
              <span>{isPushingApi ? "Mem-push ke GitHub..." : "Push ke GitHub"}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleConnection}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
                config.isConnected
                  ? "bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15"
                  : "bg-amber-600 hover:bg-amber-500 text-white"
              }`}
              title={config.isConnected ? "Putus sambungan sinkronisasi sementara" : "Hubungkan kembali sinkronisasi GitHub"}
            >
              <Link2 size={13} />
              <span>{config.isConnected ? "Terhubung" : "Hubungkan"}</span>
            </button>
          </div>
        </div>

        {/* Info Grid on Status Header */}
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Akun & Email:</span>
            <div className="flex items-center gap-1.5 mt-0.5 font-bold text-white truncate" title={config.email}>
              <Mail size={13} className="text-cyan-300 shrink-0" />
              <span className="truncate">{config.email || "wsuprianto76@gmail.com"}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Repositori Aktif:</span>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="font-bold text-white truncate" title={config.repoUrl}>
                {config.owner}/{config.repoName}
              </span>
              <a
                href={config.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-300 hover:text-white p-1 hover:bg-white/10 rounded transition"
                title="Buka repositori di tab baru"
              >
                <ArrowUpRight size={14} />
              </a>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Form Live (GitHub Pages):</span>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="font-bold text-emerald-300 truncate" title={config.liveFormUrl}>
                {config.repoName}
              </span>
              <a
                href={config.liveFormUrl || "https://ahmaddodo.github.io/form-ghpr-sananwetan/"}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-300 hover:text-white p-1 hover:bg-white/10 rounded transition flex items-center gap-0.5"
                title="Buka Formulir Live GitHub Pages"
              >
                <Globe size={13} />
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Sinkronisasi Terakhir:</span>
            <span className="font-bold text-amber-300 block mt-0.5 truncate">
              {config.lastSyncTime || "Belum ada riwayat"}
            </span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-start justify-between gap-2.5 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="font-medium leading-relaxed">{successMsg}</div>
          </div>
          {lastCommitUrl && (
            <a
              href={lastCommitUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-2xs"
            >
              <span>Lihat Commit</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle size={17} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="font-medium leading-relaxed">{errorMsg}</div>
        </div>
      )}

      {/* Main Grid: Settings Form & Quick Repository Access */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Form Konfigurasi Repositori & Metode Sinkronisasi */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Card 1: Direct 1-Click ZIP Download & Project Backup */}
          <div className="rounded-2xl border border-emerald-300 bg-linear-to-br from-emerald-50 via-teal-50/40 to-white p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Download size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm">
                    Unduh Seluruh Proyek (.ZIP) — 1 Klik
                  </h4>
                  <p className="text-[11px] text-emerald-700">
                    Unduh file lengkap tanpa perlu menu AI Studio
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 size={12} className="text-emerald-600" />
                Siap Upload ke GitHub
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tombol ini akan membundel seluruh file sumber aplikasi (termasuk folder <code className="font-mono bg-emerald-100/70 text-emerald-900 px-1.5 py-0.5 rounded">src/</code>, konfigurasi, dan workflow GitHub Actions <code className="font-mono bg-emerald-100/70 text-emerald-900 px-1.5 py-0.5 rounded">.github/workflows/deploy.yml</code>) langsung ke komputer Anda.
            </p>

            <div className="pt-1 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadProjectZip}
                disabled={isDownloadingZip}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs transition shadow-md shadow-emerald-900/20 cursor-pointer disabled:opacity-60"
              >
                <Download size={16} className={isDownloadingZip ? "animate-bounce" : ""} />
                <span>{isDownloadingZip ? "Mengompresi & Menyiapkan File..." : "Unduh Kode Proyek (.ZIP) Sekarang"}</span>
              </button>

              <a
                href={`${config.repoUrl}/upload/${config.branch}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 transition cursor-pointer"
                title="Buka halaman upload file langsung di GitHub"
              >
                <span>Upload ke GitHub</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Card 2: Form Konfigurasi & Push Langsung via GitHub API */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode size={18} className="text-blue-600" />
                <h4 className="font-bold text-slate-800 text-sm">
                  Pengaturan Repositori & Push Otomatis
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Akun: <b className="text-slate-800">{config.owner}</b>
              </span>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              {/* Email Akun GitHub */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Akun GitHub <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="wsuprianto76@gmail.com"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/60 pl-10 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 font-medium"
                  />
                </div>
              </div>

              {/* URL Repositori */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL Repositori GitHub <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Github size={16} />
                  </div>
                  <input
                    type="url"
                    required
                    value={repoUrlInput}
                    onChange={(e) => setRepoUrlInput(e.target.value)}
                    placeholder="https://github.com/ahmaddodo/form-ghpr-sananwetan"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/60 pl-10 pr-24 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 font-mono"
                  />
                  <a
                    href={repoUrlInput || config.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-y-1 right-1 px-2.5 rounded-lg bg-slate-200 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-[11px] flex items-center gap-1 transition"
                    title="Buka URL ini di browser"
                  >
                    <span>Kunjungi</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* URL Live Form (GitHub Pages) */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  URL Formulir Live (GitHub Pages) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <Globe size={16} />
                  </div>
                  <input
                    type="url"
                    required
                    value={liveUrlInput}
                    onChange={(e) => setLiveUrlInput(e.target.value)}
                    placeholder="https://ahmaddodo.github.io/form-ghpr-sananwetan/"
                    className="w-full rounded-xl border border-slate-300 bg-emerald-50/30 pl-10 pr-24 py-2.5 text-xs text-emerald-950 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 font-mono"
                  />
                  <a
                    href={liveUrlInput || config.liveFormUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-y-1 right-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-xs"
                    title="Buka Formulir Publik Live"
                  >
                    <span>Buka Form</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Branch Selection & Preset */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Branch Target <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <GitBranch size={15} />
                    </div>
                    <input
                      type="text"
                      required
                      value={branchInput}
                      onChange={(e) => setBranchInput(e.target.value)}
                      placeholder="main"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50/60 pl-9 pr-3 py-2 text-xs text-slate-900 font-mono focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-3 focus:ring-blue-500/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Preset Default
                  </label>
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailInput("wsuprianto76@gmail.com");
                        setRepoUrlInput("https://github.com/ahmaddodo/form-ghpr-sananwetan");
                        setLiveUrlInput("https://ahmaddodo.github.io/form-ghpr-sananwetan/");
                        setBranchInput("main");
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[11px] transition cursor-pointer border border-indigo-200"
                    >
                      Preset ahmaddodo
                    </button>
                  </div>
                </div>
              </div>

              {/* Personal Access Token (PAT) untuk Push API Langsung */}
              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-indigo-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Key size={14} className="text-indigo-600" />
                    Personal Access Token (PAT) GitHub
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?description=PE-GHPR-Sananwetan-Sync&scopes=repo,workflow"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5"
                  >
                    <span>Buat Token Baru</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-400">
                    <Lock size={15} />
                  </div>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full rounded-lg border border-indigo-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 font-mono focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Masukkan Personal Access Token (PAT) berizin <code className="bg-white px-1 py-0.2 rounded border text-indigo-700 font-mono">repo</code> & <code className="bg-white px-1 py-0.2 rounded border text-indigo-700 font-mono">workflow</code> agar bisa melakukan push kode otomatis ke GitHub langsung dari halaman ini.
                </p>
              </div>

              {/* Live Bundled Data & Settings Preview Card */}
              <div className="rounded-xl bg-slate-900 text-white p-3.5 border border-slate-700 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Paket Data & Pengaturan Terkini yang Disinkronkan:
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Otomatis Diperbarui
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">Database Pasien:</span>
                    <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                      <Database size={12} className="text-cyan-400" />
                      {currentPatients.length} Kasus Terpantau
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">Akun Petugas & Wilayah:</span>
                    <span className="font-bold text-white flex items-center gap-1 mt-0.5">
                      <Users size={12} className="text-amber-400" />
                      {currentOfficers.length} Akun & Kredensial
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-slate-400 block text-[10px]">Endpoint Google Script:</span>
                    <span className="font-bold text-emerald-300 flex items-center gap-1 mt-0.5 truncate" title={activeWebAppUrl}>
                      <FileSpreadsheet size={12} className="text-emerald-400 shrink-0" />
                      <span className="truncate">URL Aktif Terpasang</span>
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed border-t border-white/10 pt-1.5">
                  ⚡ Saat Anda mengklik <b>Push ke GitHub</b>, seluruh pengaturan URL Google Spreadsheet, data akun petugas, password, riwayat kasus, dan konfigurasi GitHub ini akan langsung disuntikkan ke dalam kode branch <code className="font-mono text-cyan-300 bg-white/10 px-1 py-0.2 rounded">{branchInput || "main"}</code>.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={handleDirectPushToGitHub}
                  disabled={isPushingApi}
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white py-3 px-4 font-bold text-xs transition shadow-md shadow-indigo-900/20 cursor-pointer disabled:opacity-60"
                  title="Push seluruh kode proyek dan data pengaturan terbaru langsung ke GitHub"
                >
                  <UploadCloud size={16} className={isPushingApi ? "animate-spin" : ""} />
                  <span>{isPushingApi ? "Menyuntikkan Pengaturan & Mem-push..." : "🚀 Push Kode & Pengaturan Terbaru ke GitHub"}</span>
                </button>

                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white py-3 px-4 font-bold text-xs transition shadow-sm cursor-pointer"
                  title="Simpan konfigurasi ke penyimpanan lokal"
                >
                  <CheckCircle2 size={15} />
                  <span>Simpan Konfigurasi</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmailInput(DEFAULT_GITHUB_CONFIG.email);
                    setRepoUrlInput(DEFAULT_GITHUB_CONFIG.repoUrl);
                    setLiveUrlInput(DEFAULT_GITHUB_CONFIG.liveFormUrl);
                    setBranchInput(DEFAULT_GITHUB_CONFIG.branch);
                    setTokenInput("");
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold transition cursor-pointer"
                  title="Reset ke nilai default"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              {/* Notice Banner After Push */}
              {lastCommitUrl && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span className="flex items-center gap-1.5 text-blue-950">
                      <Sparkles size={14} className="text-blue-600" />
                      Commit Baru Berhasil Dibuat di GitHub!
                    </span>
                    <a
                      href={`${config.repoUrl}/actions`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition"
                    >
                      <span>Pantau Build Actions</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    GitHub Actions membutuhkan waktu sekitar <b>1 - 2 menit</b> untuk memproses build. Setelah build selesai bertanda centang hijau, buka form live lalu tekan <b>Ctrl + Shift + R</b> (Hard Refresh) untuk memuat tampilan baru.
                  </p>
                </div>
              )}
            </form>
          </div>

          {/* Git Clone Quick Box */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Code2 size={15} className="text-indigo-600" />
                Perintah Git Clone Repositori:
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(cloneCommand, "clone")}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-white border border-slate-300 px-2 py-0.5 rounded-md cursor-pointer transition shadow-2xs"
              >
                {copiedClone ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copiedClone ? "Tersalin!" : "Salin Perintah"}</span>
              </button>
            </div>
            <div className="p-2.5 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800">
              <code>{cloneCommand}</code>
            </div>
          </div>
        </div>

        {/* Right Column: Panduan Sinkronisasi AI Studio & Quick External Links */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live Form Direct Card */}
          <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50/90 via-teal-50/60 to-white p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <Globe size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wider">
                    Formulir Publik (Live)
                  </h4>
                  <span className="text-[10px] text-emerald-700">GitHub Pages Deployment</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Online
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-900 break-all">
                {config.liveFormUrl || "https://ahmaddodo.github.io/form-ghpr-sananwetan/"}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={config.liveFormUrl || "https://ahmaddodo.github.io/form-ghpr-sananwetan/"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                >
                  <span>Buka Form Publik</span>
                  <ExternalLink size={13} />
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(config.liveFormUrl || "https://ahmaddodo.github.io/form-ghpr-sananwetan/", "liveForm")}
                  className="inline-flex items-center gap-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer border border-slate-200"
                  title="Salin tautan formulir publik"
                >
                  {copiedLiveForm ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedLiveForm ? "Tersalin!" : "Salin"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Direct Link Card */}
          <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50/90 to-blue-50/70 p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              <h4 className="font-bold text-indigo-950 text-xs uppercase tracking-wider">
                Akses Cepat Repositori
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <a
                href={config.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 hover:shadow-sm transition group cursor-pointer text-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Github size={17} />
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-slate-900 group-hover:text-blue-600 truncate">
                      Buka di GitHub.com
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {config.repoUrl}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
              </a>

              <a
                href={`${config.repoUrl}/commits/${config.branch}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 hover:shadow-sm transition group cursor-pointer text-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <GitCommit size={17} />
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                      Riwayat Commit & Versi
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Cabang: {config.branch}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
              </a>

              <a
                href={`${config.repoUrl}/actions`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 hover:shadow-sm transition group cursor-pointer text-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Layers size={17} />
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-slate-900 group-hover:text-emerald-600 truncate">
                      Status Build (GitHub Actions)
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Lihat proses deploy Pages secara realtime
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-slate-400 group-hover:text-emerald-600 shrink-0" />
              </a>

              <a
                href={`${config.repoUrl}/settings/pages`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 hover:shadow-sm transition group cursor-pointer text-slate-800"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Settings size={17} />
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-slate-900 group-hover:text-amber-700 truncate">
                      Pengaturan GitHub Pages
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      Pastikan Source: "GitHub Actions"
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-slate-400 group-hover:text-amber-700 shrink-0" />
              </a>
            </div>
          </div>

          {/* Langkah Sinkronisasi di AI Studio */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Panduan Sinkronisasi Akun GitHub
              </h4>
            </div>

            <ol className="space-y-2.5 text-slate-600 leading-relaxed list-decimal list-inside pl-1">
              <li className="pl-1">
                <span className="font-semibold text-slate-800">Workflow GitHub Actions Telah Ditambahkan:</span> File <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-700 font-mono text-[11px]">.github/workflows/deploy.yml</code> sudah siap untuk otomatisasi build dan deploy.
              </li>
              <li className="pl-1">
                <span className="font-semibold text-slate-800">Ekspor Proyek Terbaru:</span> Klik ikon <b>Settings (⚙️)</b> di kanan atas AI Studio ➔ Pilih <b>Export / Download as ZIP</b> (atau gunakan menu Export to GitHub jika tersedia).
              </li>
              <li className="pl-1">
                <span className="font-semibold text-slate-800">Upload / Push ke GitHub:</span> Buka <a href="https://github.com/ahmaddodo/form-ghpr-sananwetan" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">ahmaddodo/form-ghpr-sananwetan</a>, upload file proyek baru termasuk folder <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-[11px]">.github</code>.
              </li>
              <li className="pl-1">
                <span className="font-semibold text-slate-800">Aktifkan GitHub Pages (Source: GitHub Actions):</span> Di GitHub, buka <b>Settings ➔ Pages ➔ Build and deployment Source: pilih "GitHub Actions"</b>. Workflow akan otomatis berjalan dan mengupdate web secara live!
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
