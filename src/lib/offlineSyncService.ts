import { OfflineQueueItem, OfflineQueueActionType, OfflineSyncStatus } from "../types";
import { sendToAppsScript, DEFAULT_WEB_APP_URL } from "./googleSheets";

export const STORAGE_KEY_OFFLINE_QUEUE = "ghpr_offline_sync_queue_v2";
export const STORAGE_KEY_FORCE_OFFLINE_MODE = "ghpr_force_offline_mode_v1";

/**
 * Mendapatkan seluruh daftar antrean sinkronisasi offline
 */
export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Gagal membaca antrean offline dari localStorage:", e);
  }
  return [];
}

/**
 * Menyimpan seluruh antrean ke localStorage dan memancarkan event pembaruan
 */
export function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(queue));
    notifyQueueChange();
  } catch (e) {
    console.warn("Gagal menyimpan antrean offline:", e);
  }
}

/**
 * Memancarkan event kustom agar seluruh komponen bereaksi secara instan
 */
export function notifyQueueChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ghpr-offline-queue-updated"));
  }
}

/**
 * Menghitung jumlah item yang belum tersinkronisasi (status: 'pending' atau 'failed')
 */
export function getPendingQueueCount(): number {
  const queue = getOfflineQueue();
  return queue.filter((it) => it.status === "pending" || it.status === "failed").length;
}

/**
 * Menambahkan data tindakan/kasus baru ke dalam antrean offline
 */
export function addToOfflineQueue(params: {
  type: OfflineQueueActionType;
  caseId: string;
  patientName: string;
  kelurahan: string;
  payload: Record<string, any>;
}): OfflineQueueItem {
  const queue = getOfflineQueue();
  const newItem: OfflineQueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: params.type,
    timestamp: new Date().toISOString(),
    caseId: params.caseId || `GHPR-${Date.now()}`,
    patientName: params.patientName || "Pasien GHPR",
    kelurahan: params.kelurahan || "Sananwetan",
    payload: params.payload,
    status: "pending",
    retryCount: 0
  };

  queue.unshift(newItem);
  saveOfflineQueue(queue);
  return newItem;
}

/**
 * Memperbarui status atau data satu item di antrean
 */
export function updateQueueItem(
  id: string,
  updates: Partial<OfflineQueueItem>
): void {
  const queue = getOfflineQueue();
  const updated = queue.map((item) => {
    if (item.id === id) {
      return { ...item, ...updates };
    }
    return item;
  });
  saveOfflineQueue(updated);
}

/**
 * Menghapus satu item dari antrean berdasarkan ID
 */
export function removeQueueItem(id: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter((it) => it.id !== id);
  saveOfflineQueue(filtered);
}

/**
 * Menghapus seluruh item yang telah berstatus 'synced' (selesai)
 */
export function clearSyncedQueue(): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter((it) => it.status !== "synced");
  saveOfflineQueue(filtered);
}

/**
 * Mengosongkan seluruh isi antrean
 */
export function clearAllQueue(): void {
  saveOfflineQueue([]);
}

/**
 * Mengecek apakah perangkat sedang dalam kondisi Online (memperhitungkan toggle force offline jika ada)
 */
export function isAppOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  
  // Periksa apakah pengguna mengaktifkan mode simulasi offline manual
  try {
    const forced = localStorage.getItem(STORAGE_KEY_FORCE_OFFLINE_MODE);
    if (forced === "true") return false;
  } catch (e) {}

  return navigator.onLine;
}

/**
 * Mengatur mode offline paksa (berguna untuk pengujian lapangan)
 */
export function setForceOfflineMode(forced: boolean): void {
  try {
    if (forced) {
      localStorage.setItem(STORAGE_KEY_FORCE_OFFLINE_MODE, "true");
    } else {
      localStorage.removeItem(STORAGE_KEY_FORCE_OFFLINE_MODE);
    }
    notifyQueueChange();
  } catch (e) {}
}

/**
 * Mendapatkan status force offline
 */
export function getForceOfflineMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_FORCE_OFFLINE_MODE) === "true";
  } catch (e) {
    return false;
  }
}

/**
 * Sinkronisasi satu item antrean ke Google Apps Script / backend
 */
export async function syncSingleItem(
  item: OfflineQueueItem,
  webAppUrl: string = DEFAULT_WEB_APP_URL
): Promise<{ success: boolean; message: string }> {
  if (!isAppOnline()) {
    return {
      success: false,
      message: "Perangkat masih dalam kondisi offline. Sinkronisasi ditunda."
    };
  }

  const targetUrl = (webAppUrl || DEFAULT_WEB_APP_URL).trim();
  if (!targetUrl) {
    return {
      success: false,
      message: "URL Google Apps Script belum diisi di pengaturan."
    };
  }

  updateQueueItem(item.id, { status: "syncing" });

  try {
    let actionType: "create" | "update" = "create";
    if (item.type === "edit_case" || item.type === "update_var" || item.type === "daily_log" || item.type === "status_update") {
      actionType = "update";
    }

    // Persiapkan payload
    const finalPayload = {
      ...item.payload,
      id_kasus: item.caseId,
      queue_type: item.type,
      offline_created_at: item.timestamp,
      sync_attempt_at: new Date().toISOString()
    };

    const res = await sendToAppsScript(targetUrl, finalPayload, actionType);

    if (res.success) {
      updateQueueItem(item.id, {
        status: "synced",
        syncedAt: new Date().toISOString(),
        errorMessage: undefined
      });
      return { success: true, message: "Sinkronisasi berhasil" };
    } else {
      throw new Error(res.message || "Gagal sinkron");
    }
  } catch (err: any) {
    const errMsg = err?.message || "Kesalahan jaringan / endpoint tidak merespons";
    updateQueueItem(item.id, {
      status: "failed",
      retryCount: (item.retryCount || 0) + 1,
      errorMessage: errMsg
    });
    return { success: false, message: errMsg };
  }
}

/**
 * Memproses sinkronisasi semua item yang pending/failed sekaligus
 */
export async function syncAllPendingQueue(
  webAppUrl: string = DEFAULT_WEB_APP_URL,
  onProgress?: (processed: number, total: number, currentItem?: OfflineQueueItem) => void
): Promise<{ total: number; succeeded: number; failed: number }> {
  if (!isAppOnline()) {
    return { total: 0, succeeded: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  const pendingItems = queue.filter(
    (it) => it.status === "pending" || it.status === "failed"
  );

  if (pendingItems.length === 0) {
    return { total: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  const total = pendingItems.length;

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    if (onProgress) {
      onProgress(i, total, item);
    }

    const result = await syncSingleItem(item, webAppUrl);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }

    // Jeda singkat antar pengiriman untuk kelancaran transmisi Apps Script
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (onProgress) {
    onProgress(total, total, undefined);
  }

  return { total, succeeded, failed };
}

/**
 * Format label jenis aksi offline
 */
export function getActionTypeLabel(type: OfflineQueueActionType): {
  label: string;
  color: string;
  badgeClass: string;
} {
  switch (type) {
    case "new_case":
      return {
        label: "Laporan Kasus Baru",
        color: "blue",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-200"
      };
    case "edit_case":
      return {
        label: "Edit Data Kasus",
        color: "indigo",
        badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200"
      };
    case "update_var":
      return {
        label: "Perbaruan VAR",
        color: "emerald",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200"
      };
    case "daily_log":
      return {
        label: "Log Pantau Harian",
        color: "amber",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-200"
      };
    case "status_update":
      return {
        label: "Ubah Status Kasus",
        color: "purple",
        badgeClass: "bg-purple-100 text-purple-800 border-purple-200"
      };
    case "delete_case":
      return {
        label: "Hapus Kasus",
        color: "rose",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-200"
      };
    default:
      return {
        label: "Pembaruan Data",
        color: "slate",
        badgeClass: "bg-slate-100 text-slate-800 border-slate-200"
      };
  }
}
