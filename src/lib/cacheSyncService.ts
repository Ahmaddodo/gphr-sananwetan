/**
 * Layanan Sinkronisasi Cache & Inisialisasi Instalasi Baru
 * Memastikan setiap pengguna baru atau pengguna yang menginstal aplikasi PWA
 * langsung mendapatkan data terbaru dari Google Sheets & akun petugas resmi
 * tanpa terpengaruh cache usang (stale cache).
 */

import {
  PREDEFINED_USER_PROFILES,
  getOfficerProfiles,
  saveOfficerProfiles,
  syncPatientsFromGoogleSheets,
  syncOfficerProfilesFromGoogleSheets,
  getAllPatients
} from "./patientMonitoring";
import { getWebAppUrl } from "./config";

export const APP_CACHE_VERSION_KEY = "ghpr_app_version_tag_v6";
export const CURRENT_APP_VERSION = "2026.08.27.v6_instant_login_landing";

/**
 * Inisialisasi awal saat aplikasi dibuka atau di-install oleh user baru.
 * - Memperbarui daftar akun petugas resmi dari kode sumber dan cloud Google Sheets
 * - Membusting cache lama jika versi aplikasi diperbarui
 * - Memicu auto-sync data pasien dan akun petugas dari Google Sheets secara langsung
 */
export async function initializeAppSyncAndBustStaleCache(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const storedVersion = localStorage.getItem(APP_CACHE_VERSION_KEY);

    // 1. Jika ada upgrade versi atau instalasi baru, bersihkan sesi lama dan rekonsiliasi akun petugas
    if (storedVersion !== CURRENT_APP_VERSION) {
      console.log(`[CacheSync] Mendeteksi versi baru (${CURRENT_APP_VERSION}). Memperbarui akun & sinkronisasi...`);

      // Bersihkan sesi aktif lama dari storage agar selalu menampilkan form login saat URL dibuka
      try {
        localStorage.removeItem("ghpr_active_user_access_profile_v2");
        localStorage.removeItem("ghpr_active_user_profile");
        localStorage.removeItem("ghpr_active_app_tab_v2");
        localStorage.removeItem("ghpr_app_view_mode");
      } catch (e) {}
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("ghpr_active_user_access_profile_v2");
          sessionStorage.removeItem("ghpr_active_app_tab_v2");
        }
      } catch (e) {}

      // Rekonsiliasi akun petugas: pastikan akun ada tanpa menimpa perubahan kustom dari spreadsheet
      try {
        const existingOfficers = getOfficerProfiles();
        const mergedOfficers = [...existingOfficers];

        // Pastikan setiap username dasar di PREDEFINED_USER_PROFILES ada di storage
        for (const defaultOfficer of PREDEFINED_USER_PROFILES) {
          const idx = mergedOfficers.findIndex(
            (o) => o.username?.toLowerCase() === defaultOfficer.username?.toLowerCase()
          );
          if (idx < 0) {
            // Tambahkan jika akun belum ada sama sekali
            mergedOfficers.push(defaultOfficer);
          }
        }

        // Simpan secara lokal tanpa menimpa Google Sheets (shouldPushToRemote = false)
        saveOfficerProfiles(mergedOfficers, false);
      } catch (err) {
        console.warn("[CacheSync] Gagal rekonsiliasi akun petugas:", err);
      }

      // Tandai versi saat ini di localStorage
      localStorage.setItem(APP_CACHE_VERSION_KEY, CURRENT_APP_VERSION);
    }

    // 2. Jika online, langsung lakukan sinkronisasi data pasien & akun petugas terbaru dari Google Sheets
    if (navigator.onLine) {
      const endpoint = getWebAppUrl();
      if (endpoint) {
        console.log("[CacheSync] Menjalankan sinkronisasi awal data pasien & akun petugas dari Google Sheets...");
        
        // Sinkronisasi data pasien
        syncPatientsFromGoogleSheets(endpoint)
          .then((res) => {
            console.log("[CacheSync] Sinkronisasi pasien berhasil:", res.message);
          })
          .catch((err) => {
            console.warn("[CacheSync] Sinkronisasi pasien background tertunda:", err);
          });

        // Sinkronisasi akun petugas dari cloud agar nama yang baru diubah admin seketika masuk ke HP petugas
        syncOfficerProfilesFromGoogleSheets(endpoint)
          .then((res) => {
            console.log("[CacheSync] Sinkronisasi akun petugas berhasil:", res.message);
          })
          .catch((err) => {
            console.warn("[CacheSync] Sinkronisasi akun petugas background tertunda:", err);
          });
      }
    }
  } catch (e) {
    console.warn("[CacheSync] Gagal inisialisasi cache sync:", e);
  }
}
