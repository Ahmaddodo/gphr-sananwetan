import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Users,
  Database,
  Smartphone,
  ShieldCheck,
  FileSpreadsheet,
  Check,
  Layers,
  ArrowRight,
  ExternalLink,
  Lock,
  UserCheck,
  Copy,
  Code,
  Download,
  Info
} from "lucide-react";
import {
  getOfficerProfiles,
  getAllPatients,
  pushAllCloudData,
  pullAllCloudData,
  pushOfficerProfilesToGoogleSheets,
  pushAllPatientsToGoogleSheets,
  syncOfficerProfilesFromGoogleSheets,
  syncPatientsFromGoogleSheets
} from "../lib/patientMonitoring";
import {
  ConnectedSheetConfig,
  DEFAULT_SPREADSHEET_URL,
  DEFAULT_WEB_APP_URL,
  getAppsScriptTemplateCode
} from "../lib/googleSheets";
import { getWebAppUrl } from "../lib/config";
import { UserAccessProfile, PatientMonitoringItem } from "../types";

interface AdminDeviceSyncPanelProps {
  webAppUrl: string;
  sheetConfig: ConnectedSheetConfig | null;
  onDataSynced?: () => void;
}

export const AdminDeviceSyncPanel: React.FC<AdminDeviceSyncPanelProps> = ({
  webAppUrl,
  sheetConfig,
  onDataSynced
}) => {
  const [officers, setOfficers] = useState<UserAccessProfile[]>(() => getOfficerProfiles());
  const [patients, setPatients] = useState<PatientMonitoringItem[]>(() => getAllPatients());
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [copiedOfficersTable, setCopiedOfficersTable] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    title: string;
    description: string;
  } | null>(null);

  const refreshLocalState = () => {
    setOfficers(getOfficerProfiles());
    setPatients(getAllPatients());
  };

  useEffect(() => {
    const handleUpdate = () => refreshLocalState();
    window.addEventListener("ghpr_officers_updated", handleUpdate);
    window.addEventListener("ghpr_patient_data_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("ghpr_officers_updated", handleUpdate);
      window.removeEventListener("ghpr_patient_data_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const activeUrl = (webAppUrl || getWebAppUrl() || "").trim();

  // Handler Salin Data Petugas ke Clipboard (Format Langsung Paste di Excel / Google Sheets)
  const handleCopyOfficersForSheets = () => {
    const headers = ["id", "username", "nama", "nip", "jabatan", "kelurahan", "role", "isKoordinator", "email", "password", "lastUpdated"];
    const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
    
    const rows = officers.map((o) => [
      o.id || `user-${o.username}`,
      o.username || "",
      o.nama || "",
      `'${o.nip || ""}`,
      o.jabatan || "",
      o.kelurahan || "Sananwetan",
      o.role || "Petugas Kelurahan",
      o.isKoordinator ? "true" : "false",
      o.email || "",
      o.password || "",
      nowStr
    ]);

    const tsvContent = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");

    try {
      navigator.clipboard.writeText(tsvContent);
      setCopiedOfficersTable(true);
      setTimeout(() => setCopiedOfficersTable(false), 4000);
      setStatusMessage({
        type: "success",
        title: "Tabel Data Petugas Berhasil Disalin!",
        description: "Buka tab 'Data_Petugas' di Google Spreadsheet Anda, klik di sel A1, lalu tekan Ctrl+V (Paste). Seluruh 7 baris akun petugas langsung terisi rapi."
      });
    } catch (err) {
      console.error("Gagal menyalin ke clipboard:", err);
    }
  };

  // Handler Salin Kode Apps Script
  const handleCopyAppsScript = () => {
    const code = getAppsScriptTemplateCode();
    try {
      navigator.clipboard.writeText(code);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 4000);
    } catch (e) {}
  };

  // 1. Handler PUSH: Admin Mengirim Data ke Google Sheets
  const handlePushAllToCloud = async () => {
    if (!activeUrl) {
      setStatusMessage({
        type: "error",
        title: "URL Web App Belum Diatur",
        description: "Silakan masukkan URL Web App Google Sheets di tab 'Koneksi Google Sheets & Endpoint' terlebih dahulu."
      });
      return;
    }

    setIsPushing(true);
    setStatusMessage(null);

    try {
      const res = await pushAllCloudData(activeUrl);
      refreshLocalState();
      if (res.success) {
        setStatusMessage({
          type: "success",
          title: "Perintah Kirim Cloud Terkirim!",
          description: `Data ${res.officersCount} akun petugas dan ${res.patientsCount} data pasien telah dikirim ke Web App Google Sheets. Jika sheet belum bertambah, pastikan Apps Script telah di-Deploy ulang sebagai 'New Version'. Atau gunakan tombol 'Salin Tabel Petugas' di bawah.`
        });
      } else {
        setStatusMessage({
          type: "info",
          title: "Hasil Pengiriman",
          description: res.message || "Data telah dikirimkan ke endpoint Web App."
        });
      }
      if (onDataSynced) onDataSynced();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        title: "Kesalahan Jaringan",
        description: `Gagal berkomunikasi dengan Google Sheets: ${err?.message || String(err)}`
      });
    } finally {
      setIsPushing(false);
    }
  };

  // 2. Handler PULL: Menarik Data dari Google Sheets agar Perangkat Ini Selaras
  const handlePullAllFromCloud = async () => {
    if (!activeUrl) {
      setStatusMessage({
        type: "error",
        title: "URL Web App Belum Diatur",
        description: "Silakan masukkan URL Web App Google Sheets di tab 'Koneksi Google Sheets & Endpoint' terlebih dahulu."
      });
      return;
    }

    setIsPulling(true);
    setStatusMessage(null);

    try {
      const res = await pullAllCloudData(activeUrl);
      refreshLocalState();
      if (res.success) {
        setStatusMessage({
          type: "success",
          title: "Sinkronisasi Berhasil!",
          description: `Perangkat ini telah diselaraskan dengan Google Sheets: ${res.officersCount} akun petugas & ${res.patientsCount} data pasien pemantauan.`
        });
      } else {
        setStatusMessage({
          type: "info",
          title: "Hasil Sinkronisasi",
          description: res.message || "Sinkronisasi selesai."
        });
      }
      if (onDataSynced) onDataSynced();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        title: "Kesalahan Jaringan",
        description: `Gagal menarik data dari Google Sheets: ${err?.message || String(err)}`
      });
    } finally {
      setIsPulling(false);
    }
  };

  const spreadsheetUrl = sheetConfig?.spreadsheetUrl || DEFAULT_SPREADSHEET_URL;

  return (
    <div className="space-y-6">
      {/* Banner Penjelasan & Status Multi-Perangkat */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/30 border border-blue-400/40 text-blue-200 text-xs font-bold uppercase tracking-wider">
            <Smartphone size={14} className="text-emerald-400" />
            <span>Sinkronisasi Sumber Admin & Multi-Perangkat</span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold tracking-tight">
            Pusat Penyelarasan Data Admin dengan Semua HP Petugas
          </h3>

          <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
            Semua perubahan yang Anda buat di admin (seperti <b>jumlah dan nama pasien ({patients.length} kasus)</b> serta <b>nama petugas & hak akses ({officers.length} akun)</b>) dapat langsung diselaraskan ke Google Spreadsheet sehingga semua HP petugas di lapangan langsung mengikuti data admin.
          </p>

          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handlePushAllToCloud}
              disabled={isPushing || isPulling}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-bold shadow-lg transition cursor-pointer"
            >
              <UploadCloud size={16} className={isPushing ? "animate-bounce" : ""} />
              <span>{isPushing ? "Mengirim ke Cloud..." : "1. Kirim Data Admin ke Google Sheets (Push)"}</span>
            </button>

            <button
              type="button"
              onClick={handlePullAllFromCloud}
              disabled={isPushing || isPulling}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-bold shadow-lg transition cursor-pointer"
            >
              <DownloadCloud size={16} className={isPulling ? "animate-bounce" : ""} />
              <span>{isPulling ? "Menarik Data..." : "2. Tarik & Selaraskan dari Cloud (Pull)"}</span>
            </button>

            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white px-3.5 py-2.5 text-xs font-semibold border border-white/20 transition cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-emerald-300" />
              <span>Buka Google Sheets</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div
          className={`rounded-2xl p-4 text-xs flex items-start gap-3 border shadow-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
              : statusMessage.type === "error"
              ? "bg-rose-50 text-rose-900 border-rose-300"
              : "bg-blue-50 text-blue-900 border-blue-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : statusMessage.type === "error" ? (
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <RefreshCw size={20} className="text-blue-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-sm mb-0.5">{statusMessage.title}</div>
            <div className="leading-relaxed opacity-95">{statusMessage.description}</div>
          </div>
        </div>
      )}

      {/* Stat Ringkasan Data Saat Ini */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* KARTU 1: DATA PASIEN PEMANTAUAN (SUMBER ADMIN) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Users size={18} />
              </div>
              <div>
                <h4>Daftar Pasien di Admin ({patients.length} Pasien)</h4>
                <p className="text-xs text-slate-500 font-normal">Tersimpan di 'Data Laporan GHPR'</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {patients.length} Kasus Aktif
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {patients.map((p, idx) => (
              <div
                key={p.id_kasus || idx}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs hover:bg-blue-50/40 transition"
              >
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{p.namaKorban}</span>
                    <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {p.id_kasus}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Kel. {p.kelurahan} • Luka: {p.kondisiLuka || "Kategori 2"} • Hewan: {p.spesiesHPR}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {p.statusPemantauan}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <span>PJ Utama: <b>Widodo Suprianto A.Md.Kep</b></span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setIsPulling(true);
                  try {
                    const res = await syncPatientsFromGoogleSheets(activeUrl);
                    refreshLocalState();
                    setStatusMessage({
                      type: res.success ? "success" : "info",
                      title: "Sinkronisasi Pasien Selesai",
                      description: res.message
                    });
                    if (onDataSynced) onDataSynced();
                  } finally {
                    setIsPulling(false);
                  }
                }}
                disabled={isPulling || isPushing}
                className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
                title="Tarik daftar pasien terbaru dari Google Spreadsheet ke perangkat ini"
              >
                {isPulling ? "Menarik..." : "← Tarik dari Spreadsheet"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsPushing(true);
                  try {
                    const res = await pushAllPatientsToGoogleSheets(patients, activeUrl);
                    setStatusMessage({
                      type: res.success ? "success" : "error",
                      title: res.success ? "Data Pasien Terkirim!" : "Gagal Kirim",
                      description: res.message
                    });
                  } finally {
                    setIsPushing(false);
                  }
                }}
                disabled={isPushing || isPulling}
                className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                title="Kirim daftar pasien lokal ke Google Spreadsheet"
              >
                Push Pasien Saja →
              </button>
            </div>
          </div>
        </div>

        {/* KARTU 2: DATA AKUN & HAK AKSES PETUGAS (SUMBER ADMIN) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4>Akun & Hak Akses Petugas ({officers.length} Petugas)</h4>
                <p className="text-xs text-slate-500 font-normal">Tersimpan di Sheet 'Data_Petugas'</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {officers.length} Akun Aktif
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {officers.map((o, idx) => (
              <div
                key={o.id || idx}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs hover:bg-indigo-50/40 transition"
              >
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{o.nama}</span>
                    <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      @{o.username || o.nip}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {o.isKoordinator ? "Koordinator (Semua Kelurahan)" : `Wilayah Kel. ${o.kelurahan}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                    {o.role?.split(" ")[0] || "Petugas"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* OPSI CEPAT: SALIN TABEL KE CLIPBOARD */}
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                <Copy size={13} className="text-indigo-600" />
                <span>Salin Data Petugas Siap Paste ke Sheet</span>
              </span>
              <button
                type="button"
                onClick={handleCopyOfficersForSheets}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {copiedOfficersTable ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedOfficersTable ? "Tersalin!" : "Salin Tabel Petugas"}</span>
              </button>
            </div>
            <p className="text-[10px] text-indigo-700/80 leading-relaxed">
              Klik <b>"Salin Tabel Petugas"</b> lalu buka tab <b>Data_Petugas</b> di Google Spreadsheet, klik di sel <b>A1</b> dan tekan <b>Ctrl+V</b>. Seluruh data 7 petugas langsung terisi 100% rapi.
            </p>
          </div>

          <div className="pt-1 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <span>Enkripsi: <b>SHA-256 + Salt</b></span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setIsPulling(true);
                  try {
                    const res = await syncOfficerProfilesFromGoogleSheets(activeUrl);
                    refreshLocalState();
                    setStatusMessage({
                      type: res.success ? "success" : "info",
                      title: "Tarik Akun Selesai",
                      description: res.message
                    });
                    if (onDataSynced) onDataSynced();
                  } finally {
                    setIsPulling(false);
                  }
                }}
                disabled={isPulling || isPushing}
                className="text-indigo-700 hover:text-indigo-900 font-bold cursor-pointer"
                title="Tarik data petugas dari Google Spreadsheet ke perangkat ini"
              >
                {isPulling ? "Menarik..." : "← Tarik Petugas"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsPushing(true);
                  try {
                    const res = await pushOfficerProfilesToGoogleSheets(officers, activeUrl);
                    setStatusMessage({
                      type: res.success ? "success" : "error",
                      title: res.success ? "Data Petugas Terkirim!" : "Gagal Kirim",
                      description: res.message + " (Pastikan Apps Script telah di-Deploy New Version jika sheet belum terupdate otomatis)."
                    });
                  } finally {
                    setIsPushing(false);
                  }
                }}
                disabled={isPushing || isPulling}
                className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                title="Kirim akun petugas ke Google Apps Script"
              >
                Push Petugas Saja →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PENJELASAN MENGAPA GOOGLE APPS SCRIPT BUTUH DEPLOY VERSI BARU */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">
              Mengapa Tombol Push Belum Menambah Baris di Google Sheet?
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed">
              Google Apps Script bersifat terkunci (*locked version*). Jika kode Apps Script di Google Sheets belum di-deploy ulang sebagai <b>"New Version"</b>, URL Web App masih menjalankan script versi lama yang hanya tahu sheet <i>Data Laporan GHPR</i> dan belum mengenal fungsi <i>saveAccounts</i> untuk tab <i>Data_Petugas</i>.
            </p>
            
            <div className="pt-1 flex items-center gap-3 flex-wrap text-xs">
              <button
                type="button"
                onClick={handleCopyOfficersForSheets}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                {copiedOfficersTable ? <Check size={14} /> : <Copy size={14} />}
                <span>Solusi 1 Detik: Salin & Tempel (Paste) ke Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => setShowScriptModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white font-bold cursor-pointer"
              >
                <Code size={14} />
                <span>Lihat Cara Deploy Ulang Google Apps Script</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PANDUAN DEPLOY APPS SCRIPT */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Code size={18} className="text-blue-600" />
                <span>Cara Memperbarui Google Apps Script (Deploy New Version)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <ol className="list-decimal list-inside text-xs text-slate-700 space-y-2.5 leading-relaxed">
              <li>Buka Google Spreadsheet $\rightarrow$ menu <b>Extensions (Ekstensi)</b> $\rightarrow$ <b>Apps Script</b>.</li>
              <li>Salin kode skrip lengkap di bawah ini dan tempelkan menggantikan isi <code>Code.gs</code> yang lama.</li>
              <li>Klik tombol <b>Save</b> (ikon disket).</li>
              <li>
                <b>PENTING:</b> Klik tombol biru <b>Deploy</b> (di kanan atas) $\rightarrow$ pilih <b>Manage Deployments</b> $\rightarrow$ klik <b>ikon pensil (Edit)</b> $\rightarrow$ di bagian Version ganti menjadi <b>New Version</b> $\rightarrow$ klik <b>Deploy</b>.
              </li>
            </ol>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyAppsScript}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                {copiedScript ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedScript ? "Kode Skrip Tersalin!" : "Salin Kode Apps Script Lengkap"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
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
