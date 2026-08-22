import React, { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Send,
  X,
  Database,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Info,
  Check,
  AlertCircle
} from "lucide-react";
import {
  OfflineQueueItem,
  OfflineSyncStatus
} from "../types";
import {
  getOfflineQueue,
  removeQueueItem,
  clearSyncedQueue,
  clearAllQueue,
  syncSingleItem,
  syncAllPendingQueue,
  isAppOnline,
  getForceOfflineMode,
  setForceOfflineMode,
  getActionTypeLabel
} from "../lib/offlineSyncService";

interface OfflineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  webAppUrl?: string;
  onSyncComplete?: () => void;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen,
  onClose,
  webAppUrl = "",
  onSyncComplete
}) => {
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isForcedOffline, setIsForcedOffline] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const refreshState = () => {
    setQueue(getOfflineQueue());
    setIsOnline(isAppOnline());
    setIsForcedOffline(getForceOfflineMode());
  };

  useEffect(() => {
    if (isOpen) {
      refreshState();
      setStatusMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(isAppOnline());
      refreshState();
    };
    const handleOffline = () => {
      setIsOnline(isAppOnline());
      refreshState();
    };
    const handleQueueUpdate = () => {
      setQueue(getOfflineQueue());
      setIsOnline(isAppOnline());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("ghpr-offline-queue-updated", handleQueueUpdate);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("ghpr-offline-queue-updated", handleQueueUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const pendingItems = queue.filter((it) => it.status === "pending" || it.status === "failed");
  const syncedItems = queue.filter((it) => it.status === "synced");
  const failedItems = queue.filter((it) => it.status === "failed");

  const handleToggleForceOffline = () => {
    const newForced = !isForcedOffline;
    setForceOfflineMode(newForced);
    setIsForcedOffline(newForced);
    setIsOnline(isAppOnline());
    setStatusMessage({
      type: "info",
      text: newForced
        ? "Simulasi Mode Offline diaktifkan. Formulir & pembaruan akan langsung disimpan ke antrean lokal."
        : "Mode Offline dinonaktifkan. Mengikuti koneksi internet perangkat."
    });
  };

  const handleSyncAll = async () => {
    if (!isOnline) {
      setStatusMessage({
        type: "error",
        text: "Tidak dapat menyinkronkan data: Perangkat sedang dalam kondisi offline / tanpa koneksi internet."
      });
      return;
    }

    if (pendingItems.length === 0) {
      setStatusMessage({
        type: "info",
        text: "Tidak ada antrean tertunda untuk disinkronkan."
      });
      return;
    }

    setIsSyncingAll(true);
    setSyncProgress({ current: 0, total: pendingItems.length });
    setStatusMessage({
      type: "info",
      text: `Memulai sinkronisasi ${pendingItems.length} data ke Google Sheets...`
    });

    try {
      const res = await syncAllPendingQueue(webAppUrl, (curr, tot) => {
        setSyncProgress({ current: curr, total: tot });
      });

      refreshState();

      if (res.succeeded > 0 && res.failed === 0) {
        setStatusMessage({
          type: "success",
          text: `Berhasil! Seluruh ${res.succeeded} data offline telah terkirim dan tercatat di Google Sheets.`
        });
      } else if (res.succeeded > 0 && res.failed > 0) {
        setStatusMessage({
          type: "error",
          text: `${res.succeeded} data berhasil disinkronkan, namun ${res.failed} data gagal. Anda dapat mencoba kembali.`
        });
      } else if (res.failed > 0) {
        setStatusMessage({
          type: "error",
          text: `Gagal menyinkronkan ${res.failed} data. Pastikan URL Google Apps Script aktif dan dapat diakses.`
        });
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: "Terjadi kesalahan saat memproses sinkronisasi: " + (err?.message || "Unknown error")
      });
    } finally {
      setIsSyncingAll(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  const handleSyncItem = async (item: OfflineQueueItem) => {
    if (!isOnline) {
      setStatusMessage({
        type: "error",
        text: "Perangkat sedang offline. Sambungkan koneksi internet terlebih dahulu."
      });
      return;
    }

    setSyncingItemId(item.id);
    try {
      const res = await syncSingleItem(item, webAppUrl);
      refreshState();

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Data kasus ${item.caseId} (${item.patientName}) berhasil disinkronkan ke Google Sheets!`
        });
        if (onSyncComplete) {
          onSyncComplete();
        }
      } else {
        setStatusMessage({
          type: "error",
          text: `Gagal sinkron data ${item.caseId}: ${res.message}`
        });
      }
    } finally {
      setSyncingItemId(null);
    }
  };

  const handleRemoveItem = (id: string, name: string) => {
    if (window.confirm(`Hapus item antrean untuk ${name}? Data tidak akan dikirim ke server.`)) {
      removeQueueItem(id);
      refreshState();
      setStatusMessage({
        type: "info",
        text: "Item antrean berhasil dihapus dari penyimpanan lokal."
      });
    }
  };

  const handleClearSynced = () => {
    clearSyncedQueue();
    refreshState();
    setStatusMessage({
      type: "info",
      text: "Riwayat antrean yang telah selesai berhasil dibersihkan."
    });
  };

  return (
    <div
      id="modal-offline-sync"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
              {isOnline ? <Wifi size={22} /> : <WifiOff size={22} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Pusat Sinkronisasi Data Offline</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${isOnline ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                  {isOnline ? "Online (Terkoneksi)" : "Mode Offline"}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Kelola antrean pengiriman data kasus & pemantauan saat bertugas tanpa sinyal internet
              </p>
            </div>
          </div>
          <button
            id="btn-close-offline-modal"
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Status Message Alert */}
          {statusMessage && (
            <div
              className={`rounded-xl p-3.5 text-xs font-medium flex items-start gap-2.5 ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : statusMessage.type === "error"
                  ? "bg-rose-50 text-rose-800 border border-rose-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === "error" ? (
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{statusMessage.text}</div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Quick Connection Info & Offline Simulation Toggle */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Database size={15} className="text-blue-600" />
                <span>Penyimpanan Lokal Aktif (Indexed / LocalStorage)</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Data formulir, VAR, dan log harian tetap aman tersimpan di peramban dan akan otomatis disinkronkan saat terhubung internet.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-toggle-force-offline"
                type="button"
                onClick={handleToggleForceOffline}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                  isForcedOffline
                    ? "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
                title="Aktifkan simulasi mode offline untuk menguji penginputan lapangan"
              >
                {isForcedOffline ? <WifiOff size={13} className="text-amber-700" /> : <Wifi size={13} className="text-slate-500" />}
                <span>{isForcedOffline ? "Simulasi Offline: AKTIF" : "Tes Simulasi Offline"}</span>
              </button>
            </div>
          </div>

          {/* Sync Statistics Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Menunggu</div>
              <div className="text-xl font-black text-amber-600 mt-0.5">{pendingItems.length}</div>
              <div className="text-[10px] text-slate-400">Belum tersinkron</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tersinkron</div>
              <div className="text-xl font-black text-emerald-600 mt-0.5">{syncedItems.length}</div>
              <div className="text-[10px] text-slate-400">Selesai terkirim</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gagal</div>
              <div className={`text-xl font-black mt-0.5 ${failedItems.length > 0 ? "text-rose-600" : "text-slate-400"}`}>
                {failedItems.length}
              </div>
              <div className="text-[10px] text-slate-400">Perlu coba ulang</div>
            </div>
          </div>

          {/* Progress Bar (if syncing all) */}
          {isSyncingAll && (
            <div className="space-y-1.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={14} className="animate-spin text-blue-600" />
                  <span>Sedang menyinkronkan data...</span>
                </span>
                <span>
                  {syncProgress.current} dari {syncProgress.total} item
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-blue-200 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Daftar Antrean Sinkronisasi ({queue.length})</span>
            </div>

            <div className="flex items-center gap-2">
              {syncedItems.length > 0 && (
                <button
                  id="btn-clear-synced-queue"
                  type="button"
                  onClick={handleClearSynced}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition cursor-pointer"
                >
                  <Trash2 size={13} className="text-slate-400" />
                  <span>Bersihkan Selesai ({syncedItems.length})</span>
                </button>
              )}

              <button
                id="btn-sync-all-offline-queue"
                type="button"
                disabled={isSyncingAll || pendingItems.length === 0 || !isOnline}
                onClick={handleSyncAll}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw size={13} className={isSyncingAll ? "animate-spin" : ""} />
                <span>Sinkronkan Semua Sekarang</span>
              </button>
            </div>
          </div>

          {/* Queue Items List */}
          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {queue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-slate-400">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-700">Tidak ada antrean tertunda</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Seluruh laporan kasus dan pemantauan telah tersimpan dan tersinkronisasi.
                </p>
              </div>
            ) : (
              queue.map((item) => {
                const typeInfo = getActionTypeLabel(item.type);
                const isItemSyncing = syncingItemId === item.id || isSyncingAll;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      item.status === "synced"
                        ? "bg-emerald-50/30 border-emerald-200"
                        : item.status === "failed"
                        ? "bg-rose-50/30 border-rose-200"
                        : "bg-white border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeInfo.badgeClass}`}
                        >
                          {typeInfo.label}
                        </span>

                        <span className="text-xs font-black text-slate-800">
                          {item.patientName}
                        </span>

                        <span className="text-[11px] text-slate-500 font-mono">
                          ({item.caseId})
                        </span>

                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          Kel. {item.kelurahan}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          <span>Dibuat: {new Date(item.timestamp).toLocaleString("id-ID")}</span>
                        </span>

                        {item.syncedAt && (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <Check size={12} />
                            <span>Tersinkron: {new Date(item.syncedAt).toLocaleTimeString("id-ID")}</span>
                          </span>
                        )}

                        {item.errorMessage && (
                          <span className="flex items-center gap-1 text-rose-600 font-medium">
                            <AlertCircle size={12} />
                            <span>Error: {item.errorMessage} (Dicoba {item.retryCount}x)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Item Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {item.status !== "synced" && (
                        <button
                          type="button"
                          disabled={isItemSyncing || !isOnline}
                          onClick={() => handleSyncItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                          title="Kirim item ini ke Google Sheets"
                        >
                          <Send size={12} className={isItemSyncing ? "animate-spin" : ""} />
                          <span>Sinkronkan</span>
                        </button>
                      )}

                      {item.status === "synced" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>Selesai</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id, item.patientName)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Hapus dari antrean"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3.5 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-blue-600" />
            <span>Otomatis mengirim data saat koneksi internet pulih</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
};
