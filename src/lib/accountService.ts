import { UserAccessProfile } from "../types";
import { getWebAppUrl, VITE_WEB_APP_URL } from "./config";
import { PREDEFINED_USER_PROFILES, STORAGE_KEY_OFFICER_PROFILES } from "./patientMonitoring";
import { hashPassword } from "./cryptoAuth";

export interface AccountItem {
  id?: string;
  username: string;
  nama: string;
  password?: string;
  kelurahan: string;
  isKoordinator: boolean | string;
  nip?: string;
  jabatan?: string;
  role?: string;
  email?: string;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

/**
 * Menyimpan seluruh akun ke localStorage dan secara otomatis push sinkronisasi
 * ke Google Spreadsheet sheet 'Data_Petugas' via Apps Script Web App URL
 */
export async function saveAccounts(accounts: (AccountItem | UserAccessProfile)[]): Promise<void> {
  try {
    // 1. Simpan ke localStorage key 'petugas'
    localStorage.setItem("petugas", JSON.stringify(accounts));
    // Simpan juga ke key internal aplikasi untuk kompatibilitas penuh
    localStorage.setItem(STORAGE_KEY_OFFICER_PROFILES, JSON.stringify(accounts));

    // Dispatch update event ke seluruh listener browser
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ghpr_officers_updated", { detail: accounts }));
      window.dispatchEvent(new Event("storage"));
    }
  } catch (err) {
    console.warn("Gagal menyimpan akun ke localStorage:", err);
  }

  // 2. WAJIB PUSH KE SHEET GOOGLE SPREADSHEET
  const webAppUrl = import.meta.env.VITE_WEB_APP_URL || getWebAppUrl() || VITE_WEB_APP_URL;
  if (webAppUrl) {
    console.log("Pushing to sheet:", webAppUrl);
    try {
      await fetch(webAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "saveAccounts", accounts: accounts })
      });
      console.log("Data petugas berhasil dipush ke Google Sheet (action: saveAccounts)");
    } catch (fetchErr) {
      console.error("Gagal push data petugas ke Google Sheet:", fetchErr);
    }
  } else {
    console.warn("VITE_WEB_APP_URL belum dikonfigurasi, lewati push ke spreadsheet.");
  }
}

/**
 * Mengambil daftar seluruh akun petugas
 */
export function getAccounts(): AccountItem[] {
  try {
    const rawPetugas = localStorage.getItem("petugas");
    if (rawPetugas) {
      const parsed = JSON.parse(rawPetugas);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    const rawInternal = localStorage.getItem(STORAGE_KEY_OFFICER_PROFILES);
    if (rawInternal) {
      const parsedInternal = JSON.parse(rawInternal);
      if (Array.isArray(parsedInternal) && parsedInternal.length > 0) {
        return parsedInternal;
      }
    }
  } catch (e) {
    console.warn("Gagal membaca daftar akun:", e);
  }

  return PREDEFINED_USER_PROFILES as unknown as AccountItem[];
}

/**
 * Menambah akun baru dan otomatis sinkron ke Google Sheet
 */
export async function addAccount(account: AccountItem): Promise<AccountItem[]> {
  const currentAccounts = getAccounts();
  const cleanUsername = (account.username || "").trim().toLowerCase();
  
  // Hash password jika belum terenkripsi
  let securedPass = account.password || "password123";
  if (securedPass.length !== 64 || !/^[0-9a-f]{64}$/i.test(securedPass)) {
    securedPass = hashPassword(securedPass, cleanUsername);
  }

  const newAcc: AccountItem = {
    ...account,
    id: account.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username: cleanUsername,
    password: securedPass,
    nama: (account.nama || "").trim(),
    kelurahan: account.kelurahan || "Sananwetan",
    isKoordinator: !!account.isKoordinator
  };

  const updatedList = [...currentAccounts, newAcc];
  await saveAccounts(updatedList);
  return updatedList;
}

/**
 * Memperbarui akun yang ada dan otomatis sinkron ke Google Sheet
 */
export async function editAccount(
  identifier: string,
  updatedData: Partial<AccountItem>
): Promise<AccountItem[]> {
  const currentAccounts = getAccounts();
  const targetId = identifier.trim().toLowerCase();

  const updatedList = currentAccounts.map((acc) => {
    if (
      (acc.id && acc.id.toLowerCase() === targetId) ||
      (acc.username && acc.username.toLowerCase() === targetId)
    ) {
      const merged: AccountItem = { ...acc, ...updatedData };
      if (updatedData.password && updatedData.password.trim() !== "") {
        const pass = updatedData.password.trim();
        if (pass.length !== 64 || !/^[0-9a-f]{64}$/i.test(pass)) {
          merged.password = hashPassword(pass, merged.username);
        }
      }
      return merged;
    }
    return acc;
  });

  await saveAccounts(updatedList);
  return updatedList;
}

/**
 * Menghapus akun dan otomatis sinkron ke Google Sheet
 */
export async function deleteAccount(identifier: string): Promise<AccountItem[]> {
  const currentAccounts = getAccounts();
  const targetId = identifier.trim().toLowerCase();

  const filteredList = currentAccounts.filter((acc) => {
    const matchId = acc.id && acc.id.toLowerCase() === targetId;
    const matchUser = acc.username && acc.username.toLowerCase() === targetId;
    return !matchId && !matchUser;
  });

  await saveAccounts(filteredList);
  return filteredList;
}
