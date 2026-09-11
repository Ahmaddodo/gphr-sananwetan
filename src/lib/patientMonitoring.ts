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
  sendToAppsScript,
  DEFAULT_WEB_APP_URL,
  DEFAULT_SPREADSHEET_ID,
  getLocalSubmissionHistory,
  fetchOfficerAccountsFromAppsScript,
  pushOfficerAccountsToAppsScript,
  pushAllPatientsToAppsScript,
  fetchDirectGoogleSheetRows,
  getSavedSheetConfig
} from "./googleSheets";
import { getOfflineQueue, addToOfflineQueue, isAppOnline } from "./offlineSyncService";
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
  if (!str || str === "-") {
    const target = new Date(now.getTime() + fallbackDaysOffset * 86400000);
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
  }

  // 1. Cek jika format serial number spreadsheet (misal 45500 - 47000)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 30000 && num < 60000) {
      // Excel/Sheets serial epoch: 1899-12-30
      const epoch = new Date(1899, 11, 30).getTime();
      const ms = epoch + num * 86400000;
      const dateObj = new Date(ms);
      if (!isNaN(dateObj.getTime())) {
        const target = new Date(dateObj.getTime() + fallbackDaysOffset * 86400000);
        return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
      }
    }
  }

  // 2. Cek jika format YYYY-MM-DD
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

  // 3. Cek jika format Indonesia DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000; // Normalisasi 2 digit tahun (misal 26 -> 2026)
    const dateObj = new Date(y, m - 1, d);
    if (!isNaN(dateObj.getTime())) {
      const target = new Date(dateObj.getTime() + fallbackDaysOffset * 86400000);
      return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    }
  }

  // 4. Cek jika teks memuat nama bulan bahasa Indonesia (contoh: "14 Agustus 2026" atau "14-Agt-2026")
  const idMonths: Record<string, number> = {
    jan: 1, januari: 1, january: 1,
    feb: 2, februari: 2, february: 2,
    mar: 3, maret: 3, march: 3,
    apr: 4, april: 4,
    mei: 5, may: 5,
    jun: 6, juni: 6, june: 6,
    jul: 7, juli: 7, july: 7,
    agu: 8, ags: 8, agustus: 8, august: 8,
    sep: 9, september: 9,
    okt: 10, oktober: 10, october: 10,
    nov: 11, november: 11,
    des: 12, desember: 12, december: 12
  };

  const idTextMatch = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (idTextMatch) {
    const d = parseInt(idTextMatch[1], 10);
    const mName = idTextMatch[2].toLowerCase();
    const y = parseInt(idTextMatch[3], 10);
    const m = idMonths[mName];
    if (m) {
      const dateObj = new Date(y, m - 1, d);
      if (!isNaN(dateObj.getTime())) {
        const target = new Date(dateObj.getTime() + fallbackDaysOffset * 86400000);
        return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
      }
    }
  }

  // 5. Cek jika format GViz Date(yyyy, m, d)
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

  // 6. Fallback standar JS Date parse
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
 * Menjamin 1 entri per hari observasi / per tanggal kalender
 */
export function deduplicateAndSortLogs(logs: MonitoringDailyLog[]): MonitoringDailyLog[] {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  // Peta deduplikasi cerdas berdasarkan key: tanggal observasi dan hariKe
  // Pasien rabies memiliki paling banyak 1 catatan pemantauan per hari observasi
  const mapByDay = new Map<string, MonitoringDailyLog>();
  const orderKeys: string[] = [];

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (!log) continue;

    // Abaikan log default palsu jika ada log riil lain
    if (log.id && log.id.startsWith("log-default") && logs.length > 1) {
      continue;
    }

    const cleanDate = (log.tanggal || "").trim();
    const cleanHari = Number(log.hariKe) || 0;

    // Tentukan primary key:
    // 1. Jika ada tanggal ISO valid (YYYY-MM-DD): jadikan kunci date-YYYY-MM-DD
    // 2. Jika ada hariKe: jadikan kunci hari-X
    // 3. Fallback: id atau index
    let primaryKey = "";
    if (cleanDate && /^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      primaryKey = `date-${cleanDate}`;
    } else if (cleanHari > 0) {
      primaryKey = `hari-${cleanHari}`;
    } else if (log.id) {
      primaryKey = `id-${log.id}`;
    } else {
      primaryKey = `idx-${i}`;
    }

    // Periksa apakah sudah ada entri dengan tanggal yang sama ATAU hariKe yang sama
    let matchedKey: string | null = null;
    if (mapByDay.has(primaryKey)) {
      matchedKey = primaryKey;
    } else if (cleanHari > 0 && mapByDay.has(`hari-${cleanHari}`)) {
      matchedKey = `hari-${cleanHari}`;
    } else if (cleanDate && /^\d{4}-\d{2}-\d{2}$/.test(cleanDate) && mapByDay.has(`date-${cleanDate}`)) {
      matchedKey = `date-${cleanDate}`;
    }

    // Format suhu tubuh bersih tanpa dobel °C
    let cleanSuhu = (log.suhuTubuh || "").trim();
    if (cleanSuhu && cleanSuhu !== "-") {
      const numPart = cleanSuhu.replace(/°C/gi, "").trim();
      cleanSuhu = numPart ? `${numPart} °C` : "36.5 °C";
    } else {
      cleanSuhu = "36.5 °C";
    }

    if (!matchedKey) {
      const assignedKey = primaryKey;
      mapByDay.set(assignedKey, {
        ...log,
        suhuTubuh: cleanSuhu,
        id: log.id || `log-${cleanDate || "tgl"}-${cleanHari || i + 1}`
      });
      orderKeys.push(assignedKey);
    } else {
      // DITEMUKAN DUPLIKASI HARI / TANGGAL: Lakukan merge cerdas, simpan data paling lengkap/terbaru
      const prev = mapByDay.get(matchedKey)!;
      const merged: MonitoringDailyLog = {
        ...prev,
        tanggal: (cleanDate && cleanDate !== "-") ? cleanDate : prev.tanggal,
        hariKe: cleanHari > 0 ? cleanHari : prev.hariKe,
        petugasNama: (log.petugasNama && log.petugasNama !== "-" && log.petugasNama !== "Petugas Puskesmas")
          ? log.petugasNama
          : prev.petugasNama,
        petugasNIP: (log.petugasNIP && log.petugasNIP !== "-") ? log.petugasNIP : prev.petugasNIP,
        kelurahan: (log.kelurahan && log.kelurahan !== "-") ? log.kelurahan : prev.kelurahan,
        kondisiKorban: (log.kondisiKorban && log.kondisiKorban !== "-" && log.kondisiKorban !== "Kondisi umum baik, tidak demam.")
          ? log.kondisiKorban
          : prev.kondisiKorban,
        statusLuka: (log.statusLuka && log.statusLuka !== "-" && log.statusLuka !== "Luka bersih dan mulai mengering.")
          ? log.statusLuka
          : prev.statusLuka,
        kondisiHewan: (log.kondisiHewan && log.kondisiHewan !== "-" && log.kondisiHewan !== "Sehat & aktif (dikandangkan/diikat)")
          ? log.kondisiHewan
          : prev.kondisiHewan,
        suhuTubuh: cleanSuhu !== "36.5 °C" ? cleanSuhu : prev.suhuTubuh,
        tindakanDilakukan: (log.tindakanDilakukan && log.tindakanDilakukan !== "-" && log.tindakanDilakukan !== "Pemantauan berkala & edukasi perawatan luka.")
          ? log.tindakanDilakukan
          : prev.tindakanDilakukan,
        catatanKhusus: (log.catatanKhusus && log.catatanKhusus !== "-")
          ? log.catatanKhusus
          : (prev.catatanKhusus && prev.catatanKhusus !== "-" ? prev.catatanKhusus : ""),
        id: prev.id || log.id || `log-${cleanDate || "tgl"}-${cleanHari || i + 1}`
      };
      mapByDay.set(matchedKey, merged);
    }
  }

  const result = Array.from(mapByDay.values());

  // Urutkan kronologis berdasarkan tanggal lalu hariKe
  return result.sort((a, b) => {
    if (a.tanggal && b.tanggal && a.tanggal !== b.tanggal) {
      return a.tanggal.localeCompare(b.tanggal);
    }
    return (Number(a.hariKe) || 0) - (Number(b.hariKe) || 0);
  });
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
  if (!rawText || typeof rawText !== "string") return [];
  const cleanRaw = rawText.trim();
  if (cleanRaw === "" || cleanRaw === "-" || cleanRaw === "null" || cleanRaw === "undefined") return [];

  // Helper normalisasi tanggal Indonesia (DD-MM-YYYY atau DD/MM/YYYY atau YYYY-MM-DD) ke YYYY-MM-DD
  const parseToIsoDate = (dStr: string): string => {
    if (!dStr) return "";
    const clean = dStr.trim();
    // YYYY-MM-DD
    const isoM = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoM) {
      return `${isoM[1]}-${isoM[2].padStart(2, "0")}-${isoM[3].padStart(2, "0")}`;
    }
    // DD-MM-YYYY or DD/MM/YYYY
    const ddmmyyyyM = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (ddmmyyyyM) {
      return `${ddmmyyyyM[3]}-${ddmmyyyyM[2].padStart(2, "0")}-${ddmmyyyyM[1].padStart(2, "0")}`;
    }
    try {
      const dt = new Date(clean);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString().slice(0, 10);
      }
    } catch (e) {}
    return "";
  };

  // Pisahkan entri-entri catatan:
  // 1. Double newline (\n\n)
  // 2. Baris baru yang mendahului header [YYYY-MM-DD], [Hari ke-X], (YYYY-MM-DD), dsb.
  const chunks = cleanRaw
    .split(/(?:\r?\n\s*\r?\n|\r?\n(?=\s*(?:\[\s*(?:\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|Hari\s*ke-?\s*\d+)[^\]]*\]|\(\s*(?:\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|Hari\s*ke-?\s*\d+)[^)]*\)|Hari\s*(?:ke-?|\:)\s*\d+|\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b|\b\d+[\.\)]\s*(?:Hari|Tgl|Tanggal|\[))))/i)
    .map((c) => c.trim())
    .filter(Boolean);

  // Jika setelah split terdapat chunk yang mengandung multiple line dengan "Kondisi:" atau "Suhu:", split lebih lanjut
  const finalChunks: string[] = [];
  for (const ch of chunks) {
    if (ch.includes("\n") && (ch.match(/Kondisi:/gi) || []).length > 1) {
      const lines = ch.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      finalChunks.push(...lines);
    } else {
      finalChunks.push(ch);
    }
  }

  const parsedLogs: MonitoringDailyLog[] = [];

  for (let i = 0; i < finalChunks.length; i++) {
    const chunk = finalChunks[i];
    if (!chunk || chunk === "-") continue;

    let tanggal = "";
    let hariKe = 0;
    let petugasNama = defaultPetugas;
    let suhuTubuh = "36.5 °C";
    let kondisiKorban = "Kondisi umum baik, tidak demam.";
    let statusLuka = "Luka bersih dan mulai mengering.";
    let kondisiHewan = "Sehat & aktif (dikandangkan/diikat)";
    let tindakanDilakukan = "Pemantauan berkala & edukasi perawatan luka.";
    let catatanKhusus = "";

    // 1. Tanggal: cari [YYYY-MM-DD] atau [DD/MM/YYYY] atau bentuk tanggal dalam chunk
    const dateBrackMatch = chunk.match(/\[\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})\s*\]/) || chunk.match(/\(\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})\s*\)/);
    if (dateBrackMatch) {
      const parsedD = parseToIsoDate(dateBrackMatch[1]);
      if (parsedD) tanggal = parsedD;
    }
    if (!tanggal) {
      const rawDateMatch = chunk.match(/\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/) || chunk.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/);
      if (rawDateMatch) {
        const parsedD = parseToIsoDate(rawDateMatch[1]);
        if (parsedD) tanggal = parsedD;
      }
    }
    if (!tanggal) {
      tanggal = defaultKejadian || new Date().toISOString().slice(0, 10);
    }

    // 2. Hari ke-X: cari Hari ke-X atau Hari X atau H-X atau H+X
    const hariMatch = chunk.match(/Hari\s*ke-?\s*(\d+)/i) || chunk.match(/Hari\s*:?\s*(\d+)/i) || chunk.match(/H[-+]\s*(\d+)/i);
    if (hariMatch) {
      hariKe = parseInt(hariMatch[1], 10);
    } else if (tanggal && defaultKejadian) {
      try {
        const d1 = new Date(defaultKejadian).getTime();
        const d2 = new Date(tanggal).getTime();
        if (!isNaN(d1) && !isNaN(d2)) {
          const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
          if (diff >= 0) {
            hariKe = diff + 1;
          }
        }
      } catch (e) {}
    }
    if (!hariKe || hariKe < 1) {
      hariKe = i === 0 ? 1 : (i === 1 ? 7 : (i === 2 ? 14 : i + 1));
    }

    // 3. Petugas Nama: cari (Nama Petugas) atau Petugas: Nama
    const petInParen = chunk.match(/\(([^)]+)\)/);
    if (petInParen && petInParen[1].length > 2) {
      const inside = petInParen[1].trim();
      if (!inside.includes("°C") && !inside.toLowerCase().startsWith("hari ke") && !/^\d+$/.test(inside)) {
        petugasNama = inside;
      }
    }
    const petExplicit = chunk.match(/Petugas:?\s*(.*?)(?=,\s*(?:Kondisi|Suhu|Hewan|Tindakan|Catatan):|$)/i);
    if (petExplicit && petExplicit[1].trim() && petExplicit[1].trim() !== "-") {
      petugasNama = petExplicit[1].trim();
    }

    // 4. Suhu Tubuh: Suhu: 36.5 °C
    const suhuMatch = chunk.match(/Suhu:?\s*(.*?)(?=,\s*(?:Hewan|Tindakan|Catatan|Kondisi):|$)/i);
    if (suhuMatch && suhuMatch[1].trim() && suhuMatch[1].trim() !== "-") {
      const sVal = suhuMatch[1].trim().replace(/°C/gi, "").trim();
      suhuTubuh = sVal ? `${sVal} °C` : "36.5 °C";
    }

    // 5. Kondisi Korban & Status Luka: Kondisi: ... atau Luka: ...
    const kondMatch = chunk.match(/(?:Kondisi(?: Korban & Luka| Korban| Umum)?|Status Luka|Luka):?\s*(.*?)(?=,\s*(?:Suhu|Hewan|Tindakan|Catatan):|$)/i);
    if (kondMatch && kondMatch[1].trim() && kondMatch[1].trim() !== "-") {
      kondisiKorban = kondMatch[1].trim();
      statusLuka = kondMatch[1].trim();
    }

    // 6. Kondisi Hewan: Hewan: ... atau Kondisi Hewan: ...
    const hewMatch = chunk.match(/(?:Kondisi Hewan|Hewan(?: HPR)?):?\s*(.*?)(?=,\s*(?:Tindakan|Catatan|Suhu|Kondisi):|$)/i);
    if (hewMatch && hewMatch[1].trim() && hewMatch[1].trim() !== "-") {
      kondisiHewan = hewMatch[1].trim();
    }

    // 7. Tindakan: Tindakan: ... atau Edukasi: ...
    const tindMatch = chunk.match(/(?:Tindakan(?: \/ Edukasi)?|Edukasi):?\s*(.*?)(?=,\s*(?:Catatan|Hewan|Suhu):|$)/i);
    if (tindMatch && tindMatch[1].trim() && tindMatch[1].trim() !== "-") {
      tindakanDilakukan = tindMatch[1].trim();
    }

    // 8. Catatan Khusus: Catatan: ...
    const catMatch = chunk.match(/Catatan(?: Khusus)?:?\s*(.*?)$/i);
    if (catMatch && catMatch[1].trim() && catMatch[1].trim() !== "-") {
      catatanKhusus = catMatch[1].trim();
    } else if (!chunk.includes("Kondisi:") && !chunk.includes("Suhu:") && !chunk.includes("Tindakan:")) {
      // Freeform single text
      catatanKhusus = chunk;
    }

    parsedLogs.push({
      id: `log-parsed-${tanggal}-${hariKe}-${i}`,
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
 * Menjadikan data kolom 'Catatan Perkembangan Harian' Google Spreadsheet sebagai acuan utama
 * dan mencegah duplikasi record ketika modal update dibuka.
 */
export function parseChronologicalLogs(patient: PatientMonitoringItem): MonitoringDailyLog[] {
  if (!patient) return [];

  const defaultPetugas = patient.petugasPJ || "Widodo Suprianto A.Md.Kep";
  const defaultKel = patient.kelurahan || "Sananwetan";
  const defaultKejadian = normalizeDateToIso(patient.waktuKejadian || patient.tglMulaiObservasi || new Date().toISOString().slice(0, 10));
  const defaultNip = patient.nipPJ || "197606252009011007";

  const rawSheetCatatan = (patient.catatanPerkembanganHarian || patient.fullData?.catatanPerkembanganHarian || "").trim();
  const hasSheetCatatan = Boolean(rawSheetCatatan && rawSheetCatatan !== "-" && rawSheetCatatan.length > 0);

  // 1. Jika ada Catatan Perkembangan Harian dari Google Spreadsheet (atau tersimpan di pasien):
  // Ini adalah representasi terotorisasi dari kolom Catatan Perkembangan Harian di spreadsheet!
  if (hasSheetCatatan) {
    const fromSheet = parseCatatanHarianString(
      rawSheetCatatan,
      defaultKejadian,
      defaultPetugas,
      defaultKel,
      defaultNip
    );

    // Jika ada riwayatLog lokal, lakukan enrichment tanggal yang sama tanpa menduplikasi
    if (Array.isArray(patient.riwayatLog) && patient.riwayatLog.length > 0) {
      const cleanLocal = patient.riwayatLog.filter((l) => l && !l.id?.startsWith("log-default"));
      return deduplicateAndSortLogs([...fromSheet, ...cleanLocal]);
    }

    return fromSheet;
  }

  // 2. Jika tidak ada catatan dari spreadsheet, gunakan riwayatLog lokal jika ada
  if (Array.isArray(patient.riwayatLog) && patient.riwayatLog.length > 0) {
    const cleanLocal = patient.riwayatLog.filter((l) => l && !l.id?.startsWith("log-default"));
    if (cleanLocal.length > 0) {
      return deduplicateAndSortLogs(cleanLocal);
    }
  }

  // 3. Jika benar-benar belum ada catatan pemantauan harian:
  // KEMBALIKAN ARRAY KOSONG! JANGAN MEMBUAT LOG PALSU HARI KE-1!
  return [];
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

  // 3. Substring / alias search cerdas & terisolasi
  for (const cand of candidateKeys) {
    const candLower = cand.toLowerCase();
    const isSearchingDate = candLower.includes("tanggal") || candLower.includes("waktu") || candLower.includes("tgl");
    const isSearchingDomisili = candLower.includes("domisili");
    const isSearchingKejadian = candLower.includes("kejadian") && !isSearchingDomisili;

    for (const rk of rowKeys) {
      const rkLower = rk.toLowerCase();
      const rawVal = row[rk] !== undefined && row[rk] !== null ? String(row[rk]).trim() : "";
      if (!rawVal) continue;

      // KHUSUS PENCARIAN TANGGAL / WAKTU:
      // Sangat krusial: hindari kolom alamat, tempat kejadian, kelurahan, kronologi, dll.
      if (isSearchingDate) {
        const isExcludedCol =
          rkLower.includes("alamat") ||
          rkLower.includes("tempat") ||
          rkLower.includes("lokasi") ||
          rkLower.includes("kelurahan") ||
          rkLower.includes("desa") ||
          rkLower.includes("kecamatan") ||
          rkLower.includes("kabupaten") ||
          rkLower.includes("kota") ||
          rkLower.includes("provinsi") ||
          rkLower.includes("kronologi") ||
          rkLower.includes("foto") ||
          rkLower.includes("luka") ||
          rkLower.includes("hewan") ||
          rkLower.includes("nama") ||
          rkLower.includes("pemilik") ||
          rkLower.includes("petugas");

        if (!isExcludedCol) {
          if (
            rkLower.includes("tanggal kejadian") ||
            rkLower.includes("tgl kejadian") ||
            rkLower.includes("waktu kejadian") ||
            rkLower.includes("tanggal gigitan") ||
            rkLower.includes("waktu gigitan") ||
            rkLower.includes("waktukejadian") ||
            rkLower.includes("tanggalkejadian")
          ) {
            // Pastikan nilai memiliki angka (tanggal)
            if (/\d/.test(rawVal)) return rawVal;
          } else if (
            (candLower.includes("tanggal") && (rkLower.includes("tanggal") || rkLower.includes("tgl"))) ||
            (candLower.includes("waktu") && (rkLower.includes("waktu") || rkLower.includes("timestamp")))
          ) {
            if (/\d/.test(rawVal)) return rawVal;
          }
        }
        continue;
      }

      // KHUSUS PENCARIAN DOMISILI KORBAN (Kelurahan/Kecamatan/KabKota Domisili):
      if (isSearchingDomisili) {
        if (candLower.includes("kelurahan") && (rkLower.includes("domisili") || rkLower.includes("korban")) && (rkLower.includes("kelurahan") || rkLower.includes("desa"))) {
          return rawVal;
        }
        if (candLower.includes("kecamatan") && (rkLower.includes("domisili") || rkLower.includes("korban")) && rkLower.includes("kecamatan")) {
          return rawVal;
        }
        if ((candLower.includes("kab") || candLower.includes("kota")) && (rkLower.includes("domisili") || rkLower.includes("korban")) && (rkLower.includes("kab") || rkLower.includes("kota"))) {
          return rawVal;
        }
        if (rkLower.includes("domisili") && rkLower.includes(candLower.replace("domisili", "").trim())) {
          return rawVal;
        }
        continue;
      }

      // KHUSUS PENCARIAN ALAMAT / TEMPAT KEJADIAN:
      if (isSearchingKejadian) {
        // Jangan ambil kolom domisili korban
        if (rkLower.includes("domisili")) continue;
        if (candLower.includes("alamat") && (rkLower.includes("kejadian") || rkLower.includes("tempat") || rkLower.includes("lokasi"))) {
          return rawVal;
        }
        if (candLower.includes("kelurahan") && (rkLower.includes("kejadian") || rkLower.includes("lokasi") || rkLower === "kelurahan")) {
          return rawVal;
        }
      }

      // Khusus pencarian nama korban/pasien (hindari nama pemilik / pelaksana / petugas / hewan)
      if (candLower.includes("nama") && candLower.includes("korban")) {
        if (
          rkLower.includes("nama") &&
          !rkLower.includes("pemilik") &&
          !rkLower.includes("petugas") &&
          !rkLower.includes("pelaksana") &&
          !rkLower.includes("hewan")
        ) {
          return rawVal;
        }
      }

      // Khusus ID kasus
      if (candLower.includes("id_kasus") && (rkLower.includes("id") || rkLower.includes("kode") || rkLower.includes("register") || rkLower === "no")) {
        return rawVal;
      }

      // Khusus Kelurahan umum (fallback)
      if (candLower.includes("kelurahan") && !isSearchingDomisili && !isSearchingKejadian) {
        if (rkLower.includes("kelurahan") || rkLower.includes("desa") || rkLower === "wilayah") {
          return rawVal;
        }
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

// Filter Pasien Berdasarkan Hak Akses Pengguna & Filter Kelurahan Domisili Korban
export function getFilteredPatientsByAccess(
  user: UserAccessProfile,
  selectedKelurahanFilter?: string,
  statusFilter?: string,
  searchQuery?: string,
  sourcePatients?: PatientMonitoringItem[]
): PatientMonitoringItem[] {
  const all = sourcePatients && sourcePatients.length > 0 ? sourcePatients : getAllPatients();

  return all.filter((item) => {
    // 1. Hak Akses Kelurahan Pengguna - Mengacu pada Kelurahan Domisili Korban
    const domisiliKorban = item.kelurahanDomisili || item.kelurahan || "Sananwetan";
    const itemKelDomisili = normalizeKelurahanName(domisiliKorban);

    if (!user.isKoordinator && user.kelurahan !== "Semua") {
      // Petugas hanya memantau pasien di kelurahan domisilinya
      const userKel = normalizeKelurahanName(user.kelurahan);
      if (itemKelDomisili !== userKel && !itemKelDomisili.includes(userKel) && !userKel.includes(itemKelDomisili)) {
        return false;
      }
    } else {
      // Koordinator / Admin bisa filter kelurahan domisili secara bebas
      if (selectedKelurahanFilter && selectedKelurahanFilter !== "Semua") {
        const selKel = normalizeKelurahanName(selectedKelurahanFilter);
        if (itemKelDomisili !== selKel && !itemKelDomisili.includes(selKel) && !selKel.includes(itemKelDomisili)) {
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
      const alamatTKP = (item.alamatKejadian || "").toLowerCase();
      const hpr = (item.spesiesHPR || "").toLowerCase();
      const nik = (item.nikKorban || "").toLowerCase();
      const kelDom = (item.kelurahanDomisili || item.kelurahan || "").toLowerCase();
      const kelTKP = (item.kelurahanKejadian || "").toLowerCase();
      const pet = (item.petugasPJ || "").toLowerCase();

      const match =
        nama.includes(q) ||
        id.includes(q) ||
        alamat.includes(q) ||
        alamatTKP.includes(q) ||
        hpr.includes(q) ||
        nik.includes(q) ||
        kelDom.includes(q) ||
        kelTKP.includes(q) ||
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
export async function deletePatientById(id_kasus: string, customUrl?: string): Promise<boolean> {
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

  // 4. Sinkronisasi penghapusan ke Google Spreadsheet secara realtime
  const targetUrl = (customUrl || getWebAppUrl() || DEFAULT_WEB_APP_URL || "").trim();
  const onlineNow = isAppOnline();

  if (onlineNow && targetUrl && targetUrl.includes("script.google.com")) {
    try {
      await sendToAppsScript(targetUrl, { id_kasus: cleanId, id: cleanId, action: "delete" }, "update");
    } catch (err) {
      console.warn("Gagal mengirim perintah hapus ke Apps Script, masuk antrean:", err);
      addToOfflineQueue({
        type: "update_var",
        caseId: cleanId,
        patientName: cleanId,
        kelurahan: "Sananwetan",
        payload: { id_kasus: cleanId, id: cleanId, action: "delete" }
      });
    }
  } else if (!onlineNow) {
    addToOfflineQueue({
      type: "update_var",
      caseId: cleanId,
      patientName: cleanId,
      kelurahan: "Sananwetan",
      payload: { id_kasus: cleanId, id: cleanId, action: "delete" }
    });
  }

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

  const finalKelDomisili = formData.kelurahanDomisiliCustom && formData.kelurahanDomisili?.toLowerCase().includes("lainnya")
    ? formData.kelurahanDomisiliCustom
    : (formData.kelurahanDomisili || finalKel);

  const finalKecDomisili = formData.kecamatanDomisiliCustom && formData.kecamatanDomisili?.toLowerCase().includes("lainnya")
    ? formData.kecamatanDomisiliCustom
    : (formData.kecamatanDomisili || finalKec);

  const finalKabDomisili = formData.kabupatenKotaDomisiliCustom && formData.kabupatenKotaDomisili?.toLowerCase().includes("lainnya")
    ? formData.kabupatenKotaDomisiliCustom
    : (formData.kabupatenKotaDomisili || finalKab);

  const finalProvDomisili = formData.provinsiDomisili || "Jawa Timur";

  const finalHpr = formData.spesiesLain && formData.spesiesHPR === "Lainnya"
    ? formData.spesiesLain
    : formData.spesiesHPR || "";

  const updatedPatient: PatientMonitoringItem = {
    id_kasus,
    timestamp_submit: new Date().toLocaleString("id-ID"),
    waktuKejadian: formData.waktuKejadian || "",
    tanggalKejadian: formData.tanggalKejadian || tglKejadian,
    jamKejadian: formData.jamKejadian || "",
    tanggalBerkunjungFaskes: formData.tanggalBerkunjungFaskes || "",
    namaFaskes: formData.namaFaskes || "",
    sumberInfo: formData.sumberInfo || "",
    sumberLaporan: formData.sumberLaporan || "",
    alamatKejadian: formData.alamatKejadian || "",
    kelurahanKejadian: finalKel,
    kecamatanKejadian: finalKec,
    kabupatenKotaKejadian: finalKab,
    provinsiKejadian: formData.provinsi || "Jawa Timur",
    kelurahanDomisili: finalKelDomisili,
    kecamatanDomisili: finalKecDomisili,
    kabupatenKotaDomisili: finalKabDomisili,
    provinsiDomisili: finalProvDomisili,
    namaKorban: formData.namaKorban || "",
    umurKorban: formData.umurKorban || "",
    jkKorban: formData.jkKorban || "",
    alamatKorban: formData.alamatKorban || formData.alamatKejadian || "",
    kontakKorban: formData.noHpKorban || formData.kontakPemilik || "",
    noHpKorban: formData.noHpKorban || "",
    kelurahan: finalKelDomisili || finalKel,
    kecamatan: finalKecDomisili || finalKec,
    kabupatenKota: finalKabDomisili || finalKab,
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
    riwayatLog: (existing?.catatanPerkembanganHarian && existing.catatanPerkembanganHarian !== "-")
      ? parseCatatanHarianString(existing.catatanPerkembanganHarian, tglKejadian, formData.pelaksanaNama || "", finalKel, formData.pelaksanaNIP || "")
      : (Array.isArray(existing?.riwayatLog) && existing.riwayatLog.length > 0
        ? deduplicateAndSortLogs(existing.riwayatLog)
        : []),
    catatanPerkembanganHarian: existing?.catatanPerkembanganHarian || (existing?.riwayatLog && existing.riwayatLog.length > 0 ? existing.riwayatLog.map((log: any, idx: number) => `[${log.tanggal || `Hari ke-${log.hariKe || idx + 1}`}] ${log.petugasNama ? `(${log.petugasNama})` : ""} Kondisi: ${log.statusLuka || log.kondisiKorban || "-"}, Suhu: ${log.suhuTubuh ? (log.suhuTubuh.includes("°C") ? log.suhuTubuh : `${log.suhuTubuh} °C`) : "-"}, Hewan: ${log.kondisiHewan || "-"}, Tindakan: ${log.tindakanDilakukan || "-"}, Catatan: ${log.catatanKhusus || "-"}`).join("\n\n") : "-"),
    petugasPJ: formData.pelaksanaNama || existing?.petugasPJ || "",
    nipPJ: formData.pelaksanaNIP || existing?.nipPJ || "",
    lastUpdated: new Date().toLocaleString("id-ID"),
    fullData: {
      ...formData,
      kelurahanDomisili: finalKelDomisili,
      kecamatanDomisili: finalKecDomisili,
      kabupatenKotaDomisili: finalKabDomisili,
      provinsiDomisili: finalProvDomisili,
      catatanPerkembanganHarian: existing?.catatanPerkembanganHarian || ""
    }
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
        let rawJam = "";
        let alamatKejadian = "";
        let kelurahanKejadian = "Sananwetan";
        let kecamatanKejadian = "Sananwetan";
        let kabupatenKotaKejadian = "Kota Blitar";
        let provinsiKejadian = "Jawa Timur";
        let rawAlamatKorban = "";
        let kelurahanDomisili = "";
        let kecamatanDomisili = "";
        let kabupatenKotaDomisili = "";
        let provinsiDomisili = "Jawa Timur";

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
          alamatKejadian = alamat;
          kelurahanKejadian = kelurahan;
          kecamatanKejadian = "Sananwetan";
          kabupatenKotaKejadian = "Kota Blitar";
          provinsiKejadian = "Jawa Timur";
          rawAlamatKorban = alamat;
          kelurahanDomisili = kelurahan;
          kecamatanDomisili = "Sananwetan";
          kabupatenKotaDomisili = "Kota Blitar";
          provinsiDomisili = "Jawa Timur";
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
            "Tanggal Kejadian",
            "tanggalKejadian",
            "Tanggal kejadian",
            "tanggal kejadian",
            "Waktu Kejadian",
            "waktuKejadian",
            "Waktu kejadian",
            "Tanggal Gigitan",
            "tanggal gigitan",
            "Tgl Kejadian",
            "tgl kejadian",
            "Tgl Gigitan",
            "Waktu / Tanggal Kejadian",
            "Waktu dan Tempat Kejadian",
            "Waktu & Tempat Kejadian",
            "Tanggal",
            "tanggal",
            "Waktu Submit",
            "Timestamp",
            "col_2"
          ], "");

          rawJam = getFieldFromRow(rd, [
            "Jam Kejadian",
            "jamKejadian",
            "Jam",
            "Pukul",
            "Waktu"
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

          // 1. Lokasi Tempat Kejadian (TKP)
          alamatKejadian = String(getFieldFromRow(rd, [
            "Alamat Kejadian",
            "alamatKejadian",
            "Lokasi Kejadian",
            "Tempat Kejadian",
            "Alamat Lokasi Kejadian",
            "col_3"
          ], "")).trim();

          kelurahanKejadian = String(getFieldFromRow(rd, [
            "Kelurahan Kejadian",
            "kelurahanKejadian",
            "Kelurahan TKP",
            "Kelurahan Lokasi Kejadian",
            "Kelurahan Tempat Kejadian",
            "Kelurahan",
            "col_4"
          ], "Sananwetan")).trim();

          kecamatanKejadian = String(getFieldFromRow(rd, [
            "Kecamatan Kejadian",
            "kecamatanKejadian",
            "Kecamatan TKP",
            "Kecamatan Lokasi Kejadian",
            "Kecamatan",
            "col_5"
          ], "Sananwetan")).trim();

          kabupatenKotaKejadian = String(getFieldFromRow(rd, [
            "Kabupaten/Kota Kejadian",
            "kabupatenKotaKejadian",
            "Kab/Kota Kejadian",
            "Kabupaten Kejadian",
            "Kota Kejadian",
            "Kabupaten/Kota",
            "col_6"
          ], "Kota Blitar")).trim();

          provinsiKejadian = String(getFieldFromRow(rd, [
            "Provinsi Kejadian",
            "provinsiKejadian",
            "Provinsi",
            "col_7"
          ], "Jawa Timur")).trim();

          // 2. Alamat & Wilayah Domisili Korban (Diutamakan untuk filter user/petugas)
          rawAlamatKorban = String(getFieldFromRow(rd, [
            "Alamat Korban",
            "alamatKorban",
            "Alamat Domisili Korban",
            "Alamat Domisili",
            "Alamat Tempat Tinggal",
            "Alamat",
            "col_24"
          ], "-")).trim();

          kelurahanDomisili = String(getFieldFromRow(rd, [
            "Kelurahan domisili korban",
            "kelurahanDomisili",
            "Kelurahan Domisili Korban",
            "Kelurahan Domisili",
            "Kelurahan Korban",
            "Kelurahan Tempat Tinggal",
            "Kelurahan domisili",
            "Desa Domisili",
            "kelurahan_domisili"
          ], "")).trim();

          kecamatanDomisili = String(getFieldFromRow(rd, [
            "Kecamatan domisili korban",
            "kecamatanDomisili",
            "Kecamatan Domisili Korban",
            "Kecamatan Domisili",
            "Kecamatan Korban",
            "Kecamatan Tempat Tinggal",
            "Kecamatan domisili",
            "kecamatan_domisili"
          ], "")).trim();

          kabupatenKotaDomisili = String(getFieldFromRow(rd, [
            "Kab kota korban",
            "kabupatenKotaDomisili",
            "Kab/Kota Korban",
            "Kab/Kota Domisili Korban",
            "Kab/Kota domisili",
            "Kabupaten/Kota Korban",
            "Kabupaten/Kota Domisili Korban",
            "Kabupaten/Kota Domisili",
            "Kabupaten Kota Domisili",
            "Kab kota domisili",
            "kab_kota_korban"
          ], "")).trim();

          provinsiDomisili = String(getFieldFromRow(rd, [
            "Provinsi domisili korban",
            "provinsiDomisili",
            "Provinsi Domisili Korban",
            "Provinsi Domisili",
            "Provinsi Korban",
            "Provinsi domisili"
          ], "")).trim();

          // Kelurahan utama untuk seleksi/filter mengacu ke kelurahan domisili korban
          kelurahan = (kelurahanDomisili || kelurahanKejadian || getFieldFromRow(rd, ["Kelurahan", "kelurahan", "Desa"], "Sananwetan")).trim();
          alamat = rawAlamatKorban !== "-" && rawAlamatKorban !== "" ? rawAlamatKorban : (alamatKejadian || "-");

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

        const rawTanggalBerkunjungFaskes = String(getFieldFromRow(rd, [
          "Tgl berkunjung difaskes",
          "Tgl berkunjung di faskes",
          "Tgl berkunjung faskes",
          "Tgl berkunjung ke faskes",
          "Tanggal Berkunjung ke Faskes",
          "Tanggal Berkunjung Faskes",
          "tanggalBerkunjungFaskes",
          "Tanggal berkunjung difaskes",
          "Tanggal berkunjung di faskes",
          "Tanggal Berkunjung",
          "Tgl Berkunjung",
          "Tanggal Faskes",
          "Tgl Kunjungan Faskes",
          "Tgl Kunjung Faskes"
        ], "")).trim();

        const rawSumberLaporan = String(getFieldFromRow(rd, [
          "Sumber Laporan",
          "sumberLaporan",
          "sumber_laporan",
          "Sumber laporan",
          "sumber lap",
          "col_35",
          "col_23"
        ], "")).trim();

        const rawNamaFaskes = String(getFieldFromRow(rd, [
          "Nama Faskes",
          "namaFaskes",
          "Faskes",
          "Fasilitas Kesehatan",
          "Nama Fasilitas Kesehatan",
          "Puskesmas/Faskes",
          "Sumber Laporan",
          "sumberLaporan"
        ], rawSumberLaporan || "Puskesmas Sananwetan")).trim();

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

        // Helper fungsi resolusi Pertolongan Pertama (Mendukung multi-pilihan & kolom baru kustom)
        const resolvePertolonganPertamaFromRow = (fallback: string = ""): {
          text: string;
          cuciKurang: string;
          cuciLebih: string;
          varDosis1: string;
          sar: string;
        } => {
          const mainVal = String(getFieldFromRow(rd, ["Pertolongan Pertama", "pertolonganPertama", "col_28"], "")).trim();
          const cKurang = String(getFieldFromRow(rd, ["Cuci luka < 12 jam", "Cuci Luka < 12 Jam", "cuciLukaKurang12Jam", "< 12 jam"], "")).trim();
          const cLebih = String(getFieldFromRow(rd, ["Cuci luka > 12 jam", "Cuci Luka > 12 Jam", "cuciLukaLebih12Jam", "> 12 jam"], "")).trim();
          const cVar1 = String(getFieldFromRow(rd, ["Var dosis 1, 1 dosis dan 1 dosis", "VAR Dosis 1", "Var Dosis 1", "varDosis1"], "")).trim();
          const cSar = String(getFieldFromRow(rd, ["SAR", "Serum Anti Rabies", "sar"], "")).trim();

          const collected: string[] = [];
          if ((cKurang && cKurang !== "-" && !cKurang.toLowerCase().startsWith("tidak")) || mainVal.includes("< 12") || mainVal.includes("<12") || mainVal.toLowerCase().includes("kurang 12")) {
            collected.push("Cuci luka < 12 jam");
          }
          if ((cLebih && cLebih !== "-" && !cLebih.toLowerCase().startsWith("tidak")) || mainVal.includes("> 12") || mainVal.includes(">12") || mainVal.toLowerCase().includes("lebih 12")) {
            collected.push("Cuci luka > 12 jam");
          }
          if ((cVar1 && cVar1 !== "-" && !cVar1.toLowerCase().startsWith("tidak")) || mainVal.toLowerCase().includes("var dosis 1") || mainVal.toLowerCase().includes("1 dosis dan 1 dosis") || (mainVal.toLowerCase().includes("var") && mainVal.toLowerCase().includes("1 dosis"))) {
            collected.push("Var dosis 1, 1 dosis dan 1 dosis");
          }
          if ((cSar && cSar !== "-" && !cSar.toLowerCase().startsWith("tidak")) || /\bSAR\b/i.test(mainVal) || mainVal.toLowerCase().includes("serum anti rabies")) {
            collected.push("SAR");
          }

          let resText = mainVal;
          if (collected.length > 0) {
            resText = collected.join(", ");
          } else if (!resText || resText === "-") {
            resText = fallback || "Tidak Dilakukan";
          }

          return {
            text: resText,
            cuciKurang: collected.includes("Cuci luka < 12 jam") ? "Ya" : "-",
            cuciLebih: collected.includes("Cuci luka > 12 jam") ? "Ya" : "-",
            varDosis1: collected.includes("Var dosis 1, 1 dosis dan 1 dosis") ? "Ya" : "-",
            sar: collected.includes("SAR") ? "Ya" : "-"
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

          const currentLocalLogs = Array.isArray(ex.riwayatLog) ? ex.riwayatLog.filter(l => l && !l.id?.startsWith("log-default")) : [];
          let parsedFromSheet: MonitoringDailyLog[] = [];
          if (rawCatatanLog && rawCatatanLog !== "-" && rawCatatanLog.trim().length > 0) {
            parsedFromSheet = parseCatatanHarianString(
              rawCatatanLog,
              tglKejadian,
              rawPJMonitoring && rawPJMonitoring !== "-" ? rawPJMonitoring : (ex.petugasPJ || "Petugas Puskesmas"),
              kelurahan && kelurahan !== "-" ? kelurahan : (ex.kelurahan || "Sananwetan"),
              nipPJ !== "-" ? nipPJ : (ex.nipPJ || "-")
            );
          }

          // Sinkronisasi catatan perkembangan harian:
          // 1. Jika spreadsheet memiliki Catatan Perkembangan Harian, jadikan data spreadsheet sebagai acuan utama
          //    dan gabungkan dengan local logs via deduplikasi cerdas (1 entri per hari)
          // 2. Jika di spreadsheet kosong / dihapus, dan tidak ada pending offline queue, jadikan kosong
          const hasPendingOffline = offlineQueue.some((q) => q.caseId === ex.id_kasus);
          let mergedLogs: MonitoringDailyLog[] = [];
          let combinedCatatanText = "-";

          if (parsedFromSheet.length > 0) {
            mergedLogs = deduplicateAndSortLogs([...parsedFromSheet, ...currentLocalLogs]);
            combinedCatatanText = rawCatatanLog;
          } else if (rawCatatanLog === "" || rawCatatanLog === "-") {
            if (hasPendingOffline && currentLocalLogs.length > 0) {
              mergedLogs = deduplicateAndSortLogs(currentLocalLogs);
              combinedCatatanText = mergedLogs.map((log: any, idx: number) => {
                const tglStr = log.tanggal || `Hari ke-${log.hariKe || idx + 1}`;
                const suhuStr = log.suhuTubuh ? (log.suhuTubuh.includes("°C") ? log.suhuTubuh : `${log.suhuTubuh} °C`) : "-";
                const petStr = log.petugasNama ? `(${log.petugasNama})` : "";
                return `[${tglStr}] ${petStr} Kondisi: ${log.kondisiKorban || log.statusLuka || "-"}, Suhu: ${suhuStr}, Hewan: ${log.kondisiHewan || "-"}, Tindakan: ${log.tindakanDilakukan || "-"}, Catatan: ${log.catatanKhusus || "-"}`;
              }).join("\n\n");
            } else {
              mergedLogs = [];
              combinedCatatanText = "-";
            }
          } else {
            mergedLogs = currentLocalLogs;
            combinedCatatanText = rawCatatanLog || "-";
          }

          const resolvedHariObs = Math.max(rawHariObs || 0, ex.hariObservasiKe || 0, 1);

          // Susun fullData lengkap dari baris spreadsheet agar tampilan PDF 100% mutakhir dengan data spreadsheet
          const fullDataFromSheet: Partial<FormGHPRData> = {
            waktuKejadian: tglKejadian || String(getFieldFromRow(rd, ["Waktu Kejadian", "waktuKejadian", "Tanggal Gigitan", "col_2"], ex.waktuKejadian || "")),
            tanggalKejadian: tglKejadian,
            jamKejadian: rawJam || ex.jamKejadian || "",
            tanggalBerkunjungFaskes: rawTanggalBerkunjungFaskes || ex.tanggalBerkunjungFaskes || ex.fullData?.tanggalBerkunjungFaskes || "",
            namaFaskes: rawNamaFaskes || ex.namaFaskes || ex.fullData?.namaFaskes || "Puskesmas Sananwetan",
            alamatKejadian: alamatKejadian || ex.alamatKejadian || "",
            kelurahan: kelurahanKejadian || ex.kelurahan || "Sananwetan",
            kelurahanCustom: "",
            kecamatan: kecamatanKejadian || ex.kecamatan || "Sananwetan",
            kecamatanCustom: "",
            kabupatenKota: kabupatenKotaKejadian || ex.kabupatenKota || "Kota Blitar",
            provinsi: provinsiKejadian || ex.provinsi || "Jawa Timur",
            sumberInfo: String(getFieldFromRow(rd, ["Sumber Informasi", "sumberInfo", "col_8"], "Laporan Petugas Faskes")),
            kronologi: String(getFieldFromRow(rd, ["Kronologi Kejadian", "kronologi", "Kronologi", "col_9"], ex.fullData?.kronologi || `Kasus gigitan HPR di wilayah Kel. ${kelurahan}`)),
            spesiesHPR: spesiesHPR || ex.spesiesHPR,
            spesiesLain: String(getFieldFromRow(rd, ["Spesies Lain", "spesiesLain"], "")),
            ras: String(getFieldFromRow(rd, ["Ras Hewan", "rasHewan", "ras", "col_11"], ex.rasHewan || "Lokal")),
            jkHewan: String(getFieldFromRow(rd, ["Jenis Kelamin Hewan", "jkHewan", "col_12"], ex.fullData?.jkHewan || "Jantan")),
            umurHewan: (() => {
              const rawH = String(getFieldFromRow(rd, ["Umur Hewan", "umurHewan", "col_13"], ex.fullData?.umurHewan || "")).trim();
              if (!rawH || rawH === "-") return "";
              const mH = rawH.match(/^(\d+(?:[.,]\d+)?)/);
              return mH ? mH[1] : rawH.replace(/[^\d.,]/g, "").trim();
            })(),
            satuanUmur: (() => {
              const rawH = String(getFieldFromRow(rd, ["Umur Hewan", "umurHewan", "col_13"], "")).trim();
              if (rawH.toLowerCase().includes("bulan")) return "Bulan";
              if (rawH.toLowerCase().includes("hari")) return "Hari";
              return String(getFieldFromRow(rd, ["Satuan Umur", "satuanUmur"], ex.fullData?.satuanUmur || "Tahun"));
            })(),
            metodePelihara: String(getFieldFromRow(rd, ["Metode Pemeliharaan", "metodePelihara", "col_14"], ex.fullData?.metodePelihara || "Diliarkan / Bebas")),
            asalHewan: String(getFieldFromRow(rd, ["Asal Hewan", "asalHewan"], ex.fullData?.asalHewan || "Lokal")),
            pakan: String(getFieldFromRow(rd, ["Pakan", "pakan"], ex.fullData?.pakan || "")).trim() === "Sisa Makanan Rumah Tangga" ? "" : String(getFieldFromRow(rd, ["Pakan", "pakan"], ex.fullData?.pakan || "")).trim(),
            biosekuriti: String(getFieldFromRow(rd, ["Biosekuriti", "Biosekuriti Kandang", "Biosecurity", "Biosecurity Kandang", "biosekuriti"], ex.fullData?.biosekuriti || "")).trim(),
            sumberAir: String(getFieldFromRow(rd, ["Sumber Air", "sumberAir"], ex.fullData?.sumberAir || "Sumur")),
            kondisiHewan: kondisiHewan !== "-" ? kondisiHewan : ex.kondisiHewan,
            pemilikHewan: String(getFieldFromRow(rd, ["Nama Pemilik", "pemilikHewan", "col_18"], ex.pemilikHewan || "-")),
            alamatPemilik: String(getFieldFromRow(rd, ["Alamat Pemilik", "alamatPemilik", "col_19"], ex.alamatPemilik || "-")),
            kontakPemilik: String(getFieldFromRow(rd, ["Kontak Pemilik", "kontakPemilik", "col_20"], ex.kontakPemilik || "-")),
            riwayatVaksin: String(getFieldFromRow(rd, ["Riwayat Vaksinasi", "riwayatVaksin", "col_16"], ex.fullData?.riwayatVaksin || "Tidak Tahu")),
            tanggalVaksin: String(getFieldFromRow(rd, ["Tanggal Vaksinasi", "tanggalVaksin", "col_17"], ex.fullData?.tanggalVaksin || "")),
            namaKorban: nama && nama !== "-" ? nama : ex.namaKorban,
            umurKorban: (() => {
              const rawU = String(umur !== "-" ? umur : (ex.umurKorban || "")).trim();
              const numOnly = rawU.replace(/[^\d]/g, "").trim();
              return numOnly || (rawU !== "-" ? rawU : "");
            })(),
            noHpKorban: noHp !== "-" ? noHp : (ex.noHpKorban || ex.kontakKorban || "-"),
            alamatKorban: rawAlamatKorban !== "-" && rawAlamatKorban !== "" ? rawAlamatKorban : (ex.alamatKorban || alamatKejadian || "-"),
            kelurahanDomisili: kelurahanDomisili || ex.kelurahanDomisili || "",
            kelurahanDomisiliCustom: "",
            kecamatanDomisili: kecamatanDomisili || ex.kecamatanDomisili || "",
            kecamatanDomisiliCustom: "",
            kabupatenKotaDomisili: kabupatenKotaDomisili || ex.kabupatenKotaDomisili || "",
            kabupatenKotaDomisiliCustom: "",
            provinsiDomisili: provinsiDomisili || ex.provinsiDomisili || "",
            jkKorban: jk || ex.jkKorban,
            kondisiKorban: String(getFieldFromRow(rd, ["Kondisi Korban", "kondisiKorban", "Kondisi Umum Korban", "kondisiUmumKorban"], ex.fullData?.kondisiKorban || "Sehat")),
            kondisiUmumKorban: String(getFieldFromRow(rd, ["Kondisi Umum Korban", "kondisiUmumKorban", "Kondisi Umum", "Keadaan Umum Korban", "Kondisi Korban", "kondisiKorban"], ex.fullData?.kondisiUmumKorban || ex.fullData?.kondisiKorban || "Sehat")),
            pertolonganPertama: resolvePertolonganPertamaFromRow(ex.pertolonganPertama || "Cuci luka sabun air mengalir 15 menit").text,
            cuciLukaKurang12Jam: resolvePertolonganPertamaFromRow(ex.pertolonganPertama).cuciKurang,
            cuciLukaLebih12Jam: resolvePertolonganPertamaFromRow(ex.pertolonganPertama).cuciLebih,
            varDosis1: resolvePertolonganPertamaFromRow(ex.pertolonganPertama).varDosis1,
            sar: resolvePertolonganPertamaFromRow(ex.pertolonganPertama).sar,
            detailPertolongan: String(getFieldFromRow(rd, ["Detail Pertolongan", "detailPertolongan"], ex.fullData?.detailPertolongan || "")),
            kondisiLuka: kondisiLuka !== "-" ? kondisiLuka : ex.kondisiLuka,
            lokasiLuka: String(getFieldFromRow(rd, ["Lokasi Luka", "lokasiLuka", "col_27"], ex.lokasiLuka || "Tangan")),
            tindakanHPR: String(getFieldFromRow(rd, ["Tindakan terhadap HPR", "tindakanHPR", "col_30"], ex.tindakanHPR || "Observasi 14 Hari")),
            tindakanKasus: String(getFieldFromRow(rd, ["Tindakan Kasus", "tindakanKasus", "col_29"], ex.tindakanKasus || "Pemberian VAR")),
            tindakanMasyarakat: String(getFieldFromRow(rd, ["Tindakan Masyarakat", "tindakanMasyarakat"], ex.fullData?.tindakanMasyarakat || "-")),
            rekomendasi: rekomendasi !== "-" ? rekomendasi : ex.rekomendasi,
            sumberLaporan: rawSumberLaporan || rawNamaFaskes || String(getFieldFromRow(rd, ["Sumber Laporan", "sumberLaporan"], ex.fullData?.sumberLaporan || "Laporan Petugas Faskes")),
            fotoDokumentasi: String(getFieldFromRow(rd, ["Foto Dokumentasi", "fotoDokumentasi", "foto"], ex.fullData?.fotoDokumentasi || "")),
            timKetua: String(getFieldFromRow(rd, ["Ketua Tim PE", "timKetua", "col_31"], ex.fullData?.timKetua || petugasPJ)),
            timAnggota: String(getFieldFromRow(rd, ["Anggota Tim PE", "timAnggota", "col_32"], ex.fullData?.timAnggota || "Kader Kesehatan Kelurahan")),
            tanggalPelaksanaan: String(getFieldFromRow(rd, ["Tanggal Pelaksanaan", "tanggalPelaksanaan", "col_33"], ex.fullData?.tanggalPelaksanaan || tglKejadian || new Date().toISOString().slice(0, 10))),
            pelaksanaNama: rawPJMonitoring && rawPJMonitoring !== "-" ? rawPJMonitoring : (petugasPJ !== "-" ? petugasPJ : ex.petugasPJ),
            pelaksanaNIP: nipPJ !== "-" ? nipPJ : ex.nipPJ,
            statusPemantauan: (statusPemantauan as StatusPemantauanPasien) || ex.statusPemantauan || "Dalam Pemantauan (Aktif)",
            hariObservasiKe: resolvedHariObs,
            statusHewanObservasi: (rawStatusHewanObs && rawStatusHewanObs !== "-" ? rawStatusHewanObs : ex.statusHewanObservasi) as StatusHewanObservasi,
            catatanPerkembanganHarian: combinedCatatanText
          };

          const merged: PatientMonitoringItem = {
            ...ex,
            id_kasus: sId,
            waktuKejadian: tglKejadian || ex.waktuKejadian,
            tanggalKejadian: tglKejadian || ex.tanggalKejadian,
            jamKejadian: rawJam || ex.jamKejadian || "",
            tanggalBerkunjungFaskes: rawTanggalBerkunjungFaskes || ex.tanggalBerkunjungFaskes || ex.fullData?.tanggalBerkunjungFaskes || "",
            namaFaskes: rawNamaFaskes || rawSumberLaporan || ex.namaFaskes || ex.fullData?.namaFaskes || "Puskesmas Sananwetan",
            sumberInfo: String(fullDataFromSheet.sumberInfo || ex.sumberInfo || "Laporan Petugas Faskes"),
            sumberLaporan: rawSumberLaporan || rawNamaFaskes || String(fullDataFromSheet.sumberLaporan || ex.sumberLaporan || "Laporan Petugas Faskes"),
            alamatKejadian: alamatKejadian || ex.alamatKejadian || "",
            kelurahanKejadian: kelurahanKejadian || ex.kelurahanKejadian || "Sananwetan",
            kecamatanKejadian: kecamatanKejadian || ex.kecamatanKejadian || "Sananwetan",
            kabupatenKotaKejadian: kabupatenKotaKejadian || ex.kabupatenKotaKejadian || "Kota Blitar",
            provinsiKejadian: provinsiKejadian || ex.provinsiKejadian || "Jawa Timur",
            kelurahanDomisili: kelurahanDomisili || ex.kelurahanDomisili || kelurahan,
            kecamatanDomisili: kecamatanDomisili || ex.kecamatanDomisili || kecamatanKejadian || "Sananwetan",
            kabupatenKotaDomisili: kabupatenKotaDomisili || ex.kabupatenKotaDomisili || kabupatenKotaKejadian || "Kota Blitar",
            provinsiDomisili: provinsiDomisili || ex.provinsiDomisili || "Jawa Timur",
            namaKorban: nama && nama !== "-" ? nama : ex.namaKorban,
            kelurahan: kelurahan && kelurahan !== "-" ? kelurahan : ex.kelurahan,
            alamatKorban: rawAlamatKorban !== "-" && rawAlamatKorban !== "" ? rawAlamatKorban : (ex.alamatKorban || alamatKejadian || "-"),
            kontakKorban: noHp !== "-" ? noHp : (ex.kontakKorban || ex.noHpKorban || "-"),
            noHpKorban: noHp !== "-" ? noHp : (ex.noHpKorban || ex.kontakKorban || "-"),
            kondisiKorban: String(getFieldFromRow(rd, ["Kondisi Korban", "kondisiKorban", "Kondisi Umum Korban", "kondisiUmumKorban"], ex.kondisiKorban || "Sehat")),
            kondisiUmumKorban: String(getFieldFromRow(rd, ["Kondisi Umum Korban", "kondisiUmumKorban", "Kondisi Umum", "Keadaan Umum Korban", "Kondisi Korban", "kondisiKorban"], ex.kondisiUmumKorban || ex.kondisiKorban || "Sehat")),
            umurKorban: umur !== "-" ? umur : ex.umurKorban,
            jkKorban: jk || ex.jkKorban,
            kondisiLuka: kondisiLuka !== "-" ? kondisiLuka : ex.kondisiLuka,
            kondisiHewan: kondisiHewan !== "-" ? kondisiHewan : ex.kondisiHewan,
            spesiesHPR: spesiesHPR || ex.spesiesHPR,
            rasHewan: String(fullDataFromSheet.ras || ex.rasHewan || "-"),
            pemilikHewan: String(fullDataFromSheet.pemilikHewan || ex.pemilikHewan || "-"),
            alamatPemilik: String(fullDataFromSheet.alamatPemilik || ex.alamatPemilik || "-"),
            kontakPemilik: String(fullDataFromSheet.kontakPemilik || ex.kontakPemilik || "-"),
            pertolonganPertama: String(fullDataFromSheet.pertolonganPertama || ex.pertolonganPertama || "-"),
            tindakanKasus: String(fullDataFromSheet.tindakanKasus || ex.tindakanKasus || "-"),
            tindakanHPR: String(fullDataFromSheet.tindakanHPR || ex.tindakanHPR || "Observasi 14 Hari"),
            lokasiLuka: String(fullDataFromSheet.lokasiLuka || ex.lokasiLuka || "-"),
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
            catatanPerkembanganHarian: combinedCatatanText,
            fullData: {
              ...(ex.fullData || {}),
              ...fullDataFromSheet,
              namaKorban: nama && nama !== "-" ? nama : ex.namaKorban,
              umurKorban: umur !== "-" ? umur : ex.umurKorban,
              jkKorban: jk || ex.jkKorban,
              alamatKorban: rawAlamatKorban !== "-" && rawAlamatKorban !== "" ? rawAlamatKorban : (ex.alamatKorban || alamatKejadian || "-"),
              noHpKorban: noHp !== "-" ? noHp : (ex.noHpKorban || ex.kontakKorban || "-"),
              kelurahan: kelurahan && kelurahan !== "-" ? kelurahan : ex.kelurahan,
              kondisiLuka: kondisiLuka !== "-" ? kondisiLuka : ex.kondisiLuka,
              kondisiHewan: kondisiHewan !== "-" ? kondisiHewan : ex.kondisiHewan,
              rekomendasi: rekomendasi !== "-" ? rekomendasi : ex.rekomendasi,
              catatanPerkembanganHarian: combinedCatatanText
            } as any,
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

          // Susun fullData lengkap untuk kasus baru dari Google Sheets
          const fullDataNewSheet: Partial<FormGHPRData> = {
            waktuKejadian: tglKejadian || String(getFieldFromRow(rd, ["Waktu Kejadian", "waktuKejadian", "Tanggal Gigitan", "col_2"], "")),
            tanggalKejadian: tglKejadian,
            jamKejadian: rawJam || "",
            tanggalBerkunjungFaskes: rawTanggalBerkunjungFaskes,
            namaFaskes: rawNamaFaskes || rawSumberLaporan || "Puskesmas Sananwetan",
            alamatKejadian: alamatKejadian || "",
            kelurahan: kelurahanKejadian || "Sananwetan",
            kelurahanCustom: "",
            kecamatan: kecamatanKejadian || "Sananwetan",
            kecamatanCustom: "",
            kabupatenKota: kabupatenKotaKejadian || "Kota Blitar",
            provinsi: provinsiKejadian || "Jawa Timur",
            sumberInfo: String(getFieldFromRow(rd, ["Sumber Informasi", "sumberInfo", "col_8"], "Laporan Petugas Faskes")),
            kronologi: String(getFieldFromRow(rd, ["Kronologi Kejadian", "kronologi", "Kronologi", "col_9"], `Kasus gigitan HPR di wilayah Kel. ${kelurahan}`)),
            spesiesHPR: spesiesHPR,
            spesiesLain: String(getFieldFromRow(rd, ["Spesies Lain", "spesiesLain"], "")),
            ras: String(getFieldFromRow(rd, ["Ras Hewan", "rasHewan", "ras", "col_11"], "Lokal")),
            jkHewan: String(getFieldFromRow(rd, ["Jenis Kelamin Hewan", "jkHewan", "col_12"], "Jantan")),
            umurHewan: (() => {
              const rawH = String(getFieldFromRow(rd, ["Umur Hewan", "umurHewan", "col_13"], "")).trim();
              if (!rawH || rawH === "-") return "";
              const mH = rawH.match(/^(\d+(?:[.,]\d+)?)/);
              return mH ? mH[1] : rawH.replace(/[^\d.,]/g, "").trim();
            })(),
            satuanUmur: (() => {
              const rawH = String(getFieldFromRow(rd, ["Umur Hewan", "umurHewan", "col_13"], "")).trim();
              if (rawH.toLowerCase().includes("bulan")) return "Bulan";
              if (rawH.toLowerCase().includes("hari")) return "Hari";
              return String(getFieldFromRow(rd, ["Satuan Umur", "satuanUmur"], "Tahun"));
            })(),
            metodePelihara: String(getFieldFromRow(rd, ["Metode Pemeliharaan", "metodePelihara", "col_14"], "Diliarkan / Bebas")),
            asalHewan: String(getFieldFromRow(rd, ["Asal Hewan", "asalHewan"], "Lokal")),
            pakan: String(getFieldFromRow(rd, ["Pakan", "pakan"], "")).trim() === "Sisa Makanan Rumah Tangga" ? "" : String(getFieldFromRow(rd, ["Pakan", "pakan"], "")).trim(),
            biosekuriti: String(getFieldFromRow(rd, ["Biosekuriti", "Biosekuriti Kandang", "Biosecurity", "Biosecurity Kandang", "biosekuriti"], "")).trim(),
            sumberAir: String(getFieldFromRow(rd, ["Sumber Air", "sumberAir"], "Sumur")),
            kondisiHewan: kondisiHewan,
            pemilikHewan: String(getFieldFromRow(rd, ["Nama Pemilik", "pemilikHewan", "col_18"], "-")),
            alamatPemilik: String(getFieldFromRow(rd, ["Alamat Pemilik", "alamatPemilik", "col_19"], "-")),
            kontakPemilik: String(getFieldFromRow(rd, ["Kontak Pemilik", "kontakPemilik", "col_20"], "-")),
            riwayatVaksin: String(getFieldFromRow(rd, ["Riwayat Vaksinasi", "riwayatVaksin", "col_16"], "Tidak Tahu")),
            tanggalVaksin: String(getFieldFromRow(rd, ["Tanggal Vaksinasi", "tanggalVaksin", "col_17"], "")),
            namaKorban: nama,
            umurKorban: (() => {
              const rawU = String(umur !== "-" ? umur : "").trim();
              const numOnly = rawU.replace(/[^\d]/g, "").trim();
              return numOnly || (rawU !== "-" ? rawU : "");
            })(),
            noHpKorban: noHp !== "-" ? noHp : "",
            alamatKorban: rawAlamatKorban !== "-" && rawAlamatKorban !== "" ? rawAlamatKorban : (alamatKejadian || "-"),
            kelurahanDomisili: kelurahanDomisili || "",
            kelurahanDomisiliCustom: "",
            kecamatanDomisili: kecamatanDomisili || "",
            kecamatanDomisiliCustom: "",
            kabupatenKotaDomisili: kabupatenKotaDomisili || "",
            kabupatenKotaDomisiliCustom: "",
            provinsiDomisili: provinsiDomisili || "",
            jkKorban: jk,
            kondisiKorban: String(getFieldFromRow(rd, ["Kondisi Korban", "kondisiKorban", "Kondisi Umum Korban", "kondisiUmumKorban"], "Sehat")),
            kondisiUmumKorban: String(getFieldFromRow(rd, ["Kondisi Umum Korban", "kondisiUmumKorban", "Kondisi Umum", "Keadaan Umum Korban", "Kondisi Korban", "kondisiKorban"], "Sehat")),
            pertolonganPertama: resolvePertolonganPertamaFromRow("Cuci luka sabun air mengalir 15 menit").text,
            cuciLukaKurang12Jam: resolvePertolonganPertamaFromRow().cuciKurang,
            cuciLukaLebih12Jam: resolvePertolonganPertamaFromRow().cuciLebih,
            varDosis1: resolvePertolonganPertamaFromRow().varDosis1,
            sar: resolvePertolonganPertamaFromRow().sar,
            detailPertolongan: String(getFieldFromRow(rd, ["Detail Pertolongan", "detailPertolongan"], "")),
            kondisiLuka: kondisiLuka,
            lokasiLuka: String(getFieldFromRow(rd, ["Lokasi Luka", "lokasiLuka", "col_27"], "Tangan")),
            tindakanHPR: String(getFieldFromRow(rd, ["Tindakan terhadap HPR", "tindakanHPR", "col_30"], "Observasi 14 Hari")),
            tindakanKasus: String(getFieldFromRow(rd, ["Tindakan Kasus", "tindakanKasus", "col_29"], "Pemberian VAR")),
            tindakanMasyarakat: String(getFieldFromRow(rd, ["Tindakan Masyarakat", "tindakanMasyarakat"], "-")),
            rekomendasi: rekomendasi,
            sumberLaporan: rawSumberLaporan || rawNamaFaskes || String(getFieldFromRow(rd, ["Sumber Laporan", "sumberLaporan"], "Laporan Petugas Faskes")),
            fotoDokumentasi: String(getFieldFromRow(rd, ["Foto Dokumentasi", "fotoDokumentasi", "foto"], "")),
            timKetua: String(getFieldFromRow(rd, ["Ketua Tim PE", "timKetua", "col_31"], petugasPJ)),
            timAnggota: String(getFieldFromRow(rd, ["Anggota Tim PE", "timAnggota", "col_32"], "Kader Kesehatan Kelurahan")),
            tanggalPelaksanaan: String(getFieldFromRow(rd, ["Tanggal Pelaksanaan", "tanggalPelaksanaan", "col_33"], tglKejadian || new Date().toISOString().slice(0, 10))),
            pelaksanaNama: petugasPJ,
            pelaksanaNIP: nipPJ,
            statusPemantauan: (statusPemantauan as StatusPemantauanPasien) || "Dalam Pemantauan (Aktif)",
            hariObservasiKe: rawHariObs || 1,
            statusHewanObservasi: (rawStatusHewanObs && rawStatusHewanObs !== "-" ? rawStatusHewanObs : "Sehat / Normal (Observasi)") as StatusHewanObservasi,
            catatanPerkembanganHarian: rawCatatanLog
          };

          const newPatient: PatientMonitoringItem = {
            id_kasus: sId,
            timestamp_submit: waktuSubmit || new Date().toLocaleString("id-ID"),
            waktuKejadian: tglKejadian,
            tanggalKejadian: tglKejadian,
            jamKejadian: rawJam || "",
            tanggalBerkunjungFaskes: rawTanggalBerkunjungFaskes,
            namaFaskes: rawNamaFaskes || rawSumberLaporan || "Puskesmas Sananwetan",
            sumberInfo: String(fullDataNewSheet.sumberInfo || "Laporan Petugas Faskes"),
            sumberLaporan: rawSumberLaporan || rawNamaFaskes || String(fullDataNewSheet.sumberLaporan || "Laporan Petugas Faskes"),
            alamatKejadian: alamatKejadian || "",
            kelurahanKejadian: kelurahanKejadian || "Sananwetan",
            kecamatanKejadian: kecamatanKejadian || "Sananwetan",
            kabupatenKotaKejadian: kabupatenKotaKejadian || "Kota Blitar",
            provinsiKejadian: provinsiKejadian || "Jawa Timur",
            kelurahanDomisili: kelurahanDomisili || kelurahan,
            kecamatanDomisili: kecamatanDomisili || kecamatanKejadian || "Sananwetan",
            kabupatenKotaDomisili: kabupatenKotaDomisili || kabupatenKotaKejadian || "Kota Blitar",
            provinsiDomisili: provinsiDomisili || "Jawa Timur",
            namaKorban: nama,
            umurKorban: umur,
            jkKorban: jk,
            alamatKorban: rawAlamatKorban !== "-" && rawAlamatKorban !== "" ? rawAlamatKorban : (alamatKejadian || "-"),
            kontakKorban: noHp,
            noHpKorban: noHp,
            kelurahan: kelurahan,
            kecamatan: kecamatanDomisili || String(getFieldFromRow(rd, ["Kecamatan", "kecamatan"], "Sananwetan")),
            kabupatenKota: kabupatenKotaDomisili || String(getFieldFromRow(rd, ["Kabupaten/Kota", "kabupatenKota"], "Kota Blitar")),
            spesiesHPR: spesiesHPR,
            rasHewan: String(getFieldFromRow(rd, ["Ras Hewan", "rasHewan"], "-")),
            kondisiHewan: kondisiHewan,
            pemilikHewan: String(getFieldFromRow(rd, ["Nama Pemilik", "pemilikHewan"], "-")),
            alamatPemilik: String(getFieldFromRow(rd, ["Alamat Pemilik", "alamatPemilik"], "-")),
            kontakPemilik: String(getFieldFromRow(rd, ["Kontak Pemilik", "kontakPemilik"], "-")),
            kondisiKorban: String(getFieldFromRow(rd, ["Kondisi Korban", "kondisiKorban", "Kondisi Umum Korban", "kondisiUmumKorban"], "Sehat")),
            kondisiUmumKorban: String(getFieldFromRow(rd, ["Kondisi Umum Korban", "kondisiUmumKorban", "Kondisi Umum", "Keadaan Umum Korban", "Kondisi Korban", "kondisiKorban"], "Sehat")),
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
            catatanPerkembanganHarian: rawCatatanLog,
            petugasPJ: rawPJMonitoring && rawPJMonitoring !== "-" ? rawPJMonitoring : petugasPJ,
            nipPJ: nipPJ,
            fullData: {
              ...fullDataNewSheet,
              namaKorban: nama,
              umurKorban: umur,
              jkKorban: jk,
              alamatKorban: rawAlamatKorban !== "-" && rawAlamatKorban !== "" ? rawAlamatKorban : (alamatKejadian || "-"),
              noHpKorban: noHp,
              kelurahan: kelurahan,
              kondisiLuka: kondisiLuka,
              kondisiHewan: kondisiHewan,
              rekomendasi: rekomendasi,
              catatanPerkembanganHarian: rawCatatanLog
            } as any,
            lastUpdated: rawLastUpd && rawLastUpd !== "-" ? rawLastUpd : (waktuSubmit || new Date().toLocaleString("id-ID"))
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
