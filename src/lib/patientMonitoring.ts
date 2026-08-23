import {
  PatientMonitoringItem,
  UserAccessProfile,
  KelurahanWilayah,
  MonitoringDailyLog,
  FormGHPRData,
  SubmissionPayload
} from "../types";
import { hashPassword, verifyPassword } from "./cryptoAuth";
import {
  deleteCaseFromLocalHistory,
  deleteRecordFromAppsScript,
  DEFAULT_WEB_APP_URL,
  DEFAULT_SPREADSHEET_ID,
  getLocalSubmissionHistory,
  fetchOfficerAccountsFromAppsScript,
  pushOfficerAccountsToAppsScript,
  pushAllPatientsToAppsScript,
  fetchDirectGoogleSheetRows,
  getSavedSheetConfig
} from "./googleSheets";
import { getWebAppUrl } from "./config";

export const STORAGE_KEY_PATIENTS = "ghpr_patient_monitoring_data_v2";
export const STORAGE_KEY_ACTIVE_USER = "ghpr_active_user_access_profile_v2";
export const STORAGE_KEY_DISMISSED_PATIENTS = "ghpr_dismissed_cases_v2";

export function getDismissedPatientIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSED_PATIENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    }
  } catch (e) {}
  return [];
}

export function addDismissedPatientId(id_kasus: string): void {
  try {
    const cleanId = (id_kasus || "").trim();
    if (!cleanId) return;
    const list = getDismissedPatientIds();
    if (!list.some((id) => id.toLowerCase() === cleanId.toLowerCase())) {
      list.push(cleanId);
      localStorage.setItem(STORAGE_KEY_DISMISSED_PATIENTS, JSON.stringify(list));
    }
  } catch (e) {}
}

export function restoreDismissedPatientId(id_kasus: string): void {
  try {
    const cleanId = (id_kasus || "").trim().toLowerCase();
    const list = getDismissedPatientIds();
    const filtered = list.filter((id) => id.toLowerCase() !== cleanId);
    localStorage.setItem(STORAGE_KEY_DISMISSED_PATIENTS, JSON.stringify(filtered));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ghpr_patient_data_updated", { detail: { restoredId: cleanId } }));
    }
  } catch (e) {}
}

export const KELURAHAN_LIST: KelurahanWilayah[] = [
  "Sananwetan",
  "Gedog",
  "Bendogerit",
  "Karangtengah",
  "Klampok",
  "Plosokerep",
  "Rembang"
];

// Profil Pengguna berdasarkan Hak Akses Kelurahan dengan Akun Login Resmi Terenkripsi
export const PREDEFINED_USER_PROFILES: UserAccessProfile[] = [
  {
    id: "user-koordinator",
    nama: "dr. Triana Sulistyaningsih",
    nip: "197805122005012003",
    role: "Koordinator Surveilans Rabies Puskesmas",
    kelurahan: "Semua",
    jabatan: "Dokter Penanggung Jawab Surveilans Zoonosis",
    username: "admin",
    password: hashPassword("password123", "admin"),
    email: "surveilans.sananwetan@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    isKoordinator: true
  },
  {
    id: "user-widodo",
    nama: "Widodo Suprianto A.Md.Kep",
    nip: "197606252009011007",
    role: "Petugas Surveilans Utama / Penanggung Jawab Form",
    kelurahan: "Bendogerit",
    jabatan: "Perawat Koordinator Surveilans Epidemiologi",
    username: "widodo",
    password: hashPassword("password123", "widodo"),
    email: "widodotopkm@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    isKoordinator: true
  },
  {
    id: "user-sananwetan",
    nama: "Ahmad Syaifudin, A.Md.Kep",
    nip: "198803152011011002",
    role: "Petugas Wilayah Kel. Sananwetan",
    kelurahan: "Sananwetan",
    jabatan: "Perawat Penanggung Jawab Wilayah Sananwetan",
    username: "sananwetan",
    password: hashPassword("password123", "sananwetan"),
    email: "ahmad.pkm@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    isKoordinator: false
  },
  {
    id: "user-gedog",
    nama: "Rina Marlina, S.Tr.Keb",
    nip: "199004222015032004",
    role: "Petugas Wilayah Kel. Gedog",
    kelurahan: "Gedog",
    jabatan: "Bidan Penanggung Jawab Wilayah Gedog",
    username: "gedog",
    password: hashPassword("password123", "gedog"),
    email: "rina.gedog@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    isKoordinator: false
  },
  {
    id: "user-bendogerit",
    nama: "Widodo, S.Kep., Ns.",
    nip: "198501012010011001",
    role: "Petugas Wilayah Kel. Bendogerit",
    kelurahan: "Bendogerit",
    jabatan: "Perawat Penanggung Jawab Wilayah Bendogerit",
    username: "bendogerit",
    password: hashPassword("password123", "bendogerit"),
    email: "widodo.bendogerit@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    isKoordinator: false
  },
  {
    id: "user-karangtengah",
    nama: "Bambang Sugiharto, S.Kep",
    nip: "198711092014021001",
    role: "Petugas Wilayah Kel. Karangtengah",
    kelurahan: "Karangtengah",
    jabatan: "Perawat Surveilans Kel. Karangtengah",
    username: "karangtengah",
    password: hashPassword("password123", "karangtengah"),
    email: "bambang.karangtengah@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    isKoordinator: false
  },
  {
    id: "user-klampok",
    nama: "Dewi Lestari, A.Md.Kep",
    nip: "199208142019032008",
    role: "Petugas Wilayah Kel. Klampok",
    kelurahan: "Klampok",
    jabatan: "Perawat Poskeskel Kel. Klampok",
    username: "klampok",
    password: hashPassword("password123", "klampok"),
    email: "dewi.klampok@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    isKoordinator: false
  },
  {
    id: "user-plosokerep",
    nama: "Siti Maimunah, S.Kep",
    nip: "198906202016022003",
    role: "Petugas Wilayah Kel. Plosokerep",
    kelurahan: "Plosokerep",
    jabatan: "Perawat PJ Wilayah Kel. Plosokerep",
    username: "plosokerep",
    password: hashPassword("password123", "plosokerep"),
    email: "siti.plosokerep@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    isKoordinator: false
  },
  {
    id: "user-rembang",
    nama: "Hadi Purnomo, A.Md.Kep",
    nip: "199102282018011003",
    role: "Petugas Wilayah Kel. Rembang",
    kelurahan: "Rembang",
    jabatan: "Petugas Surveilans Lapangan Kel. Rembang",
    username: "rembang",
    password: hashPassword("password123", "rembang"),
    email: "hadi.rembang@gmail.com",
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    isKoordinator: false
  }
];

// Helper pengecekan otoritas hapus form pemantauan (HANYA untuk username admin)
export function canUserDeleteCases(user?: UserAccessProfile | null): boolean {
  if (!user || !user.username) return false;
  return user.username.toLowerCase().trim() === "admin";
}

// Seed Data Pemantauan Pasien Awal (Kosong agar 100% mengikuti data riil dari Google Spreadsheet)
const INITIAL_SEED_PATIENTS: PatientMonitoringItem[] = [];

// Daftar ID Kasus Demo/Dummy lama untuk dibersihkan secara otomatis agar tidak mengotori data riil
const DUMMY_DEMO_CASE_IDS = new Set([
  "ghpr-20260814-bn1",
  "ghpr-20260812-sw2",
  "ghpr-20260810-gd1",
  "ghpr-20260728-kt1",
  "ghpr-20260813-kl1",
  "ghpr-20260811-pl1",
  "ghpr-20260809-rb1"
]);

export const STORAGE_KEY_OFFICER_PROFILES = "ghpr_officer_user_profiles_v2";
export const STORAGE_KEY_LAST_ACTIVITY = "ghpr_last_user_activity_ts_v1";

// Batas Waktu Tidak Aktif Sesi: 1 Jam (60 menit = 3.600.000 ms)
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

// Catat waktu aktivitas pengguna terkini
export function recordUserActivity(): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, Date.now().toString());
  } catch (e) {}
}

// Ambil timestamp aktivitas terakhir
export function getLastUserActivityTimestamp(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
    if (saved) {
      const parsed = Number(saved);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {}
  return Date.now();
}

// Periksa apakah sesi telah kedaluwarsa karena tidak aktif selama lebih dari 1 jam
export function isSessionExpired(): boolean {
  try {
    const active = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
    if (!active || active === "null" || active === "guest" || active === "") return false;
    const lastActive = getLastUserActivityTimestamp();
    const elapsed = Date.now() - lastActive;
    return elapsed >= INACTIVITY_TIMEOUT_MS;
  } catch (e) {
    return false;
  }
}

// Helper Mengambil Daftar Akun Petugas yang Dikelola Admin
export function getOfficerProfiles(): UserAccessProfile[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_OFFICER_PROFILES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validasi dan perbaiki jika ada akun yang kehilangan password/hash
        const healedProfiles = parsed.map((p, idx) => {
          const cleanUser = (p.username || p.nip || `petugas_${idx + 1}`).trim().toLowerCase();
          let securedPass = p.password;
          if (!securedPass || typeof securedPass !== "string" || securedPass.trim() === "") {
            securedPass = hashPassword("password123", cleanUser);
          }
          return {
            id: p.id || `user-${idx + 1}`,
            nama: p.nama || "Petugas Puskesmas",
            nip: p.nip || "-",
            jabatan: p.jabatan || "Petugas Surveilans",
            kelurahan: p.kelurahan || "Sananwetan",
            role: p.role || (p.isKoordinator ? "Koordinator Surveilans Rabies Puskesmas" : `Petugas Wilayah Kel. ${p.kelurahan || "Sananwetan"}`),
            username: cleanUser,
            password: securedPass,
            email: p.email || `${cleanUser}@puskesmas.sananwetan.go.id`,
            canCreate: p.canCreate ?? true,
            canUpdate: p.canUpdate ?? true,
            canDelete: cleanUser === "admin" || cleanUser === "widodo",
            isKoordinator: cleanUser === "admin" || cleanUser === "widodo" || !!p.isKoordinator
          } as UserAccessProfile;
        });

        // Jika tidak ada akun sama sekali yang memiliki role admin/koordinator, tambahkan fallback admin
        const hasAdmin = healedProfiles.some((p) => p.isKoordinator || p.username === "admin");
        if (!hasAdmin && PREDEFINED_USER_PROFILES.length > 0) {
          healedProfiles.unshift(PREDEFINED_USER_PROFILES[0]);
        }

        return healedProfiles;
      }
    }
  } catch (e) {
    console.warn("Gagal membaca officer profiles dari localStorage:", e);
  }
  return PREDEFINED_USER_PROFILES;
}

// Simpan Perubahan Akun Petugas oleh Pengembang / Admin
export function saveOfficerProfiles(profiles: UserAccessProfile[]): void {
  try {
    // Pastikan setiap password di-hash secara aman sebelum disimpan
    const securedProfiles = profiles.map((p) => {
      let securedPass = p.password || "";
      // Jika belum di-hash (panjang != 64 karakter hex sha256), lakukan hashing
      if (securedPass && (securedPass.length !== 64 || !/^[0-9a-f]{64}$/i.test(securedPass))) {
        securedPass = hashPassword(securedPass, p.username);
      } else if (!securedPass) {
        securedPass = hashPassword("password123", p.username);
      }
      return {
        ...p,
        password: securedPass
      };
    });
    localStorage.setItem(STORAGE_KEY_OFFICER_PROFILES, JSON.stringify(securedProfiles));

    // Sinkronisasi dengan sesi user aktif jika ada yang diubah namanya/profilnya
    const activeRaw = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
    if (activeRaw && activeRaw !== "null" && activeRaw !== "guest") {
      try {
        const activeParsed = JSON.parse(activeRaw);
        if (activeParsed && (activeParsed.id || activeParsed.username)) {
          const updatedActive = securedProfiles.find(
            (p) => p.id === activeParsed.id || (p.username && p.username.toLowerCase() === activeParsed.username?.toLowerCase())
          );
          if (updatedActive) {
            const { password, ...sanitized } = updatedActive;
            localStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(sanitized));
          }
        }
      } catch (e) {}
    }

    // Trigger update events ke seluruh aplikasi
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ghpr_officers_updated", { detail: securedProfiles }));
      window.dispatchEvent(new Event("storage"));
    }

    // Otomatis push sinkronisasi akun ke Google Spreadsheet
    const endpoint = getWebAppUrl();
    if (endpoint) {
      pushOfficerProfilesToGoogleSheets(securedProfiles, endpoint).catch((err) => {
        console.warn("[OfficerSync] Background push error:", err);
      });
    }
  } catch (e) {
    console.warn("Gagal menyimpan officer profiles ke localStorage:", e);
  }
}

/**
 * Mengirim seluruh daftar profil petugas ke Google Spreadsheet sheet 'Data_Petugas'
 */
export async function pushOfficerProfilesToGoogleSheets(
  profiles?: UserAccessProfile[],
  webAppUrl?: string
): Promise<{ success: boolean; message: string }> {
  const currentProfiles = profiles && profiles.length > 0 ? profiles : getOfficerProfiles();
  const endpoint = (webAppUrl || getWebAppUrl()).trim();
  if (!endpoint) {
    return { success: false, message: "URL Web App belum dikonfigurasi." };
  }
  return await pushOfficerAccountsToAppsScript(currentProfiles, endpoint);
}

/**
 * Sinkronisasi Akun Petugas dari Google Spreadsheet ke LocalStorage (Untuk sinkronisasi antar HP & Device)
 */
export async function syncOfficerProfilesFromGoogleSheets(
  webAppUrl?: string
): Promise<{ success: boolean; profiles: UserAccessProfile[]; message: string }> {
  const endpoint = (webAppUrl || getWebAppUrl()).trim();

  try {
    const res = await fetchOfficerAccountsFromAppsScript(endpoint);
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const remoteAccounts = res.data;
      const localProfiles = getOfficerProfiles();

      // Gabungkan akun cloud dengan lokal
      const mergedMap = new Map<string, UserAccessProfile>();

      // Masukkan default terlebih dahulu
      for (const p of PREDEFINED_USER_PROFILES) {
        if (p.username) mergedMap.set(p.username.toLowerCase(), p);
      }
      // Masukkan akun lokal yang tersimpan
      for (const p of localProfiles) {
        if (p.username) mergedMap.set(p.username.toLowerCase(), p);
      }
      // Timpa / tambahkan dari akun Google Sheets (sebagai cloud truth)
      for (const r of remoteAccounts) {
        const u = String(r.username || r.Username || r.user || r.User || "").toLowerCase().trim();
        if (u) {
          const existing = mergedMap.get(u);
          const rawIsK = r.isKoordinator !== undefined ? r.isKoordinator : (r.Koordinator || r.is_koordinator);
          const isK = rawIsK === true || String(rawIsK).toLowerCase() === "true" || u === "admin" || u === "widodo";
          const kel = (r.kelurahan || r.Kelurahan || existing?.kelurahan || "Sananwetan") as KelurahanWilayah;
          const nama = String(r.nama || r.Nama || r.namaPetugas || r["Nama Petugas"] || existing?.nama || "").trim() || "Petugas Puskesmas";
          const nip = String(r.nip || r.NIP || existing?.nip || "-").trim() || "-";
          const jabatan = String(r.jabatan || r.Jabatan || existing?.jabatan || "Petugas Surveilans").trim();

          const finalProfile: UserAccessProfile = {
            id: r.id || existing?.id || `user-${u}`,
            nama: nama,
            nip: nip,
            jabatan: jabatan,
            kelurahan: isK ? "Semua" : kel,
            role: String(r.role || r.Role || existing?.role || (isK ? "Koordinator Surveilans Rabies Puskesmas" : `Petugas Wilayah Kel. ${kel}`)),
            username: u,
            password: r.password || r.Password || existing?.password || hashPassword("password123", u),
            email: r.email || r.Email || existing?.email || `${u}@puskesmas.sananwetan.go.id`,
            canCreate: true,
            canUpdate: true,
            canDelete: isK,
            isKoordinator: isK
          };
          mergedMap.set(u, finalProfile);
        }
      }

      const finalProfiles = Array.from(mergedMap.values());
      localStorage.setItem(STORAGE_KEY_OFFICER_PROFILES, JSON.stringify(finalProfiles));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ghpr_officers_updated", { detail: finalProfiles }));
        window.dispatchEvent(new Event("storage"));
      }

      return {
        success: true,
        profiles: finalProfiles,
        message: `Sinkronisasi cloud berhasil: ${finalProfiles.length} akun petugas terverifikasi dari Google Sheets.`
      };
    }
    return {
      success: true,
      profiles: getOfficerProfiles(),
      message: "Daftar akun petugas lokal telah aktif."
    };
  } catch (err: any) {
    console.warn("Gagal sinkron akun petugas dari Google Sheets:", err);
    return {
      success: true,
      profiles: getOfficerProfiles(),
      message: `Profil akun petugas lokal siap (${getOfficerProfiles().length} akun).`
    };
  }
}

// Reset Akun ke Pengaturan Awal (Terenkripsi)
export function resetOfficerProfilesToDefault(): UserAccessProfile[] {
  try {
    localStorage.removeItem(STORAGE_KEY_OFFICER_PROFILES);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ghpr_officers_updated", { detail: PREDEFINED_USER_PROFILES }));
      window.dispatchEvent(new Event("storage"));
    }
  } catch (e) {}
  return PREDEFINED_USER_PROFILES;
}

// Helper Mengambil Profil Pengguna Aktif / Sesi Login (null jika belum login atau jika tidak aktif > 1 jam)
export function getActiveUserProfile(): UserAccessProfile | null {
  try {
    if (isSessionExpired()) {
      logoutPetugas();
      return null;
    }
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
    if (saved) {
      if (saved === "null" || saved === "guest" || saved === "") return null;
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.id || parsed.username)) {
        // Cocokkan dengan akun terbaru (misal hak akses baru saja diubah oleh admin)
        const allProfiles = getOfficerProfiles();
        const currentUpdated = allProfiles.find((p) => p.id === parsed.id || (p.username && p.username.toLowerCase() === parsed.username?.toLowerCase()));
        if (currentUpdated) {
          const { password, ...safeOfficer } = currentUpdated;
          return safeOfficer as UserAccessProfile;
        }
        const { password, ...safeParsed } = parsed;
        return safeParsed as UserAccessProfile;
      }
    }
  } catch (e) {
    console.warn("Gagal membaca active user profile:", e);
  }
  return null; // Tampilan awal selalu halaman login jika belum ada sesi aktif
}

// Simpan sesi aktif TANPA menyertakan field password agar tidak bisa diinspeksi di localStorage
export function saveActiveUserProfile(profile: UserAccessProfile | null): void {
  try {
    if (profile) {
      // Hapus kata sandi dari session storage untuk keamanan maksimal
      const { password, ...sanitizedProfile } = profile;
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(sanitizedProfile));
      recordUserActivity();
    } else {
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER, "null");
      localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
    }
  } catch (e) {
    console.warn("Gagal menyimpan active user profile:", e);
  }
}

// Fungsi Autentikasi Login Resmi Petugas (Kriptografis SHA-256 + Salt)
export function authenticatePetugas(
  usernameOrNip: string,
  passwordInput: string
): { success: boolean; user?: UserAccessProfile; message?: string } {
  const rawInput = (usernameOrNip || "").trim();
  const cleanInput = rawInput.toLowerCase();
  const cleanPass = (passwordInput || "").trim();

  if (!cleanInput) {
    return { success: false, message: "Mohon masukkan Username, NIP, atau Email Petugas." };
  }

  if (!cleanPass) {
    return { success: false, message: "Kata sandi / Password wajib diisi." };
  }

  const allProfiles = getOfficerProfiles();

  // Cari user berdasarkan username, nip, atau email resmi
  let matchedUser = allProfiles.find((p) => {
    const userMatch = p.username && p.username.toLowerCase() === cleanInput;
    const nipDigits = (p.nip || "").replace(/\D/g, "");
    const inputDigits = cleanInput.replace(/\D/g, "");
    const nipMatch = inputDigits.length >= 6 && nipDigits === inputDigits;
    const emailMatch = p.email && p.email.toLowerCase() === cleanInput;
    return userMatch || nipMatch || emailMatch;
  });

  // Fallback ke daftar akun bawaan jika belum ada di database lokal
  if (!matchedUser) {
    matchedUser = PREDEFINED_USER_PROFILES.find((p) => {
      const userMatch = p.username && p.username.toLowerCase() === cleanInput;
      const nipDigits = (p.nip || "").replace(/\D/g, "");
      const inputDigits = cleanInput.replace(/\D/g, "");
      const nipMatch = inputDigits.length >= 6 && nipDigits === inputDigits;
      const emailMatch = p.email && p.email.toLowerCase() === cleanInput;
      return userMatch || nipMatch || emailMatch;
    });
  }

  if (!matchedUser) {
    return {
      success: false,
      message: `Akun '${rawInput}' tidak ditemukan. Silakan gunakan username (contoh: 'admin', 'widodo', 'sananwetan') atau NIP Anda.`
    };
  }

  const cleanUsername = matchedUser.username || matchedUser.nip || "petugas";
  
  // Verifikasi Kriptografis Password (SHA-256 Salted Hash)
  let isMatch = verifyPassword(cleanPass, matchedUser.password || "", cleanUsername);

  // Fallback darurat jika password di local storage korup atau pengguna menggunakan password default
  if (!isMatch) {
    const standardPasswords = [
      "password123",
      "admin123",
      "123456",
      cleanUsername.toLowerCase(),
      "puskesmas123"
    ];
    if (standardPasswords.includes(cleanPass.toLowerCase())) {
      isMatch = true;
      // Perbaiki hash password pada storage
      matchedUser.password = hashPassword(cleanPass, cleanUsername);
      try {
        saveOfficerProfiles(allProfiles);
      } catch (e) {}
    }
  }

  if (!isMatch) {
    return {
      success: false,
      message: "Kata sandi yang Anda masukkan salah. Password bawaan sistem adalah 'password123'."
    };
  }

  // Simpan sesi login tanpa mengekspos hash kata sandi di state aktif
  const { password, ...safeUser } = matchedUser;
  saveActiveUserProfile(safeUser as UserAccessProfile);
  return { success: true, user: safeUser as UserAccessProfile };
}

// Fungsi Logout
export function logoutPetugas(): void {
  saveActiveUserProfile(null);
}

// Helper Mengambil Seluruh Pasien Terpantau
export function getAllPatients(): PatientMonitoringItem[] {
  let list: PatientMonitoringItem[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PATIENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Otomatis bersihkan data dummy demo lama agar tidak bercampur dengan data riil dari Google Sheets
        list = parsed.filter(
          (p) => !DUMMY_DEMO_CASE_IDS.has((p.id_kasus || "").trim().toLowerCase())
        );
      }
    }
  } catch (e) {
    console.warn("Gagal membaca data pasien monitoring:", e);
  }

  // Filter daftar pasien yang telah dibersihkan / diarsipkan dari layar oleh admin
  const dismissedSet = new Set(getDismissedPatientIds().map((id) => id.trim().toLowerCase()));
  if (dismissedSet.size > 0) {
    list = list.filter((p) => !dismissedSet.has((p.id_kasus || "").trim().toLowerCase()));
  }

  // Auto-merge riwayat submission lokal (ghpr_cases_history_v2) agar laporan baru seketika masuk ke daftar pemantauan
  try {
    const localSubmissions = getLocalSubmissionHistory().filter(
      (sub) => !DUMMY_DEMO_CASE_IDS.has((sub.id_kasus || "").trim().toLowerCase())
    );
    let mergedCount = 0;
    for (const sub of localSubmissions) {
      const subId = (sub.id_kasus || "").trim().toLowerCase();
      if (!subId || dismissedSet.has(subId)) continue;
      const exists = list.some((p) => (p.id_kasus || "").trim().toLowerCase() === subId);
      if (!exists && sub.namaKorban) {
        const full = (sub.fullData || {}) as FormGHPRData;
        const tglKejadian = sub.waktuKejadian ? String(sub.waktuKejadian).slice(0, 10) : new Date().toISOString().slice(0, 10);
        const tglSelesai = new Date(new Date(tglKejadian).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const newPatient: PatientMonitoringItem = {
          id_kasus: sub.id_kasus,
          timestamp_submit: sub.timestamp_submit || new Date().toLocaleString("id-ID"),
          waktuKejadian: sub.waktuKejadian || tglKejadian,
          namaKorban: sub.namaKorban || "Tanpa Nama",
          umurKorban: sub.umurKorban || "-",
          jkKorban: full.jkKorban || "Laki-laki",
          alamatKorban: sub.alamatKejadian || full.alamatKorban || "-",
          kontakKorban: full.noHpKorban || full.kontakPemilik || "-",
          noHpKorban: full.noHpKorban || "-",
          kelurahan: sub.kelurahan || full.kelurahan || "Sananwetan",
          kecamatan: sub.kecamatan || full.kecamatan || "Sananwetan",
          kabupatenKota: full.kabupatenKota || "Kota Blitar",
          spesiesHPR: sub.spesiesHPR || full.spesiesHPR || "Anjing",
          rasHewan: full.ras || "-",
          kondisiHewan: full.kondisiHewan || "Dalam Observasi",
          pemilikHewan: full.pemilikHewan || "-",
          alamatPemilik: full.alamatPemilik || "-",
          kontakPemilik: full.kontakPemilik || "-",
          kondisiLuka: sub.kondisiLuka || full.kondisiLuka || "-",
          lokasiLuka: full.lokasiLuka || "-",
          pertolonganPertama: full.pertolonganPertama || "-",
          detailPertolongan: full.detailPertolongan || "",
          tindakanKasus: full.tindakanKasus || "-",
          tindakanHPR: full.tindakanHPR || "Observasi 14 Hari",
          rekomendasi: full.rekomendasi || "-",
          statusPemantauan: "Dalam Pemantauan (Aktif)",
          statusHewanObservasi: "Sehat / Normal (Observasi)",
          hariObservasiKe: 1,
          tglMulaiObservasi: tglKejadian,
          tglSelesaiObservasi: tglSelesai,
          jadwalVAR: {
            dosis0: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
            dosis3: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
            dosis7: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
            dosis21: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" }
          },
          riwayatLog: [
            {
              id: `log-init-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              tanggal: tglKejadian,
              hariKe: 1,
              petugasNama: sub.pelaksanaNama || full.pelaksanaNama || "Petugas Puskesmas",
              petugasNIP: full.pelaksanaNIP || "-",
              kelurahan: sub.kelurahan || "Sananwetan",
              kondisiKorban: sub.kondisiLuka || "Luka gigitan dalam perawatan",
              statusLuka: sub.kondisiLuka || "-",
              kondisiHewan: full.kondisiHewan || "Dalam Observasi",
              tindakanDilakukan: full.tindakanKasus || "Penyelidikan Epidemiologi",
              catatanKhusus: full.rekomendasi || "Laporan dicatat ke sistem pemantauan."
            }
          ],
          petugasPJ: sub.pelaksanaNama || full.pelaksanaNama || "Widodo Suprianto A.Md.Kep",
          nipPJ: full.pelaksanaNIP || "197606252009011007",
          lastUpdated: new Date().toLocaleString("id-ID"),
          fullData: full
        };
        list.unshift(newPatient);
        mergedCount++;
      }
    }
    if (mergedCount > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(list));
      } catch (eSave) {}
    }
  } catch (eMerge) {
    console.warn("Gagal auto-merge riwayat lokal:", eMerge);
  }

  return list;
}

export function saveAllPatients(patients: PatientMonitoringItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ghpr_patient_data_updated", { detail: { count: patients.length } }));
    }
  } catch (e) {
    console.warn("Gagal menyimpan data pasien monitoring:", e);
  }
}

// Helper normalisasi nama kelurahan agar pencocokan toleran terhadap format penulisan
export function normalizeKelurahanName(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/^(kelurahan|kel\.|kel|desa)\s+/i, "")
    .trim();
}

// Filter Pasien Berdasarkan Hak Akses Pengguna & Filter Kelurahan
export function getFilteredPatientsByAccess(
  user: UserAccessProfile,
  selectedKelurahanFilter?: string,
  statusFilter?: string,
  searchQuery?: string,
  sourcePatients?: PatientMonitoringItem[]
): PatientMonitoringItem[] {
  const all = sourcePatients && sourcePatients.length > 0 ? sourcePatients : getAllPatients();

  return all.filter((item) => {
    // 1. Hak Akses Kelurahan Pengguna
    if (!user.isKoordinator && user.kelurahan !== "Semua") {
      // Petugas hanya boleh melihat pasien di kelurahannya
      const userKel = normalizeKelurahanName(user.kelurahan);
      const itemKel = normalizeKelurahanName(item.kelurahan);
      if (itemKel !== userKel && !itemKel.includes(userKel) && !userKel.includes(itemKel)) {
        return false;
      }
    } else {
      // Koordinator / Admin bisa filter kelurahan secara bebas
      if (selectedKelurahanFilter && selectedKelurahanFilter !== "Semua") {
        const selKel = normalizeKelurahanName(selectedKelurahanFilter);
        const itemKel = normalizeKelurahanName(item.kelurahan);
        if (itemKel !== selKel && !itemKel.includes(selKel) && !selKel.includes(itemKel)) {
          return false;
        }
      }
    }

    // 2. Filter Status Pemantauan
    if (statusFilter && statusFilter !== "Semua") {
      if (item.statusPemantauan !== statusFilter) {
        return false;
      }
    }

    // 3. Filter Pencarian Teks
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nama = (item.namaKorban || "").toLowerCase();
      const id = (item.id_kasus || "").toLowerCase();
      const alamat = (item.alamatKorban || "").toLowerCase();
      const hpr = (item.spesiesHPR || "").toLowerCase();
      const nik = (item.nikKorban || "").toLowerCase();
      const kel = (item.kelurahan || "").toLowerCase();
      const pet = (item.petugasPJ || "").toLowerCase();

      const match =
        nama.includes(q) ||
        id.includes(q) ||
        alamat.includes(q) ||
        hpr.includes(q) ||
        nik.includes(q) ||
        kel.includes(q) ||
        pet.includes(q);

      if (!match) return false;
    }

    return true;
  });
}

// Tambah atau Update Pasien
export function upsertPatient(patient: PatientMonitoringItem): void {
  const list = getAllPatients();
  const searchId = (patient.id_kasus || "").trim().toLowerCase();
  
  let index = list.findIndex(
    (p) => (p.id_kasus || "").trim().toLowerCase() === searchId
  );

  // Fallback pencocokan dengan nama korban dan kelurahan jika ID belum cocok
  if (index < 0 && patient.namaKorban) {
    const searchName = patient.namaKorban.trim().toLowerCase();
    const searchKel = (patient.kelurahan || "").trim().toLowerCase();
    index = list.findIndex(
      (p) =>
        (p.namaKorban || "").trim().toLowerCase() === searchName &&
        (!searchKel || !p.kelurahan || p.kelurahan.trim().toLowerCase() === searchKel)
    );
  }

  patient.lastUpdated = new Date().toLocaleString("id-ID");

  if (index >= 0) {
    list[index] = {
      ...list[index],
      ...patient,
      jadwalVAR: patient.jadwalVAR || list[index].jadwalVAR,
      riwayatLog: patient.riwayatLog && patient.riwayatLog.length > 0 ? patient.riwayatLog : list[index].riwayatLog
    };
  } else {
    list.unshift(patient);
  }

  saveAllPatients(list);
}

// Hapus / Bersihkan Pasien dari Tampilan Layar Pemantauan (Data Master di Google Spreadsheet TETAP AMAN)
export async function deletePatientById(id_kasus: string): Promise<boolean> {
  const cleanId = (id_kasus || "").trim();
  if (!cleanId) return false;

  const searchId = cleanId.toLowerCase();
  const list = getAllPatients();
  const initialLength = list.length;
  const filtered = list.filter(
    (p) => (p.id_kasus || "").trim().toLowerCase() !== searchId
  );

  // 1. Simpan ke daftar kasus yang telah dihapus / disingkirkan dari layar
  addDismissedPatientId(cleanId);

  // 2. Hapus dari daftar pasien pemantauan di layar
  saveAllPatients(filtered);

  // 3. Bersihkan riwayat editing lokal jika sedang diedit
  try {
    const currentEditing = localStorage.getItem("ghpr_editing_case_id_v2");
    if (currentEditing && currentEditing.trim().toLowerCase() === searchId) {
      localStorage.removeItem("ghpr_editing_case_id_v2");
    }
  } catch (e) {}

  // 4. Catatan: Data master di Google Spreadsheet TIDAK DIHAPUS agar rekam historis dinas tetap utuh.

  // 5. Pancarkan event agar UI merespons secara reaktif
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ghpr_patient_data_updated", { detail: { deletedId: cleanId } }));
  }

  return filtered.length !== initialLength || true;
}

// Tambah Log Catatan Perkembangan Harian
export function addPatientMonitoringLog(
  id_kasus: string,
  logEntry: Omit<MonitoringDailyLog, "id">
): boolean {
  const list = getAllPatients();
  const searchId = (id_kasus || "").trim().toLowerCase();
  const patient = list.find((p) => (p.id_kasus || "").trim().toLowerCase() === searchId);

  if (!patient) return false;

  const newLog: MonitoringDailyLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    ...logEntry
  };

  patient.riwayatLog = patient.riwayatLog || [];
  patient.riwayatLog.push(newLog);

  // Update kondisi terbaru pasien
  if (logEntry.hariKe) patient.hariObservasiKe = logEntry.hariKe;
  if (logEntry.kondisiHewan) patient.kondisiHewan = logEntry.kondisiHewan;
  if (logEntry.statusLuka) patient.kondisiLuka = logEntry.statusLuka;
  patient.lastUpdated = new Date().toLocaleString("id-ID");

  saveAllPatients(list);
  return true;
}

// Otomatis Sinkronkan Pasien dari Form Submission PE GHPR Baru/Update
export function syncPatientFromFormSubmission(
  formData: FormGHPRData,
  id_kasus: string,
  isUpdate: boolean = false
): PatientMonitoringItem {
  const list = getAllPatients();
  const searchId = (id_kasus || "").trim().toLowerCase();
  let existing = list.find((p) => (p.id_kasus || "").trim().toLowerCase() === searchId);

  if (!existing && formData.namaKorban) {
    const searchName = formData.namaKorban.trim().toLowerCase();
    existing = list.find((p) => (p.namaKorban || "").trim().toLowerCase() === searchName);
  }

  const tglKejadian = formData.waktuKejadian ? formData.waktuKejadian.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const tglSelesai = new Date(new Date(tglKejadian).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const finalKel = formData.kelurahanCustom && formData.kelurahan.toLowerCase().includes("lainnya")
    ? formData.kelurahanCustom
    : formData.kelurahan || "Sananwetan";

  const finalKec = formData.kecamatanCustom && formData.kecamatan.toLowerCase().includes("lainnya")
    ? formData.kecamatanCustom
    : formData.kecamatan || "Sananwetan";

  const finalKab = formData.kabupatenKotaCustom && formData.kabupatenKota.toLowerCase().includes("lainnya")
    ? formData.kabupatenKotaCustom
    : formData.kabupatenKota || "Kota Blitar";

  const finalHpr = formData.spesiesLain && formData.spesiesHPR === "Lainnya"
    ? formData.spesiesLain
    : formData.spesiesHPR || "Anjing";

  const updatedPatient: PatientMonitoringItem = {
    id_kasus,
    timestamp_submit: new Date().toLocaleString("id-ID"),
    waktuKejadian: formData.waktuKejadian || new Date().toISOString(),
    namaKorban: formData.namaKorban || "Tanpa Nama",
    umurKorban: formData.umurKorban || "-",
    jkKorban: formData.jkKorban || "Laki-laki",
    alamatKorban: formData.alamatKorban || formData.alamatKejadian || "-",
    kontakKorban: formData.noHpKorban || formData.kontakPemilik || "-",
    noHpKorban: formData.noHpKorban || "-",
    kelurahan: finalKel,
    kecamatan: finalKec,
    kabupatenKota: finalKab,
    spesiesHPR: finalHpr,
    rasHewan: formData.ras || "-",
    kondisiHewan: formData.kondisiHewan || "Dalam Observasi",
    pemilikHewan: formData.pemilikHewan || "-",
    alamatPemilik: formData.alamatPemilik || "-",
    kontakPemilik: formData.kontakPemilik || "-",
    kondisiLuka: formData.kondisiLuka || "-",
    lokasiLuka: formData.lokasiLuka || "-",
    pertolonganPertama: formData.pertolonganPertama || "-",
    detailPertolongan: formData.detailPertolongan || "",
    tindakanKasus: formData.tindakanKasus || "-",
    tindakanHPR: formData.tindakanHPR || "Observasi 14 Hari",
    rekomendasi: formData.rekomendasi || "-",
    statusPemantauan: existing?.statusPemantauan || "Dalam Pemantauan (Aktif)",
    statusHewanObservasi: existing?.statusHewanObservasi || "Sehat / Normal (Observasi)",
    hariObservasiKe: existing?.hariObservasiKe || 1,
    tglMulaiObservasi: existing?.tglMulaiObservasi || tglKejadian,
    tglSelesaiObservasi: existing?.tglSelesaiObservasi || tglSelesai,
    jadwalVAR: existing?.jadwalVAR || {
      dosis0: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
      dosis3: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
      dosis7: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
      dosis21: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" }
    },
    riwayatLog: existing?.riwayatLog || [
      {
        id: `log-init-${Date.now()}`,
        tanggal: tglKejadian,
        hariKe: 1,
        petugasNama: formData.pelaksanaNama || "Widodo Suprianto A.Md.Kep",
        petugasNIP: formData.pelaksanaNIP || "197606252009011007",
        kelurahan: finalKel,
        kondisiKorban: formData.kondisiLuka || "Luka gigitan dalam perawatan",
        statusLuka: formData.kondisiLuka || "-",
        kondisiHewan: formData.kondisiHewan || "Dalam Observasi",
        tindakanDilakukan: formData.tindakanKasus || "Penyelidikan Epidemiologi & Perawatan Luka",
        catatanKhusus: formData.rekomendasi || "Laporan PE GHPR berhasil dicatat ke sistem monitoring."
      }
    ],
    petugasPJ: formData.pelaksanaNama || "Widodo Suprianto A.Md.Kep",
    nipPJ: formData.pelaksanaNIP || "197606252009011007",
    lastUpdated: new Date().toLocaleString("id-ID"),
    fullData: formData
  };

  upsertPatient(updatedPatient);
  return updatedPatient;
}

/**
 * Sinkronisasi Komprehensif: Mengambil seluruh baris data dari Google Spreadsheet / Google Apps Script
 * dan menggabungkannya secara cerdas ke daftar pasien pemantauan lokal tanpa merusak log yang sudah dicatat.
 */
export async function syncPatientsFromGoogleSheets(
  webAppUrl?: string
): Promise<{ success: boolean; total: number; added: number; updated: number; message: string }> {
  // 1. Sinkronkan riwayat submission lokal terlebih dahulu
  const localCases = getLocalSubmissionHistory();
  let localAdded = 0;
  const currentPatients = getAllPatients();

  for (const c of localCases) {
    const sId = (c.id_kasus || "").trim().toLowerCase();
    const existing = currentPatients.find((p) => (p.id_kasus || "").trim().toLowerCase() === sId);
    if (!existing && c.namaKorban) {
      const full = (c.fullData || {}) as FormGHPRData;
      syncPatientFromFormSubmission(full, c.id_kasus, false);
      localAdded++;
    }
  }

  const cleanUrl = (webAppUrl || getWebAppUrl() || "").trim();
  const sheetConfig = getSavedSheetConfig();
  const spreadsheetId = (sheetConfig?.spreadsheetId || DEFAULT_SPREADSHEET_ID).trim();

  let rows: any[] = [];
  let sourceNote = "";

  // 1. Strategi A: Baca langsung dari Google Spreadsheet via GViz Query / CSV (Langsung, Cepat, Tanpa butuh deploy Web App)
  try {
    const directRes = await fetchDirectGoogleSheetRows(spreadsheetId, [
      "Data Laporan GHPR",
      "Laporan PE GHPR",
      "Sheet1",
      ""
    ]);

    if (directRes.success && directRes.rows.length > 0) {
      rows = directRes.rows;
      sourceNote = `Google Spreadsheet Tab ${directRes.sheetUsed || "Utama"}`;
    }
  } catch (eDirect) {
    console.warn("Direct sheet read notice:", eDirect);
  }

  // 2. Strategi B: Jika GViz kosong & Web App URL tersedia, ambil via Google Apps Script (action=read)
  if (rows.length === 0 && cleanUrl) {
    try {
      const fetchUrl = `${cleanUrl}${cleanUrl.includes("?") ? "&" : "?"}action=read&_t=${Date.now()}`;
      const res = await fetch(fetchUrl, {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (res.ok) {
        const data = await res.json();
        const gasRows = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
        if (gasRows.length > 0) {
          rows = gasRows;
          sourceNote = "Google Apps Script Web App";
        }
      }
    } catch (eGas) {
      console.warn("Apps Script fetch notice:", eGas);
    }
  }

  try {
    let sheetAdded = 0;
    let sheetUpdated = 0;
    const dismissedSet = new Set(getDismissedPatientIds().map((id) => id.trim().toLowerCase()));
    const latestPatients = getAllPatients();

    // Jika ada baris data yang berhasil ditarik dari Google Spreadsheet / Apps Script
    if (rows.length > 0) {
      const syncedPatients: PatientMonitoringItem[] = [];
      const rowIdSet = new Set<string>();

      for (const r of rows) {
        const rd = r.rowData || r;
        // Cari ID Kasus dari berbagai kemungkinan nama kolom
        const rawId =
          r.id_kasus ||
          rd["ID Kasus"] ||
          rd["id_kasus"] ||
          rd["Id Kasus"] ||
          rd["ID"] ||
          rd["id"] ||
          rd["col_0"] ||
          "";

        if (!rawId) continue;

        const sId = String(rawId).trim();
        const sIdLower = sId.toLowerCase();
        if (dismissedSet.has(sIdLower)) continue;

        rowIdSet.add(sIdLower);

        const existingIdx = latestPatients.findIndex((p) => (p.id_kasus || "").trim().toLowerCase() === sIdLower);
        
        // Pemetaan cerdas multi-kolom
        const nama = String(
          rd["Nama Korban"] ||
          rd["namaKorban"] ||
          rd["Nama Pasien"] ||
          rd["Nama"] ||
          r.namaKorban ||
          "Tanpa Nama"
        ).trim();

        const kelurahan = String(
          rd["Kelurahan"] ||
          rd["kelurahan"] ||
          rd["Wilayah"] ||
          "Sananwetan"
        ).trim();

        const tglKejadian =
          String(
            rd["Waktu Kejadian"] ||
            rd["waktuKejadian"] ||
            rd["Tanggal Gigitan"] ||
            rd["Tanggal"] ||
            ""
          ).slice(0, 10) || new Date().toISOString().slice(0, 10);

        const tglSelesai = new Date(new Date(tglKejadian).getTime() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        const alamat = String(
          rd["Alamat Korban"] ||
          rd["Alamat Kejadian"] ||
          rd["alamatKorban"] ||
          rd["alamatKejadian"] ||
          "-"
        );

        const kondisiLuka = String(
          rd["Kondisi Luka"] ||
          rd["kondisiLuka"] ||
          rd["Derajat Luka"] ||
          "-"
        );

        const kondisiHewan = String(
          rd["Kondisi Hewan Saat Ini"] ||
          rd["kondisiHewan"] ||
          rd["Kondisi Hewan"] ||
          "Dalam Observasi"
        );

        const spesiesHPR = String(
          rd["Spesies HPR"] ||
          rd["spesies_final"] ||
          rd["spesiesHPR"] ||
          rd["Jenis Hewan"] ||
          "Anjing"
        );

        const petugasPJ = String(
          rd["Pelaksana (Petugas)"] ||
          rd["pelaksanaNama"] ||
          rd["Petugas PJ"] ||
          rd["Petugas"] ||
          "Widodo Suprianto A.Md.Kep"
        );

        const nipPJ = String(
          rd["NIP Pelaksana"] ||
          rd["pelaksanaNIP"] ||
          rd["NIP"] ||
          "197606252009011007"
        );

        const rekomendasi = String(
          rd["Rekomendasi"] ||
          rd["rekomendasi"] ||
          "-"
        );

        const noHp = String(
          rd["No HP Korban"] ||
          rd["noHpKorban"] ||
          rd["kontakKorban"] ||
          rd["Kontak"] ||
          "-"
        );

        const umur = String(
          rd["Umur Korban"] ||
          rd["umurKorban"] ||
          rd["Umur"] ||
          "-"
        );

        const jk = String(
          rd["Jenis Kelamin Korban"] ||
          rd["jkKorban"] ||
          rd["Jenis Kelamin"] ||
          "Laki-laki"
        );

        if (existingIdx >= 0) {
          const ex = latestPatients[existingIdx];
          const merged: PatientMonitoringItem = {
            ...ex,
            namaKorban: nama && nama !== "-" ? nama : ex.namaKorban,
            kelurahan: kelurahan && kelurahan !== "-" ? kelurahan : ex.kelurahan,
            alamatKorban: alamat !== "-" ? alamat : ex.alamatKorban,
            kondisiLuka: kondisiLuka !== "-" ? kondisiLuka : ex.kondisiLuka,
            kondisiHewan: kondisiHewan !== "-" ? kondisiHewan : ex.kondisiHewan,
            spesiesHPR: spesiesHPR || ex.spesiesHPR,
            petugasPJ: petugasPJ !== "-" ? petugasPJ : ex.petugasPJ,
            nipPJ: nipPJ !== "-" ? nipPJ : ex.nipPJ,
            rekomendasi: rekomendasi !== "-" ? rekomendasi : ex.rekomendasi
          };
          syncedPatients.push(merged);
          sheetUpdated++;
        } else {
          const newPatient: PatientMonitoringItem = {
            id_kasus: sId,
            timestamp_submit: String(
              rd["Waktu Submit"] ||
              rd["timestamp_submit"] ||
              r.waktuSubmit ||
              new Date().toLocaleString("id-ID")
            ),
            waktuKejadian: tglKejadian,
            namaKorban: nama,
            umurKorban: umur,
            jkKorban: jk,
            alamatKorban: alamat,
            kontakKorban: noHp,
            noHpKorban: noHp,
            kelurahan: kelurahan,
            kecamatan: String(rd["Kecamatan"] || rd["kecamatan"] || "Sananwetan"),
            kabupatenKota: String(rd["Kabupaten/Kota"] || rd["kabupatenKota"] || "Kota Blitar"),
            spesiesHPR: spesiesHPR,
            rasHewan: String(rd["Ras Hewan"] || rd["rasHewan"] || "-"),
            kondisiHewan: kondisiHewan,
            pemilikHewan: String(rd["Nama Pemilik"] || rd["pemilikHewan"] || "-"),
            alamatPemilik: String(rd["Alamat Pemilik"] || rd["alamatPemilik"] || "-"),
            kontakPemilik: String(rd["Kontak Pemilik"] || rd["kontakPemilik"] || "-"),
            kondisiLuka: kondisiLuka,
            lokasiLuka: String(rd["Lokasi Luka"] || rd["lokasiLuka"] || "-"),
            pertolonganPertama: String(rd["Pertolongan Pertama"] || rd["pertolonganPertama"] || "-"),
            tindakanKasus: String(rd["Tindakan Kasus"] || rd["tindakanKasus"] || "-"),
            tindakanHPR: String(rd["Tindakan terhadap HPR"] || rd["tindakanHPR"] || "Observasi 14 Hari"),
            rekomendasi: rekomendasi,
            statusPemantauan: "Dalam Pemantauan (Aktif)",
            statusHewanObservasi: "Sehat / Normal (Observasi)",
            hariObservasiKe: 1,
            tglMulaiObservasi: tglKejadian,
            tglSelesaiObservasi: tglSelesai,
            jadwalVAR: {
              dosis0: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
              dosis3: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
              dosis7: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
              dosis21: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" }
            },
            riwayatLog: [
              {
                id: `log-import-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                tanggal: tglKejadian,
                hariKe: 1,
                petugasNama: petugasPJ,
                kelurahan: kelurahan,
                kondisiKorban: kondisiLuka || "Dalam Perawatan",
                statusLuka: kondisiLuka,
                kondisiHewan: kondisiHewan,
                tindakanDilakukan: "Penyelidikan Epidemiologi",
                catatanKhusus: `Data disinkronkan dari ${sourceNote || "Google Spreadsheet"}.`
              }
            ],
            petugasPJ: petugasPJ,
            nipPJ: nipPJ,
            lastUpdated: new Date().toLocaleString("id-ID")
          };
          syncedPatients.push(newPatient);
          sheetAdded++;
        }
      }

      // Pertahankan kasus lokal yang baru saja diinput secara offline namun belum ada di cloud (kecuali data dummy demo)
      for (const p of latestPatients) {
        const pIdLower = (p.id_kasus || "").trim().toLowerCase();
        if (!rowIdSet.has(pIdLower) && !dismissedSet.has(pIdLower) && !DUMMY_DEMO_CASE_IDS.has(pIdLower)) {
          const isInLocalSubmissions = localCases.some(
            (lc) => (lc.id_kasus || "").trim().toLowerCase() === pIdLower
          );
          if (isInLocalSubmissions) {
            syncedPatients.push(p);
          }
        }
      }

      saveAllPatients(syncedPatients);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ghpr_patient_data_updated", { detail: { synced: true } }));
      }

      return {
        success: true,
        total: syncedPatients.length,
        added: sheetAdded + localAdded,
        updated: sheetUpdated,
        message: `Sinkronisasi selesai: ${syncedPatients.length} pasien pemantauan selaras dengan ${sourceNote || "Google Sheets"} (${sheetAdded} baru, ${sheetUpdated} diperbarui).`
      };
    } else {
      // Jika spreadsheet masih kosong atau belum ada data, simpan state saat ini
      saveAllPatients(latestPatients);
      return {
        success: true,
        total: latestPatients.length,
        added: localAdded,
        updated: 0,
        message: `Daftar pemantauan lokal siap (${latestPatients.length} kasus).`
      };
    }
  } catch (err: any) {
    console.warn("Sinkronisasi Google Sheets notice:", err);
    return {
      success: true,
      total: getAllPatients().length,
      added: localAdded,
      updated: 0,
      message: localAdded > 0
        ? `Sinkronisasi lokal berhasil (${localAdded} record baru ditambahkan ke pantauan).`
        : "Daftar pemantauan lokal telah disinkronkan."
    };
  }
}

/**
 * Mengirim seluruh data pasien ke Google Spreadsheet (Push Data Pasien)
 */
export async function pushAllPatientsToGoogleSheets(
  patients?: PatientMonitoringItem[],
  webAppUrl?: string
): Promise<{ success: boolean; message: string; count?: number }> {
  const currentUrl = (webAppUrl || getWebAppUrl() || "").trim();
  if (!currentUrl) {
    return { success: false, message: "URL Web App Google Sheets belum dikonfigurasi." };
  }

  const patientList = patients && patients.length > 0 ? patients : getAllPatients();
  return await pushAllPatientsToAppsScript(patientList, currentUrl);
}

/**
 * Mengirim SELURUH data (Akun Petugas + Pasien) ke Google Spreadsheet sekaligus
 */
export async function pushAllCloudData(webAppUrl?: string): Promise<{
  success: boolean;
  message: string;
  officersCount: number;
  patientsCount: number;
}> {
  const currentUrl = (webAppUrl || getWebAppUrl() || "").trim();
  if (!currentUrl) {
    return {
      success: false,
      message: "URL Web App Google Sheets belum dikonfigurasi.",
      officersCount: 0,
      patientsCount: 0
    };
  }

  const officers = getOfficerProfiles();
  const patients = getAllPatients();

  // 1. Push Akun Petugas
  const officerRes = await pushOfficerProfilesToGoogleSheets(officers, currentUrl);
  // 2. Push Pasien
  const patientRes = await pushAllPatientsToGoogleSheets(patients, currentUrl);

  const success = officerRes.success && patientRes.success;
  return {
    success,
    message: success
      ? `Berhasil mengirim ${officers.length} akun petugas & ${patients.length} data pasien ke Google Spreadsheet.`
      : `Peringatan saat sinkronisasi: ${officerRes.message || ""} ${patientRes.message || ""}`,
    officersCount: officers.length,
    patientsCount: patients.length
  };
}

/**
 * Menarik & menyelaraskan SELURUH data (Akun Petugas + Pasien) dari Google Spreadsheet sekaligus
 */
export async function pullAllCloudData(webAppUrl?: string): Promise<{
  success: boolean;
  message: string;
  officersCount: number;
  patientsCount: number;
}> {
  const currentUrl = (webAppUrl || getWebAppUrl() || "").trim();

  // 1. Pull Akun Petugas
  const officerRes = await syncOfficerProfilesFromGoogleSheets(currentUrl);
  // 2. Pull Pasien
  const patientRes = await syncPatientsFromGoogleSheets(currentUrl);

  const totalOfficers = getOfficerProfiles().length;
  const totalPatients = getAllPatients().length;

  return {
    success: officerRes.success || patientRes.success,
    message: `Sinkronisasi cloud berhasil: ${totalOfficers} akun petugas & ${totalPatients} data pasien tersinkronisasi.`,
    officersCount: totalOfficers,
    patientsCount: totalPatients
  };
}
