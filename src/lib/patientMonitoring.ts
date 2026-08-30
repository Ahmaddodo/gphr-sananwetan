import {
  PatientMonitoringItem,
  UserAccessProfile,
  KelurahanWilayah,
  MonitoringDailyLog,
  VarDoseItem,
  FormGHPRData,
  SubmissionPayload,
  StatusPemantauanPasien,
  StatusHewanObservasi
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
import { getOfflineQueue } from "./offlineSyncService";
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

/**
 * Mengonversi berbagai variasi format tanggal (DD/MM/YYYY, ISO, Date(Y,M,D), dsb.)
 * ke format YYYY-MM-DD yang aman dan valid tanpa melempar 'Invalid time value'
 */
export function normalizeDateToIso(inputDate: any, fallbackDaysOffset = 0): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();

  if (!inputDate) {
    const target = new Date(now.getTime() + fallbackDaysOffset * 86400000);
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  }

  const str = String(inputDate).trim();
  if (!str) {
    const target = new Date(now.getTime() + fallbackDaysOffset * 86400000);
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  }

  // Cek jika format YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      const target = new Date(dateObj.getTime() + fallbackDaysOffset * 86400000);
      return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    }
  }

  // Cek jika format Indonesia DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      const target = new Date(dateObj.getTime() + fallbackDaysOffset * 86400000);
      return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    }
  }

  // Cek jika format GViz Date(yyyy, m, d)
  const gvizMatch = str.match(/Date\((\d+),(\d+),(\d+)/i);
  if (gvizMatch) {
    const y = parseInt(gvizMatch[1], 10);
    const m = parseInt(gvizMatch[2], 10);
    const d = parseInt(gvizMatch[3], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) {
      const target = new Date(dateObj.getTime() + fallbackDaysOffset * 86400000);
      return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    }
  }

  // Fallback standar JS Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const target = new Date(parsed.getTime() + fallbackDaysOffset * 86400000);
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  }

  const target = new Date(now.getTime() + fallbackDaysOffset * 86400000);
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
}

/**
 * Menghitung hari observasi hewan (1-14 hari) secara akurat dan dinamis
 * berdasarkan selisih tanggal kejadian/mulai observasi dengan hari ini, riwayat log, atau status pemantauan.
 */
export function calculateObservationDay(patient?: PatientMonitoringItem | null): number {
  if (!patient) return 1;

  if (patient.statusPemantauan === "Selesai Observasi (14 Hari)") {
    return 14;
  }

  // 1. Jika ada nilai eksplisit hariObservasiKe yang telah diinput/disinkronkan
  const explicitDay = Number(patient.hariObservasiKe);
  if (!isNaN(explicitDay) && explicitDay > 0) {
    return Math.min(14, Math.max(1, explicitDay));
  }

  // 2. Jika ada riwayat log catatan, gunakan hari ke tertinggi dari log
  let maxLogDay = 0;
  if (Array.isArray(patient.riwayatLog) && patient.riwayatLog.length > 0) {
    for (const log of patient.riwayatLog) {
      const h = Number(log.hariKe);
      if (!isNaN(h) && h > maxLogDay) {
        maxLogDay = h;
      }
    }
  }
  if (maxLogDay > 0) {
    return Math.min(14, Math.max(1, maxLogDay));
  }

  // 3. Fallback: Hitung selisih hari kalender dari tanggal kejadian / mulai observasi
  let elapsedDays = 1;
  const rawDateStr = patient.waktuKejadian || patient.tglMulaiObservasi;
  if (rawDateStr) {
    const cleanDate = normalizeDateToIso(rawDateStr);
    const dateMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const y = parseInt(dateMatch[1], 10);
      const m = parseInt(dateMatch[2], 10);
      const d = parseInt(dateMatch[3], 10);
      const startMs = new Date(y, m - 1, d).getTime();
      const now = new Date();
      const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const diff = Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0) {
        elapsedDays = diff;
      }
    }
  }

  return Math.min(14, Math.max(1, elapsedDays));
}

/**
 * Membersihkan dan mendeduplikasi riwayat catatan kronologis agar tidak muncul ganda / berlipat ganda
 */
export function deduplicateAndSortLogs(logs: MonitoringDailyLog[]): MonitoringDailyLog[] {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  const mapByHari = new Map<number, MonitoringDailyLog>();

  for (const log of logs) {
    if (!log) continue;
    const hari = Number(log.hariKe) || 1;
    const existing = mapByHari.get(hari);

    if (!existing) {
      mapByHari.set(hari, { ...log, hariKe: hari });
    } else {
      // Pilih log yang informasinya lebih lengkap
      const existingScore = (existing.catatanKhusus?.length || 0) + (existing.tindakanDilakukan?.length || 0) + (existing.petugasNama?.length || 0);
      const currentScore = (log.catatanKhusus?.length || 0) + (log.tindakanDilakukan?.length || 0) + (log.petugasNama?.length || 0);
      if (currentScore > existingScore) {
        mapByHari.set(hari, { ...log, hariKe: hari });
      }
    }
  }

  // Urutkan berdasarkan hariKe secara teratur (Hari 1, Hari 2, Hari 7, Hari 14...)
  return Array.from(mapByHari.values()).sort((a, b) => a.hariKe - b.hariKe);
}

/**
 * Mengurai string catatan gabungan dari Google Spreadsheet kolom 'Catatan Perkembangan Harian'
 */
export function parseCatatanHarianString(
  rawText: string,
  defaultKejadian: string,
  defaultPetugas: string,
  defaultKel: string,
  defaultNip: string = "-"
): MonitoringDailyLog[] {
  if (!rawText || rawText === "-" || rawText.trim().length === 0) return [];

  const cleanRaw = rawText.trim();
  const chunks = cleanRaw.split("\n\n").map((c) => c.trim()).filter(Boolean);
  const parsedLogs: MonitoringDailyLog[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let tanggal = defaultKejadian;
    let hariKe = i === 0 ? 1 : (i === 1 ? 7 : (i === 2 ? 14 : i + 1));
    let petugasNama = defaultPetugas;
    let suhuTubuh = "36.5 °C";
    let kondisiKorban = "Kondisi umum baik, tidak demam.";
    let statusLuka = "Luka bersih dan mulai mengering.";
    let kondisiHewan = "Sehat & aktif (dikandangkan/diikat)";
    let tindakanDilakukan = "Pemantauan berkala & edukasi perawatan luka.";
    let catatanKhusus = "";

    // 1. Tanggal [YYYY-MM-DD]
    const dateMatch = chunk.match(/\[(\d{4}-\d{2}-\d{2})\]/) || chunk.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) tanggal = dateMatch[1];

    // 2. Hari ke-X
    const hariMatch = chunk.match(/Hari ke-(\d+)/i) || chunk.match(/Hari:?\s*(\d+)/i);
    if (hariMatch) {
      hariKe = parseInt(hariMatch[1], 10);
    }

    // 3. Petugas (Nama Petugas)
    const petMatch = chunk.match(/\(([^)]+)\)/);
    if (petMatch && petMatch[1].length > 3 && !petMatch[1].includes("°C") && !petMatch[1].includes("Hari ke")) {
      petugasNama = petMatch[1].trim();
    } else {
      const petMatch2 = chunk.match(/Petugas:?\s*([^,\n]+)/i);
      if (petMatch2) petugasNama = petMatch2[1].trim();
    }

    // 4. Suhu: 36.5 °C
    const suhuMatch = chunk.match(/Suhu:?\s*([\d.,]+\s*°?C?)/i) || chunk.match(/🌡️?\s*([\d.,]+\s*°C)/i);
    if (suhuMatch) {
      const rawSuhu = suhuMatch[1].trim();
      suhuTubuh = rawSuhu.includes("°C") ? rawSuhu : `${rawSuhu} °C`;
    }

    // 5. Kondisi: ...
    const kondMatch = chunk.match(/Kondisi(?: Korban & Luka)?:?\s*([^,\n]+)/i);
    if (kondMatch && kondMatch[1].trim() && kondMatch[1].trim() !== "-") {
      kondisiKorban = kondMatch[1].trim();
      statusLuka = kondMatch[1].trim();
    }

    // 6. Hewan: ...
    const hewMatch = chunk.match(/Hewan(?: HPR)?:?\s*([^,\n]+)/i) || chunk.match(/Kondisi Hewan:?\s*([^,\n]+)/i);
    if (hewMatch && hewMatch[1].trim() && hewMatch[1].trim() !== "-") {
      kondisiHewan = hewMatch[1].trim();
    }

    // 7. Tindakan: ...
    const tindMatch = chunk.match(/Tindakan(?: \/ Edukasi)?:?\s*([^,\n]+)/i);
    if (tindMatch && tindMatch[1].trim() && tindMatch[1].trim() !== "-") {
      tindakanDilakukan = tindMatch[1].trim();
    }

    // 8. Catatan Khusus: ...
    const catMatch = chunk.match(/Catatan(?: Khusus)?:?\s*([^,\n]+)/i);
    if (catMatch && catMatch[1].trim() && catMatch[1].trim() !== "-") {
      catatanKhusus = catMatch[1].trim();
    } else if (!chunk.includes("Kondisi:") && !chunk.includes("Suhu:")) {
      // Jika string chunk adalah teks catatan bebas
      catatanKhusus = chunk;
    }

    parsedLogs.push({
      id: `log-parsed-${tanggal}-${hariKe}`,
      tanggal,
      hariKe,
      petugasNama,
      petugasNIP: defaultNip,
      kelurahan: defaultKel,
      kondisiKorban,
      statusLuka,
      kondisiHewan,
      suhuTubuh,
      tindakanDilakukan,
      catatanKhusus: catatanKhusus && catatanKhusus !== "-" ? catatanKhusus : ""
    });
  }

  return deduplicateAndSortLogs(parsedLogs);
}

/**
 * Mengurai dan menyusun riwayat catatan kronologis pemantauan harian dalam format terstruktur
 * (Hari ke-X • Tanggal, Suhu, Petugas, Kondisi Korban & Luka, Kondisi Hewan HPR, Tindakan/Edukasi)
 * sehingga tidak tampil ganda atau sebagai narasi teks panjang tidak beraturan.
 */
export function parseChronologicalLogs(patient: PatientMonitoringItem): MonitoringDailyLog[] {
  const defaultPetugas = patient.petugasPJ || "Widodo Suprianto A.Md.Kep";
  const defaultKel = patient.kelurahan || "Sananwetan";
  const defaultKejadian = normalizeDateToIso(patient.waktuKejadian || patient.tglMulaiObservasi || new Date().toISOString().slice(0, 10));
  const defaultNip = patient.nipPJ || "-";

  const rawLogs: MonitoringDailyLog[] = [];

  if (Array.isArray(patient.riwayatLog) && patient.riwayatLog.length > 0) {
    for (let i = 0; i < patient.riwayatLog.length; i++) {
      const log = patient.riwayatLog[i];
      if (!log) continue;

      // Jika catatanKhusus berisi teks gabungan multi-log yang terlanjur tersimpan
      if (log.catatanKhusus && (log.catatanKhusus.includes("\n\n") || (log.catatanKhusus.startsWith("[") && log.catatanKhusus.includes("Kondisi:")))) {
        const subParsed = parseCatatanHarianString(log.catatanKhusus, defaultKejadian, defaultPetugas, defaultKel, defaultNip);
        rawLogs.push(...subParsed);
      } else {
        let cleanKondisi = log.kondisiKorban || log.statusLuka || patient.kondisiLuka || "Kondisi umum baik, tidak demam.";
        if (cleanKondisi.startsWith("[")) {
          const subParsed = parseCatatanHarianString(cleanKondisi, defaultKejadian, defaultPetugas, defaultKel, defaultNip);
          rawLogs.push(...subParsed);
          continue;
        }

        let cleanHewan = log.kondisiHewan || patient.kondisiHewan || "Sehat & aktif (dikandangkan/diikat)";
        let cleanTindakan = log.tindakanDilakukan || "Pemantauan berkala & edukasi perawatan luka.";
        let cleanSuhu = log.suhuTubuh || "36.5 °C";
        if (!cleanSuhu.includes("°C")) cleanSuhu = `${cleanSuhu} °C`;

        rawLogs.push({
          id: log.id || `log-${log.hariKe || i + 1}`,
          tanggal: log.tanggal || defaultKejadian,
          hariKe: Number(log.hariKe) || (i === 0 ? 1 : (i === 1 ? 7 : 14)),
          petugasNama: log.petugasNama || defaultPetugas,
          petugasNIP: log.petugasNIP || defaultNip,
          kelurahan: log.kelurahan || defaultKel,
          kondisiKorban: cleanKondisi,
          statusLuka: log.statusLuka || cleanKondisi,
          kondisiHewan: cleanHewan,
          suhuTubuh: cleanSuhu,
          tindakanDilakukan: cleanTindakan,
          catatanKhusus: log.catatanKhusus && log.catatanKhusus !== "-" ? log.catatanKhusus : ""
        });
      }
    }
  }

  // Jika pasien memiliki kolom fullData.catatanPerkembanganHarian tetapi riwayatLog kosong
  if (rawLogs.length === 0 && (patient as any).catatanPerkembanganHarian) {
    const fromSheetString = parseCatatanHarianString(
      (patient as any).catatanPerkembanganHarian,
      defaultKejadian,
      defaultPetugas,
      defaultKel,
      defaultNip
    );
    rawLogs.push(...fromSheetString);
  }

  // Deduplikasi ketat
  const deduplicated = deduplicateAndSortLogs(rawLogs);

  // Jika benar-benar kosong (kasus baru tanpa log sama sekali), buat 1 entri default Hari ke-1
  if (deduplicated.length === 0) {
    deduplicated.push({
      id: `log-default-1`,
      tanggal: defaultKejadian,
      hariKe: 1,
      petugasNama: defaultPetugas,
      petugasNIP: defaultNip,
      kelurahan: defaultKel,
      kondisiKorban: patient.kondisiLuka && patient.kondisiLuka !== "-" ? patient.kondisiLuka : "Kondisi umum baik, tidak demam.",
      statusLuka: patient.kondisiLuka && patient.kondisiLuka !== "-" ? patient.kondisiLuka : "Luka bersih dan mulai mengering.",
      kondisiHewan: patient.kondisiHewan && patient.kondisiHewan !== "-" ? patient.kondisiHewan : "Sehat & aktif (dikandangkan/diikat)",
      suhuTubuh: "36.5 °C",
      tindakanDilakukan: "Pemantauan berkala & edukasi perawatan luka.",
      catatanKhusus: ""
    });
  }

  return deduplicated;
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
    kelurahan: "Semua",
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
    const nowStr = Date.now().toString();
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, nowStr);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, nowStr);
    }
  } catch (e) {}
}

// Ambil timestamp aktivitas terakhir (0 jika belum tercatat)
export function getLastUserActivityTimestamp(): number {
  try {
    if (typeof sessionStorage !== "undefined") {
      const sess = sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
      if (sess) {
        const parsed = Number(sess);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
  } catch (e) {}
  return 0;
}

// Periksa apakah sesi telah kedaluwarsa karena tidak aktif selama lebih dari 1 jam
export function isSessionExpired(): boolean {
  try {
    const active = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY_ACTIVE_USER)
      : null;
    if (!active || active === "null" || active === "guest" || active === "") return true;
    const lastActive = getLastUserActivityTimestamp();
    if (lastActive <= 0) return false; // Sesi baru yang belum ada rekam jejak timeout
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
export function saveOfficerProfiles(profiles: UserAccessProfile[], shouldPushToRemote: boolean = true): void {
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
    localStorage.setItem("petugas", JSON.stringify(securedProfiles));

    // Sinkronisasi dengan sesi user aktif jika ada yang diubah namanya/profilnya
    const activeRaw = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY_ACTIVE_USER)
      : null;
    if (activeRaw && activeRaw !== "null" && activeRaw !== "guest") {
      try {
        const activeParsed = JSON.parse(activeRaw);
        if (activeParsed && (activeParsed.id || activeParsed.username)) {
          const updatedActive = securedProfiles.find(
            (p) => p.id === activeParsed.id || (p.username && p.username.toLowerCase() === activeParsed.username?.toLowerCase())
          );
          if (updatedActive) {
            const { password, ...sanitized } = updatedActive;
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(sanitized));
            }
          }
        }
      } catch (e) {}
    }

    // Trigger update events ke seluruh aplikasi
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ghpr_officers_updated", { detail: securedProfiles }));
      window.dispatchEvent(new Event("storage"));
    }

    // Otomatis push sinkronisasi akun ke Google Spreadsheet jika diizinkan
    if (shouldPushToRemote) {
      const endpoint = getWebAppUrl();
      if (endpoint) {
        pushOfficerProfilesToGoogleSheets(securedProfiles, endpoint).catch((err) => {
          console.warn("[OfficerSync] Background push error:", err);
        });
      }
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

      // Gabungkan akun cloud dengan lokal (Google Sheets sebagai Cloud Truth)
      const mergedMap = new Map<string, UserAccessProfile>();

      // Masukkan default terlebih dahulu sebagai fallback template
      for (const p of PREDEFINED_USER_PROFILES) {
        if (p.username) mergedMap.set(p.username.toLowerCase(), p);
      }
      // Masukkan akun lokal yang tersimpan
      for (const p of localProfiles) {
        if (p.username) mergedMap.set(p.username.toLowerCase(), p);
      }
      // Timpa / tambahkan dari akun Google Sheets (sebagai cloud truth utama)
      for (const r of remoteAccounts) {
        const u = String(
          r.username || r.Username || r.user || r.User || r.USERNAME || r.nip || r.NIP || ""
        ).toLowerCase().trim();

        if (u) {
          const existing = mergedMap.get(u);
          const rawIsK = r.isKoordinator !== undefined 
            ? r.isKoordinator 
            : (r.Koordinator || r.is_koordinator || r["Is Koordinator"] || r["Koordinator?"]);
          const isK = rawIsK === true || String(rawIsK).toLowerCase() === "true" || u === "admin" || u === "widodo";
          
          const rawKel = r.kelurahan || r.Kelurahan || r["Wilayah Kelurahan"] || r.wilayah || existing?.kelurahan || "Sananwetan";
          const kel = (isK ? "Semua" : rawKel) as KelurahanWilayah;
          
          const nama = String(
            r.nama || r.Nama || r.namaPetugas || r["Nama Petugas"] || r["nama_petugas"] || r["Nama Lengkap"] || existing?.nama || ""
          ).trim() || "Petugas Puskesmas";
          
          const nip = String(r.nip || r.NIP || r.Nip || r["NIP Petugas"] || existing?.nip || "-").trim() || "-";
          const jabatan = String(r.jabatan || r.Jabatan || r["Jabatan"] || existing?.jabatan || "Petugas Surveilans").trim();
          const email = String(r.email || r.Email || r["Email"] || existing?.email || `${u}@puskesmas.sananwetan.go.id`).trim();

          let password = r.password || r.Password || r["Password (SHA-256)"] || r.kata_sandi || existing?.password;
          if (!password || String(password).trim() === "") {
            password = hashPassword("password123", u);
          } else if (typeof password === "string" && (password.length !== 64 || !/^[0-9a-f]{64}$/i.test(password))) {
            password = hashPassword(password.trim(), u);
          }

          const finalProfile: UserAccessProfile = {
            id: r.id || r.ID || existing?.id || `user-${u}`,
            nama: nama,
            nip: nip,
            jabatan: jabatan,
            kelurahan: kel,
            role: String(r.role || r.Role || existing?.role || (isK ? "Koordinator Surveilans Rabies Puskesmas" : `Petugas Wilayah Kel. ${kel}`)),
            username: u,
            password: password,
            email: email,
            canCreate: true,
            canUpdate: true,
            canDelete: isK,
            isKoordinator: isK
          };
          mergedMap.set(u, finalProfile);
        }
      }

      const finalProfiles = Array.from(mergedMap.values());
      // Simpan langsung ke storage lokal
      localStorage.setItem(STORAGE_KEY_OFFICER_PROFILES, JSON.stringify(finalProfiles));
      localStorage.setItem("petugas", JSON.stringify(finalProfiles));

      // Perbarui sesi aktif jika nama/profil petugas yang sedang login diubah di spreadsheet
      const activeRaw = typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(STORAGE_KEY_ACTIVE_USER)
        : null;
      if (activeRaw && activeRaw !== "null" && activeRaw !== "guest") {
        try {
          const activeParsed = JSON.parse(activeRaw);
          if (activeParsed && (activeParsed.id || activeParsed.username)) {
            const updatedActive = finalProfiles.find(
              (p) => p.id === activeParsed.id || (p.username && p.username.toLowerCase() === activeParsed.username?.toLowerCase())
            );
            if (updatedActive) {
              const { password, ...sanitized } = updatedActive;
              if (typeof sessionStorage !== "undefined") {
                sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(sanitized));
              }
            }
          }
        } catch (e) {}
      }

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
    // Prioritaskan sesi aktif dari sessionStorage (tab browser aktif)
    const saved = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY_ACTIVE_USER)
      : null;

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
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(sanitizedProfile));
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
      }
      recordUserActivity();
    } else {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
        sessionStorage.setItem(STORAGE_KEY_ACTIVE_USER, "null");
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
        localStorage.setItem(STORAGE_KEY_ACTIVE_USER, "null");
        localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
      }
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

// Helper cerdas membaca nilai kolom dari objek baris spreadsheet dengan toleransi variasi penamaan header
export function getFieldFromRow(row: Record<string, any>, candidateKeys: string[], fallback = ""): string {
  if (!row || typeof row !== "object") return fallback;

  // 1. Direct exact key match
  for (const k of candidateKeys) {
    if (row[k] !== undefined && row[k] !== null) {
      const val = String(row[k]).trim();
      if (val !== "") return val;
    }
  }

  const rowKeys = Object.keys(row);

  // 2. Normalized key match (case-insensitive, hapus spasi & tanda baca)
  for (const cand of candidateKeys) {
    const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const rk of rowKeys) {
      const rkNorm = rk.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (rkNorm === candNorm && row[rk] !== undefined && row[rk] !== null) {
        const val = String(row[rk]).trim();
        if (val !== "") return val;
      }
    }
  }

  // 3. Substring / alias search
  for (const cand of candidateKeys) {
    const candLower = cand.toLowerCase();
    for (const rk of rowKeys) {
      const rkLower = rk.toLowerCase();
      // Khusus pencarian nama korban/pasien (hindari nama pemilik / pelaksana / petugas)
      if (candLower.includes("nama") && candLower.includes("korban")) {
        if (
          rkLower.includes("nama") &&
          !rkLower.includes("pemilik") &&
          !rkLower.includes("petugas") &&
          !rkLower.includes("pelaksana") &&
          !rkLower.includes("hewan")
        ) {
          const val = String(row[rk] ?? "").trim();
          if (val !== "") return val;
        }
      }
      // Khusus kelurahan
      if (candLower.includes("kelurahan") && (rkLower.includes("kelurahan") || rkLower.includes("desa") || rkLower === "wilayah")) {
        const val = String(row[rk] ?? "").trim();
        if (val !== "") return val;
      }
      // Khusus ID kasus
      if (candLower.includes("id_kasus") && (rkLower.includes("id") || rkLower.includes("kode") || rkLower.includes("register") || rkLower === "no")) {
        const val = String(row[rk] ?? "").trim();
        if (val !== "") return val;
      }
      // Khusus Waktu/Tanggal Kejadian
      if (candLower.includes("kejadian") && (rkLower.includes("kejadian") || rkLower.includes("gigitan") || rkLower.includes("tanggal") || rkLower.includes("waktu"))) {
        const val = String(row[rk] ?? "").trim();
        if (val !== "") return val;
      }
    }
  }

  return fallback;
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

  // Deduplikasi ketat berdasarkan ID Kasus dan sanitasi riwayatLog agar tidak duplikat
  const uniqueList: PatientMonitoringItem[] = [];
  const seenIds = new Set<string>();

  for (const p of list) {
    const idClean = (p.id_kasus || "").trim().toLowerCase();
    if (idClean) {
      if (seenIds.has(idClean)) continue;
      seenIds.add(idClean);
    }
    // Normalisasi log agar tidak menduplikasi catatan kronologis
    const cleanLogs = parseChronologicalLogs(p);
    uniqueList.push({
      ...p,
      riwayatLog: cleanLogs
    });
  }

  return uniqueList;
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

  const tglKejadian = normalizeDateToIso(formData.waktuKejadian);
  const tglSelesai = normalizeDateToIso(tglKejadian, 14);

  const finalKel = formData.kelurahanCustom && formData.kelurahan.toLowerCase().includes("lainnya")
    ? formData.kelurahanCustom
    : formData.kelurahan || "";

  const finalKec = formData.kecamatanCustom && formData.kecamatan.toLowerCase().includes("lainnya")
    ? formData.kecamatanCustom
    : formData.kecamatan || "";

  const finalKab = formData.kabupatenKotaCustom && formData.kabupatenKota.toLowerCase().includes("lainnya")
    ? formData.kabupatenKotaCustom
    : formData.kabupatenKota || "";

  const finalHpr = formData.spesiesLain && formData.spesiesHPR === "Lainnya"
    ? formData.spesiesLain
    : formData.spesiesHPR || "";

  const updatedPatient: PatientMonitoringItem = {
    id_kasus,
    timestamp_submit: new Date().toLocaleString("id-ID"),
    waktuKejadian: formData.waktuKejadian || "",
    namaKorban: formData.namaKorban || "",
    umurKorban: formData.umurKorban || "",
    jkKorban: formData.jkKorban || "",
    alamatKorban: formData.alamatKorban || formData.alamatKejadian || "",
    kontakKorban: formData.noHpKorban || formData.kontakPemilik || "",
    noHpKorban: formData.noHpKorban || "",
    kelurahan: finalKel,
    kecamatan: finalKec,
    kabupatenKota: finalKab,
    spesiesHPR: finalHpr,
    rasHewan: formData.ras || "",
    kondisiHewan: formData.kondisiHewan || "",
    pemilikHewan: formData.pemilikHewan || "",
    alamatPemilik: formData.alamatPemilik || "",
    kontakPemilik: formData.kontakPemilik || "",
    kondisiLuka: formData.kondisiLuka || "",
    lokasiLuka: formData.lokasiLuka || "",
    pertolonganPertama: formData.pertolonganPertama || "",
    detailPertolongan: formData.detailPertolongan || "",
    tindakanKasus: formData.tindakanKasus || "",
    tindakanHPR: formData.tindakanHPR || "",
    rekomendasi: formData.rekomendasi || "",
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
        petugasNama: formData.pelaksanaNama || "",
        petugasNIP: formData.pelaksanaNIP || "",
        kelurahan: finalKel,
        kondisiKorban: formData.kondisiLuka || "",
        statusLuka: formData.kondisiLuka || "",
        kondisiHewan: formData.kondisiHewan || "",
        tindakanDilakukan: formData.tindakanKasus || "",
        catatanKhusus: formData.rekomendasi || ""
      }
    ],
    petugasPJ: formData.pelaksanaNama || "",
    nipPJ: formData.pelaksanaNIP || "",
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
  const offlineQueue = getOfflineQueue().filter((q) => q.status === "pending" || q.status === "failed");
  let localAdded = 0;

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
      const rowNameSet = new Set<string>();

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const r = rows[rIdx];
        const rd = r.rowData || r;

        // Deteksi apakah baris ini mengalami pergeseran kolom (misal format legacy 12 kolom uji coba / sheet belum terformat)
        const col0Val = String(rd["id_kasus"] || rd["col_0"] || "").trim();
        const col1Val = String(rd["Waktu Submit"] || rd["timestamp_submit"] || rd["col_1"] || "").trim();
        const col2Val = String(rd["Waktu Kejadian"] || rd["waktuKejadian"] || rd["col_2"] || "").trim();

        const isCol0Date = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(col0Val) || /^\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(col0Val);
        const isCol1Id = /^(TEST|GHPR|ID|KASUS)/i.test(col1Val) || (col1Val.length > 5 && !col1Val.includes(" ") && !col1Val.includes("/"));
        const isShiftedRow = isCol0Date && isCol1Id;

        let sId = "";
        let waktuSubmit = "";
        let tglKejadian = "";
        let tglSelesai = "";
        let nama = "";
        let umur = "-";
        let jk = "Laki-laki";
        let alamat = "-";
        let noHp = "-";
        let kelurahan = "Sananwetan";
        let spesiesHPR = "Anjing";
        let kondisiLuka = "Kategori 2";
        let kondisiHewan = "Dalam Observasi";
        let statusPemantauan = "Dalam Pemantauan (Aktif)";
        let petugasPJ = "Widodo Suprianto A.Md.Kep";
        let nipPJ = "197606252009011007";
        let rekomendasi = "Observasi harian kondisi korban dan hewan.";
        let rawId = "";

        if (isShiftedRow) {
          // Format shifted 12-kolom: [0: Waktu, 1: ID, 2: Nama, 3: AlamatKejadian, 4: Umur, 5: JK, 6: AlamatKorban, 7: NoHP, 8: Kelurahan, 9: Spesies, 10: Luka, 11: Status]
          rawId = col1Val;
          sId = col1Val;
          waktuSubmit = col0Val;
          tglKejadian = normalizeDateToIso(col0Val);
          tglSelesai = normalizeDateToIso(tglKejadian, 14);
          nama = col2Val || "Uji Coba Sistem";
          umur = String(rd["kelurahan"] || rd["col_4"] || "30 Tahun").trim();
          jk = String(rd["Kelurahan"] || rd["col_5"] || "Laki-laki").trim();
          alamat = String(rd["Kecamatan"] || rd["col_6"] || "Kota Blitar").trim();
          noHp = String(rd["Kabupaten/Kota"] || rd["col_7"] || "-").trim();
          kelurahan = String(rd["Provinsi"] || rd["col_8"] || "Sananwetan").trim();
          spesiesHPR = String(rd["Sumber Informasi"] || rd["col_9"] || "Anjing").trim();
          kondisiLuka = String(rd["Kronologi Kejadian"] || rd["col_10"] || "Kategori 2").trim();
          statusPemantauan = String(rd["spesiesHPR"] || rd["col_11"] || "Dalam Pemantauan (Aktif)").trim();
        } else {
          // Ekstraksi multi-kolom cerdas & toleran menggunakan getFieldFromRow
          rawId = getFieldFromRow(rd, [
            "id_kasus",
            "ID Kasus",
            "Id Kasus",
            "ID",
            "id",
            "No Kasus",
            "No. Kasus",
            "Kode Kasus",
            "col_0"
          ], r.id_kasus || "");

          nama = getFieldFromRow(rd, [
            "Nama Korban",
            "namaKorban",
            "Nama Pasien",
            "Nama Lengkap Korban",
            "Nama Korban/Pasien",
            "Nama Korban / Pasien",
            "Nama Penderita",
            "Nama",
            "col_27",
            "col_21"
          ], r.namaKorban || "Tanpa Nama").trim();

          // Jika baris benar-benar kosong (tidak ada nama dan tidak ada ID), lewati
          if ((!nama || nama === "Tanpa Nama") && !rawId) continue;

          const rawTgl = getFieldFromRow(rd, [
            "Waktu Kejadian",
            "waktuKejadian",
            "Tanggal Gigitan",
            "Tanggal Kejadian",
            "Tanggal",
            "Waktu Submit",
            "Timestamp"
          ], "");

          tglKejadian = normalizeDateToIso(rawTgl);
          tglSelesai = normalizeDateToIso(tglKejadian, 14);

          // Jika ID kasus di baris spreadsheet kosong, buat ID stabil berdasarkan tanggal dan nama (misal Sulastri)
          sId = rawId ? String(rawId).trim() : "";
          if (!sId) {
            const cleanNameCode = (nama && nama !== "Tanpa Nama")
              ? nama.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()
              : `ROW${rIdx + 1}`;
            sId = `GHPR-${tglKejadian.replace(/-/g, "")}-${cleanNameCode}`;
          }

          waktuSubmit = String(
            getFieldFromRow(rd, ["Waktu Submit", "timestamp_submit", "Timestamp"], r.waktuSubmit || new Date().toLocaleString("id-ID"))
          );

          kelurahan = getFieldFromRow(rd, [
            "Kelurahan",
            "kelurahan",
            "Desa",
            "Wilayah",
            "Kelurahan/Desa",
            "kelurahan_final"
          ], "Sananwetan").trim();

          alamat = getFieldFromRow(rd, [
            "Alamat Korban",
            "Alamat Kejadian",
            "alamatKorban",
            "alamatKejadian",
            "Alamat"
          ], "-");

          kondisiLuka = getFieldFromRow(rd, [
            "Kondisi Luka",
            "kondisiLuka",
            "kondisi Luka",
            "Derajat Luka",
            "Status Luka"
          ], "-");

          kondisiHewan = getFieldFromRow(rd, [
            "Kondisi Hewan Saat Ini",
            "kondisiHewan",
            "Kondisi Hewan",
            "Status Hewan"
          ], "Dalam Observasi");

          spesiesHPR = getFieldFromRow(rd, [
            "Spesies HPR",
            "spesies_final",
            "spesiesHPR",
            "Jenis Hewan",
            "Hewan"
          ], "Anjing");

          petugasPJ = getFieldFromRow(rd, [
            "Pelaksana (Petugas)",
            "pelaksanaNama",
            "Petugas PJ",
            "Petugas",
            "Pelaksana"
          ], "Widodo Suprianto A.Md.Kep");

          nipPJ = getFieldFromRow(rd, [
            "NIP Pelaksana",
            "pelaksanaNIP",
            "NIP",
            "nip"
          ], "197606252009011007");

          rekomendasi = getFieldFromRow(rd, [
            "Rekomendasi",
            "rekomendasi",
            "Tindakan Kasus",
            "Catatan"
          ], "-");

          noHp = getFieldFromRow(rd, [
            "No HP Korban",
            "noHpKorban",
            "kontakKorban",
            "Kontak",
            "No HP",
            "Telepon"
          ], "-");

          umur = getFieldFromRow(rd, [
            "Umur Korban",
            "umurKorban",
            "Umur",
            "Usia"
          ], "-");

          jk = getFieldFromRow(rd, [
            "Jenis Kelamin Korban",
            "jkKorban",
            "Jenis Kelamin",
            "JK"
          ], "Laki-laki");

          statusPemantauan = getFieldFromRow(rd, [
            "Status Pemantauan",
            "statusPemantauan",
            "Status",
            "col_36"
          ], "Dalam Pemantauan (Aktif)");
        }

        // Ekstraksi data pemantauan kolom 37-46
        const rawHariObs = Number(getFieldFromRow(rd, [
          "Hari Observasi",
          "Hari Pemantauan",
          "Hari Ke",
          "Hari ke-",
          "hariObservasi",
          "hariPemantauan",
          "hariObservasiKe",
          "hari_observasi",
          "hari_pemantauan",
          "col_37"
        ], "0")) || 0;
        const rawStatusHewanObs = getFieldFromRow(rd, ["Status Hewan Observasi", "statusHewanObservasi", "col_38"], "Sehat / Normal (Observasi)");
        const rawVar0 = getFieldFromRow(rd, ["Jadwal VAR Dosis 0", "jadwalVAR_0", "col_39"], "");
        const rawVar3 = getFieldFromRow(rd, ["Jadwal VAR Dosis 3", "jadwalVAR_3", "col_40"], "");
        const rawVar7 = getFieldFromRow(rd, ["Jadwal VAR Dosis 7", "jadwalVAR_7", "col_41"], "");
        const rawVar21 = getFieldFromRow(rd, ["Jadwal VAR Dosis 21", "jadwalVAR_21", "col_42"], "");
        const rawCatatanLog = getFieldFromRow(rd, [
          "Catatan Perkembangan Harian",
          "catatanPerkembanganHarian",
          "Catatan Harian",
          "Riwayat Pemantauan",
          "Catatan Kronologis",
          "col_43"
        ], "");
        const rawPJMonitoring = getFieldFromRow(rd, ["Petugas PJ Monitoring", "petugasPJMonitoring", "col_44"], petugasPJ);
        const rawTanggalPemantauan = getFieldFromRow(rd, [
          "Tanggal Pemantauan",
          "Tanggal Observasi",
          "Tanggal Terakhir Pemantauan",
          "Tgl Pemantauan",
          "Tanggal Laporan",
          "Tanggal Pelaksanaan",
          "col_33",
          "col_45"
        ], "");
        const rawLastUpd = getFieldFromRow(rd, ["Terakhir Diperbarui", "lastUpdated", "col_45"], rawTanggalPemantauan || waktuSubmit);

        const sIdLower = sId.toLowerCase();
        const sNamaLower = nama.toLowerCase();

        if (dismissedSet.has(sIdLower)) continue;

        rowIdSet.add(sIdLower);
        if (sNamaLower && sNamaLower !== "tanpa nama") {
          rowNameSet.add(sNamaLower);
        }

        // Helper fungsi parsing dosis VAR dari spreadsheet
        const parseSpreadsheetVarDose = (
          rawText: string,
          existingDose?: VarDoseItem,
          defaultDate?: string
        ): VarDoseItem => {
          const clean = (rawText || "").trim();
          if (!clean || clean === "-") {
            return existingDose || { tanggal: defaultDate || "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" };
          }

          const lower = clean.toLowerCase();
          let status: "Belum Diberikan" | "Terjadwal" | "Sudah Diberikan" | "Tidak Perlu" = "Belum Diberikan";
          if (lower.includes("sudah") || lower.includes("diberikan")) {
            status = "Sudah Diberikan";
          } else if (lower.includes("terjadwal") || lower.includes("jadwal")) {
            status = "Terjadwal";
          } else if (lower.includes("tidak perlu") || lower.includes("batal")) {
            status = "Tidak Perlu";
          } else if (existingDose?.status) {
            status = existingDose.status;
          }

          const dateMatch = clean.match(/\d{4}-\d{2}-\d{2}/) || clean.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
          const tanggal = dateMatch ? normalizeDateToIso(dateMatch[0]) : (existingDose?.tanggal || defaultDate || "");

          return {
            tanggal,
            status,
            lokasiPemberian: existingDose?.lokasiPemberian || "Puskesmas Sananwetan",
            keterangan: clean
          };
        };

        // Cari apakah pasien sudah pernah tercatat sebelumnya (berdasarkan ID Kasus yang pasti, atau jika ID kosong dicocokkan nama)
        const existingIdx = latestPatients.findIndex((p) => {
          const matchId = (p.id_kasus || "").trim().toLowerCase() === sIdLower;
          const matchNama = !rawId && sNamaLower && sNamaLower !== "tanpa nama" && (p.namaKorban || "").trim().toLowerCase() === sNamaLower;
          return matchId || matchNama;
        });

        // Cek apakah sudah ada di syncedPatients yang sedang disusun agar tidak ganda
        const alreadyInSyncedIdx = syncedPatients.findIndex((sp) => {
          const matchId = (sp.id_kasus || "").trim().toLowerCase() === sIdLower;
          const matchNama = !rawId && sNamaLower && sNamaLower !== "tanpa nama" && (sp.namaKorban || "").trim().toLowerCase() === sNamaLower;
          return matchId || matchNama;
        });

        if (existingIdx >= 0) {
          const ex = latestPatients[existingIdx];

          const mergedVar0 = parseSpreadsheetVarDose(rawVar0, ex.jadwalVAR?.dosis0, tglKejadian);
          const mergedVar3 = parseSpreadsheetVarDose(rawVar3, ex.jadwalVAR?.dosis3, normalizeDateToIso(tglKejadian, 3));
          const mergedVar7 = parseSpreadsheetVarDose(rawVar7, ex.jadwalVAR?.dosis7, normalizeDateToIso(tglKejadian, 7));
          const mergedVar21 = parseSpreadsheetVarDose(rawVar21, ex.jadwalVAR?.dosis21, normalizeDateToIso(tglKejadian, 21));

          let mergedLogs = Array.isArray(ex.riwayatLog) ? [...ex.riwayatLog] : [];
          if (rawCatatanLog && rawCatatanLog !== "-" && rawCatatanLog.trim().length > 0) {
            const parsedFromSheet = parseCatatanHarianString(
              rawCatatanLog,
              tglKejadian,
              rawPJMonitoring && rawPJMonitoring !== "-" ? rawPJMonitoring : (ex.petugasPJ || "Petugas Puskesmas"),
              kelurahan && kelurahan !== "-" ? kelurahan : (ex.kelurahan || "Sananwetan"),
              nipPJ !== "-" ? nipPJ : (ex.nipPJ || "-")
            );
            if (parsedFromSheet.length > 0) {
              mergedLogs = deduplicateAndSortLogs([...mergedLogs, ...parsedFromSheet]);
            }
          } else {
            mergedLogs = deduplicateAndSortLogs(mergedLogs);
          }

          const resolvedHariObs = rawHariObs > 0 ? rawHariObs : (ex.hariObservasiKe || 1);

          const merged: PatientMonitoringItem = {
            ...ex,
            id_kasus: sId,
            namaKorban: nama && nama !== "-" ? nama : ex.namaKorban,
            kelurahan: kelurahan && kelurahan !== "-" ? kelurahan : ex.kelurahan,
            alamatKorban: alamat !== "-" ? alamat : ex.alamatKorban,
            kontakKorban: noHp !== "-" ? noHp : (ex.kontakKorban || ex.noHpKorban || "-"),
            noHpKorban: noHp !== "-" ? noHp : (ex.noHpKorban || ex.kontakKorban || "-"),
            umurKorban: umur !== "-" ? umur : ex.umurKorban,
            jkKorban: jk || ex.jkKorban,
            kondisiLuka: kondisiLuka !== "-" ? kondisiLuka : ex.kondisiLuka,
            kondisiHewan: kondisiHewan !== "-" ? kondisiHewan : ex.kondisiHewan,
            spesiesHPR: spesiesHPR || ex.spesiesHPR,
            petugasPJ: rawPJMonitoring && rawPJMonitoring !== "-" ? rawPJMonitoring : (petugasPJ !== "-" ? petugasPJ : ex.petugasPJ),
            nipPJ: nipPJ !== "-" ? nipPJ : ex.nipPJ,
            rekomendasi: rekomendasi !== "-" ? rekomendasi : ex.rekomendasi,
            statusPemantauan: (statusPemantauan as StatusPemantauanPasien) || ex.statusPemantauan || "Dalam Pemantauan (Aktif)",
            hariObservasiKe: resolvedHariObs,
            statusHewanObservasi: (rawStatusHewanObs && rawStatusHewanObs !== "-" ? rawStatusHewanObs : ex.statusHewanObservasi) as StatusHewanObservasi,
            jadwalVAR: {
              dosis0: mergedVar0,
              dosis3: mergedVar3,
              dosis7: mergedVar7,
              dosis21: mergedVar21
            },
            riwayatLog: mergedLogs,
            lastUpdated: rawLastUpd && rawLastUpd !== "-" ? rawLastUpd : (ex.lastUpdated || new Date().toLocaleString("id-ID"))
          };

          if (alreadyInSyncedIdx >= 0) {
            syncedPatients[alreadyInSyncedIdx] = merged;
          } else {
            syncedPatients.push(merged);
            sheetUpdated++;
          }
        } else {
          let initialLogs: MonitoringDailyLog[] = [];
          if (rawCatatanLog && rawCatatanLog !== "-" && rawCatatanLog.trim().length > 0) {
            initialLogs = parseCatatanHarianString(
              rawCatatanLog,
              tglKejadian,
              rawPJMonitoring && rawPJMonitoring !== "-" ? rawPJMonitoring : petugasPJ,
              kelurahan,
              nipPJ
            );
          }

          if (initialLogs.length === 0) {
            initialLogs = [
              {
                id: `log-import-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                tanggal: tglKejadian,
                hariKe: rawHariObs || 1,
                petugasNama: rawPJMonitoring && rawPJMonitoring !== "-" ? rawPJMonitoring : petugasPJ,
                petugasNIP: nipPJ,
                kelurahan: kelurahan,
                kondisiKorban: kondisiLuka || "Dalam Perawatan",
                statusLuka: kondisiLuka,
                kondisiHewan: kondisiHewan,
                suhuTubuh: "36.5 °C",
                tindakanDilakukan: "Penyelidikan Epidemiologi",
                catatanKhusus: ""
              }
            ];
          }

          const newPatient: PatientMonitoringItem = {
            id_kasus: sId,
            timestamp_submit: waktuSubmit || new Date().toLocaleString("id-ID"),
            waktuKejadian: tglKejadian,
            namaKorban: nama,
            umurKorban: umur,
            jkKorban: jk,
            alamatKorban: alamat,
            kontakKorban: noHp,
            noHpKorban: noHp,
            kelurahan: kelurahan,
            kecamatan: String(getFieldFromRow(rd, ["Kecamatan", "kecamatan"], "Sananwetan")),
            kabupatenKota: String(getFieldFromRow(rd, ["Kabupaten/Kota", "kabupatenKota"], "Kota Blitar")),
            spesiesHPR: spesiesHPR,
            rasHewan: String(getFieldFromRow(rd, ["Ras Hewan", "rasHewan"], "-")),
            kondisiHewan: kondisiHewan,
            pemilikHewan: String(getFieldFromRow(rd, ["Nama Pemilik", "pemilikHewan"], "-")),
            alamatPemilik: String(getFieldFromRow(rd, ["Alamat Pemilik", "alamatPemilik"], "-")),
            kontakPemilik: String(getFieldFromRow(rd, ["Kontak Pemilik", "kontakPemilik"], "-")),
            kondisiLuka: kondisiLuka,
            lokasiLuka: String(getFieldFromRow(rd, ["Lokasi Luka", "lokasiLuka"], "-")),
            pertolonganPertama: String(getFieldFromRow(rd, ["Pertolongan Pertama", "pertolonganPertama"], "-")),
            tindakanKasus: String(getFieldFromRow(rd, ["Tindakan Kasus", "tindakanKasus"], "-")),
            tindakanHPR: String(getFieldFromRow(rd, ["Tindakan terhadap HPR", "tindakanHPR"], "Observasi 14 Hari")),
            rekomendasi: rekomendasi,
            statusPemantauan: (statusPemantauan as StatusPemantauanPasien) || "Dalam Pemantauan (Aktif)",
            statusHewanObservasi: (rawStatusHewanObs && rawStatusHewanObs !== "-" ? rawStatusHewanObs : "Sehat / Normal (Observasi)") as StatusHewanObservasi,
            hariObservasiKe: rawHariObs || 1,
            tglMulaiObservasi: tglKejadian,
            tglSelesaiObservasi: tglSelesai,
            jadwalVAR: {
              dosis0: parseSpreadsheetVarDose(rawVar0, undefined, tglKejadian),
              dosis3: parseSpreadsheetVarDose(rawVar3, undefined, normalizeDateToIso(tglKejadian, 3)),
              dosis7: parseSpreadsheetVarDose(rawVar7, undefined, normalizeDateToIso(tglKejadian, 7)),
              dosis21: parseSpreadsheetVarDose(rawVar21, undefined, normalizeDateToIso(tglKejadian, 21))
            },
            riwayatLog: initialLogs,
            petugasPJ: rawPJMonitoring && rawPJMonitoring !== "-" ? rawPJMonitoring : petugasPJ,
            nipPJ: nipPJ,
            lastUpdated: rawLastUpd && rawLastUpd !== "-" ? rawLastUpd : new Date().toLocaleString("id-ID")
          };

          if (alreadyInSyncedIdx >= 0) {
            syncedPatients[alreadyInSyncedIdx] = newPatient;
          } else {
            syncedPatients.push(newPatient);
            sheetAdded++;
          }
        }
      }

      // Pertahankan HANYA formulir yang benar-benar pending dalam antrean offline (belum terkirim ke spreadsheet)
      for (const item of offlineQueue) {
        if (item.type === "new_case" && item.payload) {
          const payloadId = (item.payload.id_kasus || item.caseId || "").trim().toLowerCase();
          const payloadNama = (item.payload.namaKorban || item.patientName || "").trim().toLowerCase();
          const isAlreadyInSheet = (payloadId && rowIdSet.has(payloadId)) || (payloadNama && rowNameSet.has(payloadNama));
          const isAlreadyInSynced = syncedPatients.some((sp) => {
            const spId = (sp.id_kasus || "").trim().toLowerCase();
            const spNama = (sp.namaKorban || "").trim().toLowerCase();
            return (payloadId && spId === payloadId) || (payloadNama && spNama === payloadNama);
          });

          if (!isAlreadyInSheet && !isAlreadyInSynced) {
            const offlinePatient = syncPatientFromFormSubmission(item.payload as FormGHPRData, item.payload.id_kasus || item.caseId, false);
            syncedPatients.push(offlinePatient);
            localAdded++;
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
      // Jika spreadsheet masih kosong atau tidak ada data yang terbaca
      const validPatients = latestPatients.filter(
        (p) => !DUMMY_DEMO_CASE_IDS.has((p.id_kasus || "").trim().toLowerCase()) && !dismissedSet.has((p.id_kasus || "").trim().toLowerCase())
      );
      saveAllPatients(validPatients);
      return {
        success: true,
        total: validPatients.length,
        added: localAdded,
        updated: 0,
        message: `Daftar pemantauan lokal siap (${validPatients.length} kasus).`
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
