import { FormGHPRData, SubmissionPayload } from "../types";
import { getSheetId, getWebAppUrl } from "./config";

export const DEFAULT_SPREADSHEET_ID = getSheetId();
export const DEFAULT_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`;
export const DEFAULT_SPREADSHEET_TITLE = "Laporan PE GHPR - UPT Puskesmas Sananwetan";
export const DEFAULT_WEB_APP_URL = getWebAppUrl();

export interface ConnectedSheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  createdAt: string;
  sheetName: string;
  totalRecorded: number;
}

const STORAGE_KEY_SHEET_CONFIG = "ghpr_google_sheet_config_v1";

export function getSavedSheetConfig(): ConnectedSheetConfig | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_SHEET_CONFIG);
    if (data) {
      const parsed = JSON.parse(data);
      if (
        parsed &&
        parsed.spreadsheetId &&
        !parsed.spreadsheetId.includes("script.google.com")
      ) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Gagal membaca Google Sheet config dari localStorage:", err);
  }

  // Default connected spreadsheet requested by user
  const defaultConfig: ConnectedSheetConfig = {
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    spreadsheetUrl: DEFAULT_SPREADSHEET_URL,
    spreadsheetTitle: DEFAULT_SPREADSHEET_TITLE,
    createdAt: "14/08/2026",
    sheetName: "Data Laporan GHPR",
    totalRecorded: 0
  };
  
  saveSheetConfig(defaultConfig);
  return defaultConfig;
}

export function saveSheetConfig(config: ConnectedSheetConfig | null): void {
  try {
    if (config) {
      localStorage.setItem(STORAGE_KEY_SHEET_CONFIG, JSON.stringify(config));
    } else {
      localStorage.removeItem(STORAGE_KEY_SHEET_CONFIG);
    }
  } catch (err) {
    console.warn("Gagal menyimpan Google Sheet config:", err);
  }
}

export const LOCAL_CASES_HISTORY_KEY = "ghpr_submitted_cases_history_v1";

export interface StoredCaseItem {
  id_kasus: string;
  timestamp_submit: string;
  waktuKejadian: string;
  namaKorban: string;
  umurKorban: string;
  alamatKejadian: string;
  kelurahan: string;
  kecamatan: string;
  spesiesHPR: string;
  kondisiLuka: string;
  pelaksanaNama: string;
  fullData: SubmissionPayload | FormGHPRData;
  lastUpdated?: string;
}

export function getLocalSubmissionHistory(): StoredCaseItem[] {
  try {
    const data = localStorage.getItem(LOCAL_CASES_HISTORY_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Gagal membaca riwayat lokal:", e);
  }
  return [];
}

export function saveCaseToLocalHistory(payload: SubmissionPayload | Record<string, any>): void {
  try {
    const history = getLocalSubmissionHistory();
    const id = payload.id_kasus || `GHPR-${Date.now()}`;
    const newItem: StoredCaseItem = {
      id_kasus: id,
      timestamp_submit: payload.timestamp_submit || new Date().toLocaleString("id-ID"),
      waktuKejadian: payload.waktuKejadian || "-",
      namaKorban: payload.namaKorban || "Tanpa Nama",
      umurKorban: payload.umurKorban ? `${payload.umurKorban} Th` : "-",
      alamatKejadian: payload.alamatKejadian || "-",
      kelurahan: payload.kelurahan_final || payload.kelurahan || "-",
      kecamatan: payload.kecamatan_final || payload.kecamatan || "-",
      spesiesHPR: payload.spesies_final || payload.spesiesHPR || "-",
      kondisiLuka: payload.kondisiLuka || "-",
      pelaksanaNama: payload.pelaksanaNama || "-",
      fullData: payload as any,
      lastUpdated: new Date().toLocaleString("id-ID")
    };

    const existingIdx = history.findIndex((h) => h.id_kasus === id);
    if (existingIdx >= 0) {
      history[existingIdx] = newItem;
    } else {
      history.unshift(newItem);
    }

    // Batasi maksimum 100 kasus lokal
    const trimmed = history.slice(0, 100);
    localStorage.setItem(LOCAL_CASES_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("Gagal menyimpan ke riwayat lokal:", e);
  }
}

export function deleteCaseFromLocalHistory(idKasus: string): void {
  try {
    const history = getLocalSubmissionHistory();
    const filtered = history.filter((h) => h.id_kasus !== idKasus);
    localStorage.setItem(LOCAL_CASES_HISTORY_KEY, JSON.stringify(filtered));
  } catch (e) {}
}

export const SHEET_HEADERS = [
  "ID Kasus",
  "Waktu Submit",
  "Waktu Kejadian",
  "Alamat Kejadian",
  "Kelurahan",
  "Kecamatan",
  "Kabupaten/Kota",
  "Provinsi",
  "Sumber Informasi",
  "Kronologi Kejadian",
  "Spesies HPR",
  "Ras Hewan",
  "Jenis Kelamin Hewan",
  "Umur Hewan",
  "Metode Pemeliharaan",
  "Kondisi Hewan Saat Ini",
  "Riwayat Vaksinasi",
  "Tanggal Vaksinasi",
  "Nama Pemilik",
  "Alamat Pemilik",
  "Kontak Pemilik",
  "Nama Korban",
  "No HP Korban",
  "Umur Korban",
  "Alamat Korban",
  "Jenis Kelamin Korban",
  "Kondisi Luka",
  "Lokasi Luka",
  "Pertolongan Pertama",
  "Tindakan Kasus",
  "Rekomendasi",
  "Ketua Tim PE",
  "Anggota Tim PE",
  "Tanggal Pelaksanaan",
  "Pelaksana (Petugas)",
  "NIP Pelaksana"
];

export function mapPayloadToRowValues(payload: SubmissionPayload): (string | number)[] {
  const pAny = payload as any;
  const kel = payload.kelurahan_final || payload.kelurahan || "Sananwetan";
  const kec = payload.kecamatan_final || payload.kecamatan || "Sananwetan";
  const kab = payload.kabupatenKota_final || payload.kabupatenKota || "Kota Blitar";
  const spesies = payload.spesies_final || payload.spesiesHPR || "Anjing";
  const namaKorban = payload.namaKorban || pAny.namaPasien || "-";
  const noHpKorban = payload.noHpKorban || pAny.noHpPasien || pAny.kontakKorban || "-";
  const umurKorban = payload.umurKorban ? `${payload.umurKorban} Tahun` : "-";
  const umurHewan = payload.umurHewan ? `${payload.umurHewan} ${payload.satuanUmur || "Tahun"}`.trim() : "-";
  const waktuKejadian = payload.waktuKejadian || "-";
  const tglPelaksanaan = payload.tanggalPelaksanaan || new Date().toISOString().slice(0, 10);

  return [
    payload.id_kasus || "",
    payload.timestamp_submit || new Date().toISOString(),
    waktuKejadian,
    payload.alamatKejadian || "-",
    kel,
    kec,
    kab,
    payload.provinsi || "Jawa Timur",
    payload.sumberInfo || "-",
    payload.kronologi || "-",
    spesies,
    payload.ras || "-",
    payload.jkHewan || "-",
    umurHewan,
    payload.metodePelihara || "-",
    payload.kondisiHewan || "-",
    payload.riwayatVaksin || "-",
    payload.tanggalVaksin || "-",
    payload.pemilikHewan || "-",
    payload.alamatPemilik || "-",
    payload.kontakPemilik || "-",
    namaKorban,
    noHpKorban,
    umurKorban,
    payload.alamatKorban || "-",
    payload.jkKorban || "-",
    payload.kondisiLuka || "Kategori 1",
    payload.lokasiLuka || "-",
    payload.pertolonganPertama || "-",
    payload.tindakanKasus || "-",
    payload.rekomendasi || "-",
    payload.timKetua || "-",
    payload.timAnggota || "-",
    tglPelaksanaan,
    payload.pelaksanaNama || "-",
    payload.pelaksanaNIP || "-"
  ];
}

/**
 * Creates a brand new Google Spreadsheet using Google Sheets REST API
 */
export async function createNewGoogleSpreadsheet(
  title: string,
  accessToken: string
): Promise<ConnectedSheetConfig> {
  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: {
        title: title || "Laporan PE GHPR - UPT Puskesmas Sananwetan"
      },
      sheets: [
        {
          properties: {
            title: "Data Laporan GHPR",
            gridProperties: {
              frozenRowCount: 1
            }
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: SHEET_HEADERS.map((h) => ({
                    userEnteredValue: { stringValue: h },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      backgroundColorStyle: {
                        rgbColor: { red: 0.08, green: 0.45, blue: 0.35 }
                      }
                    }
                  }))
                }
              ]
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Gagal membuat Google Sheet (${response.status} ${response.statusText})`
    );
  }

  const resJson = await response.json();
  const spreadsheetId = resJson.spreadsheetId;
  const spreadsheetUrl = resJson.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const config: ConnectedSheetConfig = {
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetTitle: title,
    createdAt: new Date().toLocaleString("id-ID"),
    sheetName: "Data Laporan GHPR",
    totalRecorded: 0
  };

  saveSheetConfig(config);
  return config;
}

/**
 * Appends a row directly to connected Google Spreadsheet via Google Sheets API
 */
export async function appendRowToGoogleSheet(
  spreadsheetId: string,
  sheetName: string,
  rowValues: (string | number)[],
  accessToken: string
): Promise<boolean> {
  const range = `${sheetName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values: [rowValues]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Gagal menyimpan baris data ke Google Sheets (${response.status})`
    );
  }

  return true;
}

/**
 * Helper Apps Script Code generator for manual deployment
 */
export function getAppsScriptTemplateCode(): string {
  return `// ============================================================================
// GOOGLE APPS SCRIPT: SISTEM PE GHPR UPT PUSKESMAS SANANWETAN
// OTOMATIS TERIKAT KE SPREADSHEET AKTIF & TAB 'Data_Petugas' + 'Data Laporan GHPR'
// ============================================================================

// ID SPREADSHEET TARGET (Opsional, otomatis menggunakan spreadsheet aktif)
var TARGET_SPREADSHEET_ID = "";

// Helper untuk mendapatkan objek Spreadsheet yang sedang aktif
function getTargetSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch(e) {}
  if (TARGET_SPREADSHEET_ID && TARGET_SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(TARGET_SPREADSHEET_ID.trim());
    } catch(e2) {}
  }
  return null;
}

// 1. DAFTAR 36 HEADER RESMI SPREADSHEET PUSKESMAS SANANWETAN
var OFFICIAL_HEADERS = [
  "ID Kasus",
  "Waktu Submit",
  "Waktu Kejadian",
  "Alamat Kejadian",
  "Kelurahan",
  "Kecamatan",
  "Kabupaten/Kota",
  "Provinsi",
  "Sumber Informasi",
  "Kronologi Kejadian",
  "Spesies HPR",
  "Ras Hewan",
  "Jenis Kelamin Hewan",
  "Umur Hewan",
  "Metode Pemeliharaan",
  "Kondisi Hewan Saat Ini",
  "Riwayat Vaksinasi",
  "Tanggal Vaksinasi",
  "Nama Pemilik",
  "Alamat Pemilik",
  "Kontak Pemilik",
  "Nama Korban",
  "No HP Korban",
  "Umur Korban",
  "Alamat Korban",
  "Jenis Kelamin Korban",
  "Kondisi Luka",
  "Lokasi Luka",
  "Pertolongan Pertama",
  "Tindakan Kasus",
  "Rekomendasi",
  "Ketua Tim PE",
  "Anggota Tim PE",
  "Tanggal Pelaksanaan",
  "Pelaksana (Petugas)",
  "NIP Pelaksana"
];

// 2. KAMUS PEMETAAN DINAMIS (Mencocokkan nama kolom di Sheet ke field JSON)
var FIELD_MAP = {
  "id kasus": "id_kasus",
  "id_kasus": "id_kasus",
  "id": "id_kasus",
  "no": "id_kasus",
  "nomor": "id_kasus",
  "no kasus": "id_kasus",
  "kode kasus": "id_kasus",
  "waktu submit": "timestamp_submit",
  "timestamp_submit": "timestamp_submit",
  "timestamp": "timestamp_submit",
  "waktu kirim": "timestamp_submit",
  "waktu kejadian": "waktuKejadian",
  "waktukejadian": "waktuKejadian",
  "tanggal kejadian": "waktuKejadian",
  "tgl kejadian": "waktuKejadian",
  "tanggal gigitan": "waktuKejadian",
  "waktu gigitan": "waktuKejadian",
  "alamat kejadian": "alamatKejadian",
  "alamatkejadian": "alamatKejadian",
  "lokasi kejadian": "alamatKejadian",
  "tempat kejadian": "alamatKejadian",
  "kelurahan": "kelurahan_final",
  "desa/kelurahan": "kelurahan_final",
  "desa / kelurahan": "kelurahan_final",
  "kelurahan/desa": "kelurahan_final",
  "desa": "kelurahan_final",
  "wilayah": "kelurahan_final",
  "kelurahan_final": "kelurahan_final",
  "kecamatan": "kecamatan_final",
  "kecamatan_final": "kecamatan_final",
  "kabupaten/kota": "kabupatenKota_final",
  "kabupaten kota": "kabupatenKota_final",
  "kab / kota": "kabupatenKota_final",
  "kota/kabupaten": "kabupatenKota_final",
  "kota": "kabupatenKota_final",
  "kabupaten": "kabupatenKota_final",
  "kabupatenkota_final": "kabupatenKota_final",
  "provinsi": "provinsi",
  "sumber informasi": "sumberInfo",
  "sumber info": "sumberInfo",
  "sumber laporan": "sumberInfo",
  "sumberlaporan": "sumberInfo",
  "sumberinfo": "sumberInfo",
  "kronologi kejadian": "kronologi",
  "kronologi": "kronologi",
  "kronologis": "kronologi",
  "uraian kejadian": "kronologi",
  "spesies hpr": "spesies_final",
  "spesieshpr": "spesies_final",
  "spesies_final": "spesies_final",
  "spesies": "spesies_final",
  "jenis hewan": "spesies_final",
  "hewan": "spesies_final",
  "hewan penggigit": "spesies_final",
  "ras hewan": "ras",
  "ras": "ras",
  "jenis kelamin hewan": "jkHewan",
  "jk hewan": "jkHewan",
  "jkhewan": "jkHewan",
  "kelamin hewan": "jkHewan",
  "umur hewan": "umurHewan_formatted",
  "umurhewan": "umurHewan_formatted",
  "usia hewan": "umurHewan_formatted",
  "metode pemeliharaan": "metodePelihara",
  "metodepelihara": "metodePelihara",
  "pemeliharaan": "metodePelihara",
  "cara pemeliharaan": "metodePelihara",
  "asalhewan": "asalHewan",
  "asal hewan": "asalHewan",
  "pakan": "pakan",
  "biosekuriti": "biosekuriti",
  "sumberair": "sumberAir",
  "sumber air": "sumberAir",
  "kondisi hewan saat ini": "kondisiHewan",
  "kondisi hewan": "kondisiHewan",
  "kondisihewan": "kondisiHewan",
  "keadaan hewan": "kondisiHewan",
  "status hewan": "kondisiHewan",
  "riwayat vaksinasi": "riwayatVaksin",
  "riwayat vaksin": "riwayatVaksin",
  "riwayatvaksin": "riwayatVaksin",
  "vaksinasi": "riwayatVaksin",
  "tanggal vaksinasi": "tanggalVaksin",
  "tanggal vaksin": "tanggalVaksin",
  "tanggalvaksin": "tanggalVaksin",
  "tgl vaksinasi": "tanggalVaksin",
  "nama pemilik": "pemilikHewan",
  "nama pemilik hewan": "pemilikHewan",
  "pemilik hewan": "pemilikHewan",
  "pemilikhewan": "pemilikHewan",
  "pemilik": "pemilikHewan",
  "alamat pemilik": "alamatPemilik",
  "alamatpemilik": "alamatPemilik",
  "kontak pemilik": "kontakPemilik",
  "kontakpemilik": "kontakPemilik",
  "no hp pemilik": "kontakPemilik",
  "telepon pemilik": "kontakPemilik",
  "nama korban": "namaKorban",
  "namakorban": "namaKorban",
  "nama pasien": "namaKorban",
  "namapasien": "namaKorban",
  "nama lengkap": "namaKorban",
  "nama lengkap korban": "namaKorban",
  "nama lengkap pasien": "namaKorban",
  "nama penderita": "namaKorban",
  "korban": "namaKorban",
  "pasien": "namaKorban",
  "no hp korban": "noHpKorban",
  "nohpkorban": "noHpKorban",
  "hp korban": "noHpKorban",
  "no hp pasien": "noHpKorban",
  "nohppasien": "noHpKorban",
  "hp pasien": "noHpKorban",
  "kontak korban": "noHpKorban",
  "kontakkorban": "noHpKorban",
  "kontak pasien": "noHpKorban",
  "telepon korban": "noHpKorban",
  "telepon pasien": "noHpKorban",
  "nomor hp korban": "noHpKorban",
  "nomor hp pasien": "noHpKorban",
  "no telp": "noHpKorban",
  "no wa": "noHpKorban",
  "umur korban": "umurKorban_formatted",
  "umurkorban": "umurKorban_formatted",
  "usia korban": "umurKorban_formatted",
  "umur pasien": "umurKorban_formatted",
  "umurpasien": "umurKorban_formatted",
  "usia pasien": "umurKorban_formatted",
  "umur": "umurKorban_formatted",
  "usia": "umurKorban_formatted",
  "alamat korban": "alamatKorban",
  "alamatkorban": "alamatKorban",
  "alamat pasien": "alamatKorban",
  "alamatpasien": "alamatKorban",
  "alamat penderita": "alamatKorban",
  "alamat": "alamatKorban",
  "jenis kelamin korban": "jkKorban",
  "jkkorban": "jkKorban",
  "jk korban": "jkKorban",
  "jenis kelamin pasien": "jkKorban",
  "jk pasien": "jkKorban",
  "kelamin korban": "jkKorban",
  "kelamin pasien": "jkKorban",
  "jenis kelamin": "jkKorban",
  "kondisi korban": "kondisiKorban",
  "kondisi luka": "kondisiLuka",
  "kondisiluka": "kondisiLuka",
  "kondisi luka korban": "kondisiLuka",
  "kondisi luka saat ini": "kondisiLuka",
  "kategori luka": "kondisiLuka",
  "derajat luka": "kondisiLuka",
  "tingkat luka": "kondisiLuka",
  "keadaan luka": "kondisiLuka",
  "luka": "kondisiLuka",
  "lokasi luka": "lokasiLuka",
  "lokasiluka": "lokasiLuka",
  "bagian tubuh digigit": "lokasiLuka",
  "bagian tubuh": "lokasiLuka",
  "letak luka": "lokasiLuka",
  "area luka": "lokasiLuka",
  "pertolongan pertama": "pertolonganPertama",
  "pertolonganpertama": "pertolonganPertama",
  "tindakan pertolongan": "pertolonganPertama",
  "cuci luka": "pertolonganPertama",
  "pencucian luka": "pertolonganPertama",
  "p3k": "pertolonganPertama",
  "detail pertolongan": "detailPertolongan",
  "detailpertolongan": "detailPertolongan",
  "tindakan kasus": "tindakanKasus",
  "tindakankasus": "tindakanKasus",
  "tindakan terhadap kasus": "tindakanKasus",
  "tindakan terhadap korban": "tindakanKasus",
  "tindakan korban": "tindakanKasus",
  "tindakan pasien": "tindakanKasus",
  "tindakan medis": "tindakanKasus",
  "pemberian var": "tindakanKasus",
  "tindakan": "tindakanKasus",
  "tindakan terhadap hpr": "tindakanHPR",
  "tindakan hpr": "tindakanHPR",
  "tindakanhpr": "tindakanHPR",
  "observasi hpr": "tindakanHPR",
  "tindakan masyarakat": "tindakanMasyarakat",
  "tindakanmasyarakat": "tindakanMasyarakat",
  "rekomendasi": "rekomendasi",
  "rekomendasi / tindak lanjut": "rekomendasi",
  "rekomendasi tindak lanjut": "rekomendasi",
  "tindak lanjut": "rekomendasi",
  "rencana tindak lanjut": "rekomendasi",
  "fotodokumentasi": "fotoDokumentasi",
  "ketua tim pe": "timKetua",
  "ketua tim": "timKetua",
  "timketua": "timKetua",
  "anggota tim pe": "timAnggota",
  "anggota tim": "timAnggota",
  "timanggota": "timAnggota",
  "tim pe": "timAnggota",
  "tanggal pelaksanaan": "tanggalPelaksanaan",
  "tanggalpelaksanaan": "tanggalPelaksanaan",
  "tanggal pelaksanaan pe": "tanggalPelaksanaan",
  "tgl pelaksanaan": "tanggalPelaksanaan",
  "tanggal pe": "tanggalPelaksanaan",
  "pelaksana (petugas)": "pelaksanaNama",
  "pelaksanama": "pelaksanaNama",
  "pelaksana nama": "pelaksanaNama",
  "pelaksana lapangan": "pelaksanaNama",
  "pelaksana": "pelaksanaNama",
  "petugas": "pelaksanaNama",
  "nama petugas": "pelaksanaNama",
  "petugas pe": "pelaksanaNama",
  "petugas pj": "pelaksanaNama",
  "nip pelaksana": "pelaksanaNIP",
  "pelaksananip": "pelaksanaNIP",
  "nip": "pelaksanaNIP",
  "nip petugas": "pelaksanaNIP",
  "tandatanganurl": "tandaTanganUrl",
  "tandatanganotomatis": "tandaTanganOtomatis",
  "jenistandatangan": "jenisTandaTangan"
};

// 3. FUNGSI UJI COBA LANGSUNG (Pilih 'testSimpanData' lalu klik 'Jalankan')
function testSimpanData() {
  var dummyData = {
    id_kasus: "GHPR-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd") + "-TEST",
    timestamp_submit: Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss"),
    waktuKejadian: "2026-08-14 10:00",
    alamatKejadian: "Jl. Sudanco Supriyadi No. 22",
    kelurahan: "Sananwetan",
    kecamatan: "Sananwetan",
    kabupatenKota: "Kota Blitar",
    provinsi: "Jawa Timur",
    sumberInfo: "Masyarakat / Korban Langsung",
    kronologi: "Korban digigit saat melintas di jalan depan rumah pemilik hewan.",
    spesiesHPR: "Anjing",
    ras: "Lokal",
    jkHewan: "Jantan",
    umurHewan: "2",
    satuanUmur: "Tahun",
    metodePelihara: "Deliarkan",
    kondisiHewan: "Sehat / Normal (Dalam Observasi)",
    riwayatVaksin: "Sudah Pernah",
    tanggalVaksin: "2026-01-10",
    pemilikHewan: "Bpk. Santoso",
    alamatPemilik: "Jl. Sananwetan RT 02 RW 03",
    kontakPemilik: "081234567890",
    namaKorban: "Siti Rahayu",
    noHpKorban: "081234567890",
    umurKorban: "28",
    jkKorban: "Perempuan",
    alamatKorban: "Jl. Diponegoro No. 15 Kota Blitar",
    kondisiLuka: "Kategori 2",
    lokasiLuka: "Betis Kaki Kiri",
    pertolonganPertama: "Cuci luka dengan sabun di air mengalir 15 menit + Povidone Iodine",
    detailPertolongan: "Diberikan VAR dosis 1 di UPT Puskesmas Sananwetan",
    tindakanKasus: "Diberikan VAR / SAR & Terapi Antibiotik Profilaksis",
    tindakanHPR: "Karantina / Observasi 14 Hari oleh Pemilik",
    tindakanMasyarakat: "Edukasi & Penyuluhan Bahaya Rabies",
    rekomendasi: "Pantau kondisi hewan hingga hari ke-14 dan jadwalkan VAR dosis ke-2 korban.",
    timKetua: "dr. Triana Sulistyaningsih",
    timAnggota: "Petugas Surveilans & Promkes",
    tanggalPelaksanaan: "2026-08-14",
    pelaksanaNama: "Widodo, S.Kep., Ns.",
    pelaksanaNIP: "198501012010011001"
  };

  var res = prosesDataMasuk(dummyData);
  Logger.log("Hasil Simpan: " + JSON.stringify(res));
  return res;
}

// 4. ENDPOINT GET (Hanya untuk pengecekan status atau membaca data - TIDAK MENULIS DATA)
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
  if (action === "read" || action === "search" || action === "list") {
    var query = (e && e.parameter && e.parameter.q) ? e.parameter.q.toLowerCase() : "";
    var readRes = bacaDaftarLaporan(query);
    return ContentService.createTextOutput(JSON.stringify(readRes)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getAccounts" || action === "readAccounts" || action === "petugas") {
    var accountsRes = bacaDaftarPetugas();
    return ContentService.createTextOutput(JSON.stringify(accountsRes)).setMimeType(ContentService.MimeType.JSON);
  }

  // Standar: Hanya kembalikan status sistem tanpa mengubah/menambah isi Spreadsheet
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Puskesmas Sananwetan GHPR Recorder v2.0 (Strict Read/Update/Insert via POST)",
    waktu: new Date().toString(),
    sheet_terhubung: TARGET_SPREADSHEET_ID,
    info: "Endpoint siap menerima data dari aplikasi"
  })).setMimeType(ContentService.MimeType.JSON);
}

// 5. ENDPOINT POST (Menerima kiriman form aplikasi / update)
function doPost(e) {
  var data = {};
  
  if (e && e.postData && e.postData.contents) {
    var rawText = e.postData.contents;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      try {
        data = JSON.parse(decodeURIComponent(rawText));
      } catch (err2) {
        data = e.parameter || {};
      }
    }
  } else if (e && e.parameter && Object.keys(e.parameter).length > 0) {
    data = e.parameter;
  }

  // Jika payload terbungkus di dalam properti 'payload' atau 'data'
  if (data && data.payload) {
    try {
      data = (typeof data.payload === "string") ? JSON.parse(data.payload) : data.payload;
    } catch(ePayload) {}
  }
  if (data && data.data) {
    try {
      data = (typeof data.data === "string") ? JSON.parse(data.data) : data.data;
    } catch(eData) {}
  }

  var action = (data && data.action) ? data.action : (e && e.parameter && e.parameter.action ? e.parameter.action : "save");

  if (action === "read" || action === "search") {
    var q = (data && data.q) ? String(data.q).toLowerCase() : "";
    var readResPost = bacaDaftarLaporan(q);
    return ContentService.createTextOutput(JSON.stringify(readResPost)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getAccounts" || action === "readAccounts") {
    var accountsResPost = bacaDaftarPetugas();
    return ContentService.createTextOutput(JSON.stringify(accountsResPost)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "saveAccounts" || action === "syncAccounts" || action === "updateAccounts") {
    var saveAccRes = simpanDaftarPetugas(data.accounts || data.petugas || data);
    return ContentService.createTextOutput(JSON.stringify(saveAccRes)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "saveAllPatients" || action === "syncAllPatients" || action === "bulkPatients") {
    var bulkPatRes = simpanSemuaPasien(data.patients || data.cases || data.data || data);
    return ContentService.createTextOutput(JSON.stringify(bulkPatRes)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "repairSheet" || action === "fixHeaders" || action === "formatSheet" || action === "autoFix") {
    var repairRes = rapikanDanFormatSheet();
    return ContentService.createTextOutput(JSON.stringify(repairRes)).setMimeType(ContentService.MimeType.JSON);
  }

  var hasil = prosesDataMasuk(data, action);
  return ContentService.createTextOutput(JSON.stringify(hasil)).setMimeType(ContentService.MimeType.JSON);
}

// FUNGSI PERBAIKAN STRUKTUR SPREADSHEET & PEMULIHAN DATA BERGESER SECARA OTOMATIS
function rapikanDanFormatSheet() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { return { status: "error", message: "Server sibuk" }; }
  try {
    var ss = getTargetSpreadsheet();
    if (!ss) return { status: "error", message: "Spreadsheet tidak ditemukan" };
    var sheet = ss.getSheetByName("Data Laporan GHPR") || ss.getSheetByName("Laporan PE GHPR") || ss.getSheets()[0];
    
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var existingRows = [];
    if (lastRow > 1) {
      existingRows = sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, 1)).getValues();
    }
    
    // Normalisasi setiap baris data yang ada
    var cleanedRows = [];
    for (var r = 0; r < existingRows.length; r++) {
      var row = existingRows[r];
      var obj = {};
      
      var colA = String(row[0] || "").trim();
      var colB = String(row[1] || "").trim();
      var colC = String(row[2] || "").trim();
      var colD = String(row[3] || "").trim();
      var colE = String(row[4] || "").trim();
      var colF = String(row[5] || "").trim();
      var colG = String(row[6] || "").trim();
      var colH = String(row[7] || "").trim();
      var colI = String(row[8] || "").trim();
      var colJ = String(row[9] || "").trim();
      
      // Deteksi jika baris ini format bergeser (Kolom A adalah timestamp tanggal dan Kolom B adalah ID Kasus)
      var isShifted = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(colA) && /^(GHPR|TEST|ID|KASUS)/i.test(colB);
      
      if (isShifted) {
        obj.id_kasus = colB;
        obj.timestamp_submit = colA;
        obj.waktuKejadian = colA;
        obj.alamatKejadian = colG || "-";
        obj.kelurahan_final = colI || "Sananwetan";
        obj.kecamatan_final = "Sananwetan";
        obj.kabupatenKota_final = "Kota Blitar";
        obj.provinsi = "Jawa Timur";
        obj.sumberInfo = "Laporan Masyarakat";
        obj.kronologi = "-";
        obj.spesies_final = colJ || "Kucing";
        obj.ras = "-";
        obj.jkHewan = "-";
        obj.umurHewan = "-";
        obj.metodePelihara = "-";
        obj.kondisiHewan = "Hidup / Observasi";
        obj.riwayatVaksin = "-";
        obj.tanggalVaksin = "-";
        obj.pemilikHewan = "-";
        obj.alamatPemilik = colG || "-";
        obj.kontakPemilik = colH || "-";
        obj.namaKorban = colC;
        obj.noHpKorban = colH;
        obj.umurKorban = colE ? (colE + " Tahun") : "-";
        obj.alamatKorban = colG;
        obj.jkKorban = colF;
        obj.kondisiLuka = "Kategori 1";
        obj.lokasiLuka = "-";
        obj.pertolonganPertama = "Cuci luka sabun air mengalir";
        obj.tindakanKasus = "Observasi luka & edukasi";
        obj.rekomendasi = "Pantau kondisi luka dan hewan";
        obj.timKetua = "dr. Triana Sulistyaningsih";
        obj.timAnggota = "Petugas Surveilans";
        obj.tanggalPelaksanaan = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
        obj.pelaksanaNama = "Petugas Puskesmas";
        obj.pelaksanaNIP = "-";
      } else {
        obj.id_kasus = colA || ("GHPR-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd-") + (r + 1));
        obj.timestamp_submit = colB || Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
        obj.waktuKejadian = colC || "-";
        obj.alamatKejadian = colD || "-";
        obj.kelurahan_final = String(row[4] || row[5] || "Sananwetan");
        obj.kecamatan_final = String(row[6] || "Sananwetan");
        obj.kabupatenKota_final = String(row[7] || "Kota Blitar");
        obj.provinsi = String(row[8] || "Jawa Timur");
        obj.sumberInfo = String(row[9] || "-");
        obj.kronologi = String(row[10] || "-");
        obj.spesies_final = String(row[11] || "Anjing");
        obj.ras = String(row[12] || "-");
        obj.jkHewan = String(row[13] || "-");
        obj.umurHewan = String(row[14] || "-");
        obj.metodePelihara = String(row[15] || "-");
        obj.kondisiHewan = String(row[16] || "-");
        obj.riwayatVaksin = String(row[17] || "-");
        obj.tanggalVaksin = String(row[18] || "-");
        obj.pemilikHewan = String(row[19] || "-");
        obj.alamatPemilik = String(row[20] || "-");
        obj.kontakPemilik = String(row[21] || "-");
        obj.namaKorban = String(row[22] || colC || "-");
        obj.noHpKorban = String(row[23] || colH || "-");
        obj.umurKorban = String(row[24] || colE || "-");
        obj.alamatKorban = String(row[25] || colG || "-");
        obj.jkKorban = String(row[26] || colF || "-");
        obj.kondisiLuka = String(row[27] || "Kategori 1");
        obj.lokasiLuka = String(row[28] || "-");
        obj.pertolonganPertama = String(row[29] || "-");
        obj.tindakanKasus = String(row[30] || "-");
        obj.rekomendasi = String(row[31] || "-");
        obj.timKetua = String(row[32] || "-");
        obj.timAnggota = String(row[33] || "-");
        obj.tanggalPelaksanaan = String(row[34] || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd"));
        obj.pelaksanaNama = String(row[35] || "-");
        obj.pelaksanaNIP = String(row[36] || "-");
      }
      
      var row36 = [
        obj.id_kasus || "-",
        obj.timestamp_submit || "-",
        obj.waktuKejadian || "-",
        obj.alamatKejadian || "-",
        obj.kelurahan_final || "Sananwetan",
        obj.kecamatan_final || "Sananwetan",
        obj.kabupatenKota_final || "Kota Blitar",
        obj.provinsi || "Jawa Timur",
        obj.sumberInfo || "-",
        obj.kronologi || "-",
        obj.spesies_final || "Anjing",
        obj.ras || "-",
        obj.jkHewan || "-",
        obj.umurHewan || "-",
        obj.metodePelihara || "-",
        obj.kondisiHewan || "-",
        obj.riwayatVaksin || "-",
        obj.tanggalVaksin || "-",
        obj.pemilikHewan || "-",
        obj.alamatPemilik || "-",
        obj.kontakPemilik || "-",
        obj.namaKorban || "-",
        obj.noHpKorban || "-",
        obj.umurKorban || "-",
        obj.alamatKorban || "-",
        obj.jkKorban || "-",
        obj.kondisiLuka || "Kategori 1",
        obj.lokasiLuka || "-",
        obj.pertolonganPertama || "-",
        obj.tindakanKasus || "-",
        obj.rekomendasi || "-",
        obj.timKetua || "-",
        obj.timAnggota || "-",
        obj.tanggalPelaksanaan || "-",
        obj.pelaksanaNama || "-",
        obj.pelaksanaNIP || "-"
      ];
      cleanedRows.push(row36);
    }
    
    // Hapus sheet yang lama dan set ulang 36 Header Resmi yang bersih
    sheet.clear();
    sheet.appendRow(OFFICIAL_HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, OFFICIAL_HEADERS.length);
    headerRange.setBackground("#0F5132");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    headerRange.setWrap(true);
    sheet.setFrozenRows(1);
    
    if (cleanedRows.length > 0) {
      sheet.getRange(2, 1, cleanedRows.length, OFFICIAL_HEADERS.length).setValues(cleanedRows);
    }
    
    return {
      status: "success",
      message: "Struktur spreadsheet berhasil dirapikan! 36 kolom resmi telah distandarkan dan " + cleanedRows.length + " baris data telah diposisikan ke kolom yang tepat.",
      count: cleanedRows.length
    };
  } catch(err) {
    return { status: "error", message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// FUNGSI MEMBACA DAFTAR LAPORAN DARI SPREADSHEET
function bacaDaftarLaporan(query) {
  try {
    var ss = getTargetSpreadsheet();
    if (!ss) return { status: "error", message: "Spreadsheet tidak ditemukan", data: [] };

    var sheet = ss.getSheetByName("Data Laporan GHPR") || ss.getSheetByName("Laporan PE GHPR") || ss.getSheets()[0];
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow <= 1) return { status: "success", data: [], message: "Belum ada data laporan." };

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var startRow = 2;
    var numRows = lastRow - 1;
    var rows = sheet.getRange(startRow, 1, numRows, lastCol).getValues();

    var list = [];
    for (var r = rows.length - 1; r >= 0; r--) {
      var row = rows[r];
      var rowObj = {};
      for (var c = 0; c < headers.length; c++) {
        var hKey = String(headers[c] || "").trim();
        rowObj[hKey] = row[c];
      }
      var idVal = String(rowObj["id_kasus"] || rowObj["ID Kasus"] || rowObj["Id Kasus"] || rowObj["ID"] || row[0] || "");
      var namaKorban = String(rowObj["Nama Korban"] || rowObj["namaKorban"] || rowObj["Nama Pasien"] || rowObj["Nama Lengkap Korban"] || row[21] || row[27] || "");
      var tglSubmit = String(rowObj["Waktu Submit"] || rowObj["timestamp_submit"] || rowObj["Waktu Kejadian"] || row[1] || "");

      // Handle shifted row format jika row[0] adalah format tanggal dan row[1] adalah ID kasus
      if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(idVal) && /^(TEST|GHPR|ID|KASUS)/i.test(String(row[1] || ""))) {
        tglSubmit = idVal;
        idVal = String(row[1] || "");
        namaKorban = String(row[2] || namaKorban);
      }

      if (query && query !== "") {
        var fullText = (idVal + " " + namaKorban + " " + JSON.stringify(rowObj)).toLowerCase();
        if (fullText.indexOf(query) === -1) continue;
      }

      list.push({
        id_kasus: idVal,
        waktuSubmit: tglSubmit,
        namaKorban: namaKorban,
        baris_ke: startRow + r,
        rowData: rowObj
      });
    }

    return { status: "success", count: list.length, data: list };
  } catch(err) {
    return { status: "error", message: err.toString(), data: [] };
  }
}

// FUNGSI MEMBACA DAFTAR PETUGAS DARI SHEET 'Data_Petugas'
function bacaDaftarPetugas() {
  try {
    var ss = getTargetSpreadsheet();
    if (!ss) return { status: "error", message: "Spreadsheet tidak ditemukan", data: [] };

    var sheet = ss.getSheetByName("Data_Petugas");
    if (!sheet || sheet.getLastRow() <= 1) {
      return { status: "success", data: [], message: "Belum ada data petugas di sheet Data_Petugas." };
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    var accounts = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        var k = String(headers[c] || "").trim();
        obj[k] = row[c];
      }
      var uName = String(obj["username"] || obj["Username"] || "").trim();
      if (uName) {
        var isK = obj["isKoordinator"] === true || String(obj["isKoordinator"]).toLowerCase() === "true" || String(obj["isKoordinator"]) === "1";
        accounts.push({
          id: String(obj["id"] || ("user-" + uName)),
          nama: String(obj["nama"] || obj["Nama Petugas"] || ""),
          nip: String(obj["nip"] || obj["NIP"] || ""),
          jabatan: String(obj["jabatan"] || obj["Jabatan"] || ""),
          kelurahan: String(obj["kelurahan"] || obj["Wilayah Kelurahan"] || "Sananwetan"),
          role: String(obj["role"] || obj["Role / Hak Akses"] || "Petugas Wilayah"),
          username: uName,
          password: String(obj["password"] || obj["Password Hash"] || ""),
          email: String(obj["email"] || obj["Email"] || ""),
          isKoordinator: isK,
          canCreate: true,
          canUpdate: true,
          canDelete: isK
        });
      }
    }
    return { status: "success", count: accounts.length, data: accounts };
  } catch (err) {
    return { status: "error", message: err.toString(), data: [] };
  }
}

// FUNGSI MENYIMPAN DAFTAR PETUGAS KE SHEET 'Data_Petugas'
function simpanDaftarPetugas(rawAccounts) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(eLock) { return { status: "error", message: "Server sibuk" }; }
  try {
    var ss = getTargetSpreadsheet();
    if (!ss) return { status: "error", message: "Spreadsheet tidak ditemukan" };

    var sheet = ss.getSheetByName("Data_Petugas");
    if (!sheet) {
      sheet = ss.insertSheet("Data_Petugas");
    }

    var accounts = Array.isArray(rawAccounts) ? rawAccounts : (rawAccounts && rawAccounts.accounts ? rawAccounts.accounts : []);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return { status: "error", message: "Daftar akun kosong" };
    }

    sheet.clear();
    var headers = ["id", "username", "nama", "nip", "jabatan", "kelurahan", "role", "isKoordinator", "email", "password", "lastUpdated"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#0284c7").setFontColor("#ffffff").setFontWeight("bold");

    var rows = [];
    var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    for (var i = 0; i < accounts.length; i++) {
      var a = accounts[i];
      rows.push([
        String(a.id || ("user-" + a.username)),
        String(a.username || ""),
        String(a.nama || ""),
        String(a.nip || ""),
        String(a.jabatan || ""),
        String(a.kelurahan || "Sananwetan"),
        String(a.role || ""),
        a.isKoordinator ? "true" : "false",
        String(a.email || ""),
        String(a.password || ""),
        nowStr
      ]);
    }
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    return { status: "success", count: accounts.length, message: "Berhasil menyimpan " + accounts.length + " akun petugas ke Google Sheets." };
  } catch (err) {
    return { status: "error", message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// FUNGSI MENYIMPAN SELURUH DATA PASIEN KE SHEET 'Data Laporan GHPR'
function simpanSemuaPasien(rawPatients) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(eLock) { return { status: "error", message: "Server sibuk" }; }
  try {
    var ss = getTargetSpreadsheet();
    if (!ss) return { status: "error", message: "Spreadsheet tidak ditemukan" };

    var sheet = ss.getSheetByName("Data Laporan GHPR") || ss.getSheetByName("Laporan PE GHPR") || ss.getSheets()[0];
    if (!sheet) {
      sheet = ss.insertSheet("Data Laporan GHPR");
    }

    var patients = Array.isArray(rawPatients) ? rawPatients : (rawPatients && rawPatients.patients ? rawPatients.patients : []);
    if (!Array.isArray(patients)) patients = [];

    sheet.clear();
    sheet.appendRow(OFFICIAL_HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, OFFICIAL_HEADERS.length);
    headerRange.setBackground("#0F5132");
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    headerRange.setWrap(true);
    sheet.setFrozenRows(1);

    if (patients.length > 0) {
      for (var p = 0; p < patients.length; p++) {
        prosesDataMasuk(patients[p], "save");
      }
    }

    return { status: "success", count: patients.length, message: "Berhasil menyelaraskan " + patients.length + " data pasien ke Google Sheets." };
  } catch (err) {
    return { status: "error", message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

// 6. PROSES DAN TULIS / UPDATE DATA KE GOOGLE SPREADSHEET
function prosesDataMasuk(data, action) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (errLock) {
    return { status: "error", message: "Server sibuk, silakan coba lagi." };
  }

  try {
    var ss = getTargetSpreadsheet();
    if (!ss) {
      return {
        status: "error",
        message: "Spreadsheet tidak dapat dibuka. Pastikan Script dijalankan pada Spreadsheet yang benar dan memiliki hak akses edit."
      };
    }

    // 3. Cari sheet target: 'Data Laporan GHPR' atau sheet pertama yang tersedia
    var sheet = ss.getSheetByName("Data Laporan GHPR") || ss.getSheetByName("Laporan PE GHPR") || ss.getSheets()[0];
    if (!sheet) {
      sheet = ss.insertSheet("Data Laporan GHPR");
    }

    // JIKA ACTION === 'delete' : HAPUS BARIS DARI SPREADSHEET BERDASARKAN ID KASUS
    if (action === "delete" || (data && data.action === "delete")) {
      var targetDelId = String(data.id_kasus || data.id || "").trim();
      if (!targetDelId) {
        return {
          status: "error",
          message: "ID Kasus untuk penghapusan tidak ditemukan."
        };
      }
      var delRowIdx = -1;
      var totalRows = sheet.getLastRow();
      if (totalRows > 1) {
        var idMatrix = sheet.getRange(2, 1, totalRows - 1, 1).getValues();
        for (var i = 0; i < idMatrix.length; i++) {
          if (String(idMatrix[i][0] || "").trim() === targetDelId) {
            delRowIdx = i + 2;
            break;
          }
        }
      }
      if (delRowIdx > 0) {
        sheet.deleteRow(delRowIdx);
        return {
          status: "success",
          action_performed: "deleted",
          message: "Data laporan " + targetDelId + " berhasil DIHAPUS dari baris ke-" + delRowIdx,
          id_kasus: targetDelId,
          baris_ke: delRowIdx
        };
      } else {
        return {
          status: "not_found",
          message: "ID Kasus " + targetDelId + " tidak ditemukan di spreadsheet (mungkin sudah terhapus)."
        };
      }
    }

    // Normalisasi dan persiapkan data komputasi
    if (!data || typeof data !== "object") data = {};
    data.id_kasus = data.id_kasus || ("GHPR-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd-HHmmss"));
    data.timestamp_submit = data.timestamp_submit || Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
    data.kelurahan_final = data.kelurahan_final || data.kelurahanCustom || data.kelurahan || "Sananwetan";
    data.kecamatan_final = data.kecamatan_final || data.kecamatanCustom || data.kecamatan || "Sananwetan";
    data.kabupatenKota_final = data.kabupatenKota_final || data.kabupatenKotaCustom || data.kabupatenKota || "Kota Blitar";
    data.provinsi = data.provinsi || "Jawa Timur";
    data.spesies_final = data.spesies_final || (data.spesiesHPR === "Lainnya" ? data.spesiesLain : data.spesiesHPR) || data.spesiesHPR || "Anjing";
    data.umurHewan_formatted = data.umurHewan ? (data.umurHewan + " " + (data.satuanUmur || "Tahun")) : "-";
    data.umurKorban_formatted = data.umurKorban ? (data.umurKorban + " Tahun") : "-";

    // STANDARISASI OTOMATIS BARIS 1 HEADER (Menghapus kolom duplikat seperti kelurahan ganda)
    var numCols = Math.max(sheet.getLastColumn(), OFFICIAL_HEADERS.length);
    if (sheet.getMaxColumns() < OFFICIAL_HEADERS.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), OFFICIAL_HEADERS.length - sheet.getMaxColumns());
    }

    var existingHeaders = sheet.getLastRow() >= 1 ? sheet.getRange(1, 1, 1, Math.max(numCols, 1)).getValues()[0] : [];
    var isHeaderMismatched = false;

    if (existingHeaders.length < OFFICIAL_HEADERS.length) {
      isHeaderMismatched = true;
    } else {
      // Deteksi duplikasi header (misal 'kelurahan' di kolom E dan 'Kelurahan' di kolom F)
      var seenHeaderKeys = {};
      for (var chk = 0; chk < existingHeaders.length; chk++) {
        var hClean = String(existingHeaders[chk] || "").toLowerCase().trim();
        if (hClean) {
          if (seenHeaderKeys[hClean]) {
            isHeaderMismatched = true;
            break;
          }
          seenHeaderKeys[hClean] = true;
        }
      }
    }

    if (isHeaderMismatched || sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, OFFICIAL_HEADERS.length).setValues([OFFICIAL_HEADERS]);
      var headerRange = sheet.getRange(1, 1, 1, OFFICIAL_HEADERS.length);
      headerRange.setBackground("#0F5132"); // Hijau Puskesmas
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      headerRange.setWrap(true);
      sheet.setFrozenRows(1);
      existingHeaders = OFFICIAL_HEADERS.slice();
    }

    var newRow = [];

    // FUNGSI PEMETAAN KOLOM DETERMINISTIK (Mencegah salah kolom atau tertukar)
    function ambilNilaiKolomTepat(rawHeaderText, colIdx, d) {
      if (!d) return "-";
      var h = String(rawHeaderText || "").replace(/^\\s*\\d+[\\.\\)\\-]\\s*/, "").replace(/[:\\*]/g, "").toLowerCase().trim();
      
      // 1. Cek direct match dengan kamus FIELD_MAP
      var fieldKey = FIELD_MAP[h] || FIELD_MAP[String(rawHeaderText).toLowerCase().trim()];
      if (fieldKey && d[fieldKey] !== undefined && d[fieldKey] !== null && String(d[fieldKey]).trim() !== "") {
        return String(d[fieldKey]).trim();
      }
      
      // 2. Cek property langsung di objek payload
      if (d[rawHeaderText] !== undefined && d[rawHeaderText] !== null && String(d[rawHeaderText]).trim() !== "") {
        return String(d[rawHeaderText]).trim();
      }
      if (d[h] !== undefined && d[h] !== null && String(d[h]).trim() !== "") {
        return String(d[h]).trim();
      }

      // 3. Pencocokan Ketat & Spesifik Berdasarkan Nama Header Resmi
      if (h === "id kasus" || h === "id_kasus" || h === "no kasus" || h === "kode kasus" || (colIdx === 0 && (h === "id" || h === "no"))) {
        return d.id_kasus || "-";
      }
      if (h === "waktu submit" || h === "timestamp submit" || h === "timestamp" || h === "waktu kirim") {
        return d.timestamp_submit || "-";
      }
      if (h === "waktu kejadian" || h === "tanggal kejadian" || h === "tgl kejadian" || h === "waktu gigitan" || h === "tanggal gigitan") {
        return d.waktuKejadian || "-";
      }
      if (h === "alamat kejadian" || h === "lokasi kejadian" || h === "tempat kejadian" || h === "tkp") {
        return d.alamatKejadian || "-";
      }
      if (h === "kelurahan" || h === "desa" || h === "kelurahan/desa" || h === "desa/kelurahan" || h === "kelurahan kejadian") {
        return d.kelurahan_final || d.kelurahan || "Sananwetan";
      }
      if (h === "kecamatan" || h === "kecamatan kejadian") {
        return d.kecamatan_final || d.kecamatan || "Sananwetan";
      }
      if (h === "kabupaten/kota" || h === "kabupaten kota" || h === "kota/kabupaten" || h === "kabupaten" || h === "kota") {
        return d.kabupatenKota_final || d.kabupatenKota || "Kota Blitar";
      }
      if (h === "provinsi") {
        return d.provinsi || "Jawa Timur";
      }
      if (h === "sumber informasi" || h === "sumber info" || h === "sumber laporan" || h === "sumber") {
        return d.sumberInfo || d.sumberLaporan || "-";
      }
      if (h === "kronologi kejadian" || h === "kronologi" || h === "kronologis" || h === "uraian kejadian") {
        return d.kronologi || "-";
      }
      if (h === "spesies hpr" || h === "spesies" || h === "jenis hewan" || h === "hewan penggigit" || h === "hewan") {
        return d.spesies_final || d.spesiesHPR || "Anjing";
      }
      if (h === "ras hewan" || h === "ras") {
        return d.ras || "-";
      }
      if (h === "jenis kelamin hewan" || h === "jk hewan" || h === "kelamin hewan") {
        return d.jkHewan || "-";
      }
      if (h === "umur hewan" || h === "usia hewan") {
        return d.umurHewan_formatted || (d.umurHewan ? (d.umurHewan + " " + (d.satuanUmur || "Tahun")) : "-");
      }
      if (h === "metode pemeliharaan" || h === "cara pemeliharaan" || h === "pemeliharaan" || h === "metode pelihara") {
        return d.metodePelihara || "-";
      }
      if (h === "kondisi hewan saat ini" || h === "kondisi hewan" || h === "keadaan hewan" || h === "status hewan") {
        return d.kondisiHewan || "-";
      }
      if (h === "riwayat vaksinasi" || h === "riwayat vaksin" || h === "status vaksinasi") {
        return d.riwayatVaksin || "-";
      }
      if (h === "tanggal vaksinasi" || h === "tanggal vaksin" || h === "tgl vaksinasi") {
        return d.tanggalVaksin || "-";
      }
      if (h === "nama pemilik" || h === "nama pemilik hewan" || h === "pemilik hewan" || h === "pemilik") {
        return d.pemilikHewan || "-";
      }
      if (h === "alamat pemilik" || h === "alamat pemilik hewan") {
        return d.alamatPemilik || "-";
      }
      if (h === "kontak pemilik" || h === "no hp pemilik" || h === "telepon pemilik" || h === "hp pemilik") {
        return d.kontakPemilik || "-";
      }
      if (h === "nama korban" || h === "nama pasien" || h === "nama lengkap" || h === "nama lengkap korban" || h === "korban" || h === "pasien") {
        return d.namaKorban || d.namaPasien || "-";
      }
      if (h === "no hp korban" || h === "hp korban" || h === "kontak korban" || h === "no hp pasien" || h === "hp pasien" || h === "kontak pasien" || h === "telepon korban" || h === "nomor hp korban") {
        return d.noHpKorban || d.noHpPasien || d.kontakKorban || "-";
      }
      if (h === "umur korban" || h === "usia korban" || h === "umur pasien" || h === "usia pasien" || h === "umur") {
        return d.umurKorban_formatted || (d.umurKorban ? (d.umurKorban + " Tahun") : "-");
      }
      if (h === "alamat korban" || h === "alamat pasien" || h === "alamat domisili korban" || h === "alamat domisili" || h === "alamat") {
        return d.alamatKorban || d.alamatPasien || "-";
      }
      if (h === "jenis kelamin korban" || h === "jk korban" || h === "jenis kelamin pasien" || h === "jk pasien" || h === "kelamin korban" || h === "jenis kelamin") {
        return d.jkKorban || d.jkPasien || "-";
      }
      if (h === "kondisi luka" || h === "kondisi luka korban" || h === "kategori luka" || h === "derajat luka" || h === "luka") {
        return d.kondisiLuka || "Kategori 1";
      }
      if (h === "lokasi luka" || h === "letak luka" || h === "bagian tubuh digigit" || h === "bagian tubuh" || h === "area luka") {
        return d.lokasiLuka || "-";
      }
      if (h === "pertolongan pertama" || h === "cuci luka" || h === "pencucian luka" || h === "p3k") {
        return d.pertolonganPertama || d.detailPertolongan || "-";
      }
      if (h === "tindakan kasus" || h === "tindakan terhadap kasus" || h === "tindakan terhadap korban" || h === "tindakan korban" || h === "tindakan medis" || h === "pemberian var") {
        return d.tindakanKasus || "-";
      }
      if (h === "rekomendasi" || h === "rekomendasi tindak lanjut" || h === "tindak lanjut") {
        return d.rekomendasi || "-";
      }
      if (h === "ketua tim pe" || h === "ketua tim" || h === "ketua") {
        return d.timKetua || "-";
      }
      if (h === "anggota tim pe" || h === "anggota tim" || h === "anggota" || h === "tim pe") {
        return d.timAnggota || "-";
      }
      if (h === "tanggal pelaksanaan" || h === "tgl pelaksanaan" || h === "tanggal pe" || h === "tgl pe") {
        return d.tanggalPelaksanaan || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
      }
      if (h === "pelaksana (petugas)" || h === "pelaksana" || h === "nama pelaksana" || h === "nama petugas" || h === "petugas pe" || h === "petugas") {
        return d.pelaksanaNama || "-";
      }
      if (h === "nip pelaksana" || h === "nip" || h === "nip petugas") {
        return d.pelaksanaNIP || "-";
      }

      // 4. Positional fallback from rowValues array jika dikirim dari aplikasi frontend
      if (d.rowValues && Array.isArray(d.rowValues) && colIdx < d.rowValues.length) {
        var rowVal = d.rowValues[colIdx];
        if (rowVal !== undefined && rowVal !== null && String(rowVal).trim() !== "") {
          return String(rowVal).trim();
        }
      }

      // 5. Positional fallback dari OFFICIAL_HEADERS index
      if (colIdx < OFFICIAL_HEADERS.length) {
        var officialColHeader = OFFICIAL_HEADERS[colIdx].toLowerCase();
        var posKey = FIELD_MAP[officialColHeader];
        if (posKey && d[posKey] !== undefined && d[posKey] !== null && String(d[posKey]).trim() !== "") {
          return String(d[posKey]).trim();
        }
      }

      return "-";
    }

    for (var colIdx = 0; colIdx < existingHeaders.length; colIdx++) {
      var rawHeaderText = String(existingHeaders[colIdx] || "");
      var calculatedVal = ambilNilaiKolomTepat(rawHeaderText, colIdx, data);
      newRow.push(calculatedVal !== undefined && calculatedVal !== null && String(calculatedVal).trim() !== "" ? String(calculatedVal).trim() : "-");
    }

    // Pastikan sheet memiliki jumlah kolom yang memadai
    if (sheet.getMaxColumns() < newRow.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), newRow.length - sheet.getMaxColumns());
    }

    // LOGIKA PENCARIAN BARIS UNTUK UPDATE ATAU INSERT BARU
    var targetRowIdx = -1;
    var lastRow = sheet.getLastRow();

    if (lastRow > 1) {
      // 1. Cari index kolom ID Kasus secara dinamis dari header
      var idColIdx = 0;
      for (var c = 0; c < existingHeaders.length; c++) {
        var hName = String(existingHeaders[c] || "").toLowerCase().trim();
        if (hName.indexOf("id") !== -1 || hName.indexOf("kasus") !== -1 || hName === "no") {
          idColIdx = c;
          break;
        }
      }

      var allData = sheet.getRange(2, 1, lastRow - 1, existingHeaders.length).getValues();
      var searchId = String(data.id_kasus || "").toLowerCase().trim();

      for (var r = 0; r < allData.length; r++) {
        var rowValId = String(allData[r][idColIdx] || "").toLowerCase().trim();
        if (searchId !== "" && (rowValId === searchId || rowValId.indexOf(searchId) !== -1 || searchId.indexOf(rowValId) !== -1)) {
          targetRowIdx = r + 2;
          break;
        }
      }

      // 2. Jika belum ditemukan dengan ID, coba cocokkan dengan Nama Korban + Kelurahan
      if (targetRowIdx < 0 && data.namaKorban) {
        var searchName = String(data.namaKorban).toLowerCase().trim();
        var searchKel = String(data.kelurahan_final || data.kelurahan || "").toLowerCase().trim();
        
        var nameColIdx = -1;
        var kelColIdx = -1;
        for (var nc = 0; nc < existingHeaders.length; nc++) {
          var nhName = String(existingHeaders[nc] || "").toLowerCase().trim();
          if (nhName.indexOf("korban") !== -1 && nhName.indexOf("nama") !== -1) nameColIdx = nc;
          if (nhName.indexOf("kelurahan") !== -1 || nhName.indexOf("desa") !== -1) kelColIdx = nc;
        }

        if (nameColIdx >= 0) {
          for (var r2 = 0; r2 < allData.length; r2++) {
            var rowName = String(allData[r2][nameColIdx] || "").toLowerCase().trim();
            var rowKel = kelColIdx >= 0 ? String(allData[r2][kelColIdx] || "").toLowerCase().trim() : "";
            if (rowName === searchName && (!searchKel || !rowKel || rowKel === searchKel)) {
              targetRowIdx = r2 + 2;
              break;
            }
          }
        }
      }
    }

    if (targetRowIdx > 0) {
      // PERBARUI (UPDATE) BARIS DATA YANG SUDAH ADA
      sheet.getRange(targetRowIdx, 1, 1, newRow.length).setValues([newRow]);
      return {
        status: "success",
        action_performed: "updated",
        message: "Data laporan " + data.id_kasus + " (" + (data.namaKorban || "Pasien") + ") berhasil DIPERBARUI di baris ke-" + targetRowIdx,
        id_kasus: data.id_kasus,
        baris_ke: targetRowIdx
      };
    } else {
      // TAMBAHKAN (INSERT/APPEND) BARIS BARU
      sheet.appendRow(newRow);
      return {
        status: "success",
        action_performed: "created",
        message: "Data laporan " + data.id_kasus + " (" + (data.namaKorban || "Pasien") + ") berhasil DICATAT di baris baru ke-" + sheet.getLastRow(),
        id_kasus: data.id_kasus,
        baris_ke: sheet.getLastRow()
      };
    }
  } catch (err) {
    return {
      status: "error",
      message: err.toString()
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (eRelease) {}
  }
}
`;
}

/**
 * Menguji apakah endpoint Web App aktif dan dapat dihubungi
 */
export async function testAppsScriptHealth(targetUrl: string): Promise<{
  online: boolean;
  status: string;
  message: string;
  detail?: any;
}> {
  const cleanUrl = (targetUrl || "").trim();
  if (!cleanUrl) {
    return { online: false, status: "error", message: "URL Web App belum diisi." };
  }

  const pingUrl = `${cleanUrl}${cleanUrl.includes("?") ? "&" : "?"}action=ping&_t=${Date.now()}`;
  try {
    const res = await fetch(pingUrl, {
      method: "GET",
      headers: { Accept: "application/json, text/plain, */*" }
    });

    if (!res.ok) {
      return {
        online: false,
        status: "http_error",
        message: `Server Google mengembalikan status HTTP ${res.status} (${res.statusText}). Kemungkinan deployment sudah kadaluarsa atau izin akses belum diatur ke 'Anyone'.`
      };
    }

    const text = await res.text();
    if (text.includes("找不到網頁") || text.includes("errorMessage") || text.includes("Service invoked too many times") || text.includes("Google Drive")) {
      return {
        online: false,
        status: "gas_error",
        message: "URL Google Apps Script tidak valid / tidak ditemukan (Error 404). Silakan buat Deployment Baru di Google Apps Script."
      };
    }

    try {
      const parsed = JSON.parse(text);
      return {
        online: true,
        status: "online",
        message: "Endpoint Web App Google Sheets AKTIF dan siap menerima data!",
        detail: parsed
      };
    } catch {
      return {
        online: true,
        status: "online",
        message: "Endpoint Web App merespons (status OK)."
      };
    }
  } catch (err: any) {
    // Pada browser, fetch GET ke script.google.com mungkin terhambat CORS saat redirect, 
    // namun jika user bisa membuka di tab baru, endpoint tetap dapat menerima POST via no-cors.
    return {
      online: false,
      status: "network_check_needed",
      message: `Pengecekan otomatis via browser terbatas oleh CORS. Silakan gunakan tombol 'Buka di Tab Baru' untuk verifikasi status: ${err?.message || ""}`
    };
  }
}

/**
 * Mengirim atau memperbarui payload ke Google Apps Script Web App
 */
export async function sendToAppsScript(
  targetUrl: string,
  payload: Record<string, any>,
  action: "create" | "update" = "create"
): Promise<{ success: boolean; message: string; action_performed?: string }> {
  const cleanUrl = targetUrl.trim();
  if (!cleanUrl) {
    throw new Error("URL Web App kosong. Silakan atur di Pengaturan Google Sheets.");
  }

  const namaKorbanVal = (payload.namaKorban || payload.namaPasien || payload["Nama Korban"] || payload["Nama Pasien"] || "").trim();
  const noHpVal = (payload.noHpKorban || payload.noHpPasien || payload.kontakKorban || payload["No HP Korban"] || payload.kontakPemilik || "").trim();
  const umurKorbanVal = (payload.umurKorban || payload.umurPasien || payload["Umur Korban"] || "").trim();
  const alamatKorbanVal = (payload.alamatKorban || payload.alamatPasien || payload["Alamat Korban"] || "").trim();
  const jkKorbanVal = (payload.jkKorban || payload.jkPasien || payload["Jenis Kelamin Korban"] || "").trim();
  const kelurahanVal = (payload.kelurahan_final || payload.kelurahan || payload["Kelurahan"] || "Sananwetan").trim();
  const kecamatanVal = (payload.kecamatan_final || payload.kecamatan || payload["Kecamatan"] || "Sananwetan").trim();
  const kabKotaVal = (payload.kabupatenKota_final || payload.kabupatenKota || payload["Kabupaten/Kota"] || "Kota Blitar").trim();
  const spesiesVal = (payload.spesies_final || payload.spesiesHPR || payload["Spesies HPR"] || "Anjing").trim();
  const waktuKejadianVal = (payload.waktuKejadian || payload["Waktu Kejadian"] || new Date().toISOString().slice(0, 16)).trim();
  const tglPelaksanaanVal = (payload.tanggalPelaksanaan || payload["Tanggal Pelaksanaan"] || new Date().toISOString().slice(0, 10)).trim();

  const orderedRowValues = mapPayloadToRowValues({
    id_kasus: payload.id_kasus || "",
    timestamp_submit: payload.timestamp_submit || new Date().toISOString(),
    waktuKejadian: waktuKejadianVal,
    alamatKejadian: payload.alamatKejadian || "",
    kelurahan: kelurahanVal,
    kelurahan_final: kelurahanVal,
    kecamatan: kecamatanVal,
    kecamatan_final: kecamatanVal,
    kabupatenKota: kabKotaVal,
    kabupatenKota_final: kabKotaVal,
    provinsi: payload.provinsi || "Jawa Timur",
    sumberInfo: payload.sumberInfo || "",
    kronologi: payload.kronologi || "",
    spesiesHPR: spesiesVal,
    spesies_final: spesiesVal,
    ras: payload.ras || "-",
    jkHewan: payload.jkHewan || "",
    umurHewan: payload.umurHewan || "",
    satuanUmur: payload.satuanUmur || "Tahun",
    metodePelihara: payload.metodePelihara || "",
    kondisiHewan: payload.kondisiHewan || "",
    riwayatVaksin: payload.riwayatVaksin || "",
    tanggalVaksin: payload.tanggalVaksin || "-",
    pemilikHewan: payload.pemilikHewan || "",
    alamatPemilik: payload.alamatPemilik || "",
    kontakPemilik: payload.kontakPemilik || "",
    namaKorban: namaKorbanVal,
    namaPasien: namaKorbanVal,
    noHpKorban: noHpVal,
    noHpPasien: noHpVal,
    umurKorban: umurKorbanVal,
    umurPasien: umurKorbanVal,
    alamatKorban: alamatKorbanVal,
    alamatPasien: alamatKorbanVal,
    jkKorban: jkKorbanVal,
    jkPasien: jkKorbanVal,
    kondisiLuka: payload.kondisiLuka || "Kategori 1",
    lokasiLuka: payload.lokasiLuka || "",
    pertolonganPertama: payload.pertolonganPertama || "",
    tindakanKasus: payload.tindakanKasus || "",
    rekomendasi: payload.rekomendasi || "",
    timKetua: payload.timKetua || "",
    timAnggota: payload.timAnggota || "",
    tanggalPelaksanaan: tglPelaksanaanVal,
    pelaksanaNama: payload.pelaksanaNama || "",
    pelaksanaNIP: payload.pelaksanaNIP || ""
  } as any);

  const enhancedPayload: Record<string, any> = {
    ...payload,
    action: action,
    is_update: action === "update",
    rowValues: orderedRowValues,
    // Field standar
    namaKorban: namaKorbanVal,
    noHpKorban: noHpVal,
    umurKorban: umurKorbanVal,
    alamatKorban: alamatKorbanVal,
    jkKorban: jkKorbanVal,
    kelurahan: kelurahanVal,
    kelurahan_final: kelurahanVal,
    kecamatan: kecamatanVal,
    kecamatan_final: kecamatanVal,
    kabupatenKota: kabKotaVal,
    kabupatenKota_final: kabKotaVal,
    spesiesHPR: spesiesVal,
    spesies_final: spesiesVal,
    waktuKejadian: waktuKejadianVal,
    tanggalPelaksanaan: tglPelaksanaanVal,
    // Alias sinonim pasien
    namaPasien: namaKorbanVal,
    noHpPasien: noHpVal,
    umurPasien: umurKorbanVal,
    alamatPasien: alamatKorbanVal,
    jkPasien: jkKorbanVal,
    // Alias Header Resmi Google Spreadsheet
    "ID Kasus": payload.id_kasus || "",
    "Waktu Submit": payload.timestamp_submit || new Date().toISOString(),
    "Waktu Kejadian": waktuKejadianVal,
    "Alamat Kejadian": payload.alamatKejadian || "",
    "Kelurahan": kelurahanVal,
    "Kecamatan": kecamatanVal,
    "Kabupaten/Kota": kabKotaVal,
    "Provinsi": payload.provinsi || "Jawa Timur",
    "Sumber Informasi": payload.sumberInfo || "",
    "Kronologi Kejadian": payload.kronologi || "",
    "Spesies HPR": spesiesVal,
    "Ras Hewan": payload.ras || "-",
    "Jenis Kelamin Hewan": payload.jkHewan || "",
    "Umur Hewan": payload.umurHewan ? `${payload.umurHewan} ${payload.satuanUmur || "Tahun"}`.trim() : "",
    "Metode Pemeliharaan": payload.metodePelihara || "",
    "Kondisi Hewan Saat Ini": payload.kondisiHewan || "",
    "Riwayat Vaksinasi": payload.riwayatVaksin || "",
    "Tanggal Vaksinasi": payload.tanggalVaksin || "-",
    "Nama Pemilik": payload.pemilikHewan || "",
    "Alamat Pemilik": payload.alamatPemilik || "",
    "Kontak Pemilik": payload.kontakPemilik || "",
    "Nama Korban": namaKorbanVal,
    "No HP Korban": noHpVal,
    "Umur Korban": umurKorbanVal ? `${umurKorbanVal} Tahun` : "",
    "Alamat Korban": alamatKorbanVal,
    "Jenis Kelamin Korban": jkKorbanVal,
    "Kondisi Luka": payload.kondisiLuka || "Kategori 1",
    "Lokasi Luka": payload.lokasiLuka || "",
    "Pertolongan Pertama": payload.pertolonganPertama || "",
    "Tindakan Kasus": payload.tindakanKasus || "",
    "Rekomendasi": payload.rekomendasi || "",
    "Ketua Tim PE": payload.timKetua || "",
    "Anggota Tim PE": payload.timAnggota || "",
    "Tanggal Pelaksanaan": tglPelaksanaanVal,
    "Pelaksana (Petugas)": payload.pelaksanaNama || "",
    "NIP Pelaksana": payload.pelaksanaNIP || ""
  };

  const jsonStr = JSON.stringify(enhancedPayload);

  // Simpan ke riwayat lokal agar admin selalu memiliki akses instan
  saveCaseToLocalHistory(enhancedPayload);

  // Strategy 1: Direct fetch POST with text/plain to avoid preflight issues
  let fetchSucceeded = false;
  try {
    await fetch(cleanUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: jsonStr
    });
    fetchSucceeded = true;
  } catch (errFetch) {
    console.warn("Direct fetch attempt notice:", errFetch);
  }

  // Strategy 2 (Fallback): Hidden form submit
  if (!fetchSucceeded) {
    try {
      const iframeId = "gas_hidden_submit_frame";
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = "none";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = cleanUrl;
      form.target = iframeId;
      form.style.display = "none";

      const payloadInput = document.createElement("input");
      payloadInput.type = "hidden";
      payloadInput.name = "payload";
      payloadInput.value = jsonStr;
      form.appendChild(payloadInput);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => {
        try { form.remove(); } catch (e) {}
      }, 3000);
    } catch (errForm) {
      console.warn("Iframe fallback notice:", errForm);
    }
  }

  return {
    success: true,
    action_performed: action,
    message: action === "update"
      ? "Pembaruan laporan berhasil dikirim ke Google Sheets!"
      : "Data formulir baru berhasil dikirim ke Google Sheets!"
  };
}

/**
 * Mengambil riwayat kasus dari penyimpanan lokal (aman, cepat, dan tidak memicu panggilan GET eksternal ke Google Sheets)
 */
export async function fetchCasesHistory(
  _webAppUrl: string = "",
  searchQuery: string = ""
): Promise<StoredCaseItem[]> {
  const localItems = getLocalSubmissionHistory();
  return filterLocalItems(localItems, searchQuery);
}

function filterLocalItems(items: StoredCaseItem[], query: string): StoredCaseItem[] {
  if (!query || !query.trim()) return items;
  const q = query.toLowerCase().trim();
  return items.filter(
    (it) =>
      it.id_kasus.toLowerCase().includes(q) ||
      it.namaKorban.toLowerCase().includes(q) ||
      it.alamatKejadian.toLowerCase().includes(q) ||
      it.pelaksanaNama.toLowerCase().includes(q) ||
      it.kelurahan.toLowerCase().includes(q)
  );
}

/**
 * Mengirim permintaan perbaikan dan perapian struktur Google Spreadsheet
 * (Membersihkan kolom ganda seperti kelurahan, menstandarkan 36 kolom, dan memulihkan data yang bergeser)
 */
export async function repairSpreadsheetStructure(
  targetUrl: string
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = (targetUrl || "").trim();
  if (!cleanUrl) {
    return { success: false, message: "URL Web App belum dikonfigurasi." };
  }

  const payload = {
    action: "repairSheet",
    _timestamp: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(payload);

  try {
    await fetch(cleanUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: jsonStr
    });
    return {
      success: true,
      message: "Permintaan perbaikan struktur & kolom telah dikirimkan ke Google Sheets! Header ganda telah dibersihkan dan 36 kolom resmi telah distandarkan."
    };
  } catch (err: any) {
    console.warn("Direct fetch repair notice:", err);
    try {
      const iframeId = "gas_hidden_repair_frame";
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = "none";
        iframe.style.width = "0";
        iframe.style.height = "0";
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = cleanUrl;
      form.target = iframeId;
      form.style.display = "none";

      const payloadInput = document.createElement("input");
      payloadInput.type = "hidden";
      payloadInput.name = "payload";
      payloadInput.value = jsonStr;
      form.appendChild(payloadInput);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => {
        try { form.remove(); } catch (e) {}
      }, 3000);

      return {
        success: true,
        message: "Perintah perbaikan telah dikirimkan ke Google Sheets!"
      };
    } catch (eFallback: any) {
      return {
        success: false,
        message: `Gagal mengirim perbaikan: ${eFallback?.message || "Kesalahan jaringan"}`
      };
    }
  }
}

/**
 * Mengirim permintaan penghapusan record ke Google Apps Script Web App
 */
export async function deleteRecordFromAppsScript(
  targetUrl: string,
  id_kasus: string
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = (targetUrl || "").trim();
  if (!cleanUrl) {
    return { success: false, message: "URL Web App belum dikonfigurasi." };
  }

  const payload = {
    action: "delete",
    id_kasus: id_kasus
  };

  const jsonStr = JSON.stringify(payload);

  try {
    await fetch(cleanUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: jsonStr
    });
    return {
      success: true,
      message: `Permintaan hapus kasus ${id_kasus} berhasil dikirim ke Google Sheets.`
    };
  } catch (err) {
    console.warn("Direct fetch delete notice:", err);
    // Fallback: iframe submit
    try {
      const iframeId = "gas_hidden_del_frame";
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = "none";
        iframe.style.width = "0";
        iframe.style.height = "0";
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = cleanUrl;
      form.target = iframeId;
      form.style.display = "none";

      const payloadInput = document.createElement("input");
      payloadInput.type = "hidden";
      payloadInput.name = "payload";
      payloadInput.value = jsonStr;
      form.appendChild(payloadInput);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => {
        try { form.remove(); } catch (e) {}
      }, 3000);
      return { success: true, message: `Permintaan hapus kasus ${id_kasus} dikirim via iframe.` };
    } catch (eForm) {
      return { success: false, message: `Gagal mengirim hapus: ${String(err)}` };
    }
  }
}

/**
 * Status error sinkronisasi Google Visualization (GViz)
 */
let gvizSyncError: string | null = null;
const gvizErrorListeners = new Set<(error: string | null) => void>();

export function getGvizSyncError(): string | null {
  return gvizSyncError;
}

export function setGvizSyncError(err: string | null): void {
  gvizSyncError = err;
  gvizErrorListeners.forEach((listener) => {
    try {
      listener(err);
    } catch (e) {}
  });
}

export function subscribeGvizSyncError(callback: (error: string | null) => void): () => void {
  gvizErrorListeners.add(callback);
  callback(gvizSyncError);
  return () => {
    gvizErrorListeners.delete(callback);
  };
}

/**
 * Parsing teks respons Google Visualization API (GViz)
 * Format respons dari Google Sheets GViz: /*O_o* / google.visualization.Query.setResponse({...});
 */
export function parseGvizData(text: string): any {
  if (!text || typeof text !== "string") {
    throw new Error("Respons GViz kosong.");
  }
  
  // Metode 1: Cari setResponse(...)
  const startIdx = text.indexOf("setResponse(");
  if (startIdx !== -1) {
    const jsonStart = startIdx + "setResponse(".length;
    const lastParen = text.lastIndexOf(")");
    if (lastParen > jsonStart) {
      const jsonSnippet = text.slice(jsonStart, lastParen).trim();
      return JSON.parse(jsonSnippet);
    }
  }

  // Metode 2: Sesuai spesifikasi slice offset standard
  try {
    const jsonString = text.substring(47).slice(0, -2);
    return JSON.parse(jsonString);
  } catch (e1) {
    // Metode 3: Regex fallback
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
    if (match && match[1]) {
      return JSON.parse(match[1].trim());
    }
    throw new Error("Format respons GViz Google Sheets tidak valid atau spreadsheet belum di-share publik.");
  }
}

function parseGvizCellValue(cell: any): any {
  if (!cell) return "";
  // Jika tipe date GViz: "Date(year, month, day, ...)"
  if (typeof cell.v === "string" && cell.v.startsWith("Date(")) {
    if (cell.f) return cell.f;
    const match = cell.v.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/i);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10); // 0-indexed
      const day = parseInt(match[3], 10);
      const pad = (n: number) => String(n).padStart(2, "0");
      if (match[4] !== undefined) {
        const hour = parseInt(match[4], 10);
        const min = match[5] ? parseInt(match[5], 10) : 0;
        return `${year}-${pad(month + 1)}-${pad(day)} ${pad(hour)}:${pad(min)}`;
      }
      return `${year}-${pad(month + 1)}-${pad(day)}`;
    }
  }

  // Jika ada formatted text dan cell.v kosong / null
  if (cell.f !== null && cell.f !== undefined && (cell.v === null || cell.v === undefined)) {
    return cell.f;
  }

  return cell.v !== null && cell.v !== undefined ? cell.v : (cell.f || "");
}

/**
 * Mengambil baris data langsung dari Google Sheets via GViz Query API (mode: cors, anti-cache &t=)
 */
export async function fetchGoogleSheetGvizRows(
  spreadsheetId?: string,
  sheetName?: string
): Promise<{ success: boolean; rows: Record<string, any>[]; message: string }> {
  const cleanId = (spreadsheetId || getSavedSheetConfig()?.spreadsheetId || DEFAULT_SPREADSHEET_ID).trim();
  const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : "";
  // Pastikan tqx=out:json dan anti-cache &t=${Date.now()}
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json${sheetParam}&headers=1&t=${Date.now()}`;

  try {
    const res = await fetch(gvizUrl, {
      method: "GET",
      mode: "cors",
      headers: { Accept: "*/*" }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    if (text.includes("<html") || text.includes("accounts.google.com") || text.includes("ServiceLogin")) {
      throw new Error("Halaman login terdeteksi. Google Sheet belum di-share publik.");
    }

    const parsed = parseGvizData(text);
    if (!parsed || parsed.status === "error") {
      throw new Error(parsed?.errors?.[0]?.message || "Query GViz mengembalikan status error.");
    }

    const table = parsed.table;
    if (!table || !table.rows || table.rows.length === 0) {
      setGvizSyncError(null);
      return { success: true, rows: [], message: "Tabel spreadsheet kosong." };
    }

    // Ekstrak nama kolom dari cols
    let cols: string[] = (table.cols || []).map((col: any, idx: number) => {
      const lbl = col?.label ? String(col.label).trim() : "";
      return lbl || `col_${idx}`;
    });

    let rawRows = table.rows;

    // Jika semua col bernilai col_0, col_1, dsb. dan baris pertama berisi teks judul header
    const isColLabelsEmpty = cols.every((c) => c.startsWith("col_"));
    if (isColLabelsEmpty && rawRows.length > 0) {
      const firstRow = rawRows[0];
      if (firstRow && Array.isArray(firstRow.c)) {
        const potentialHeaders = firstRow.c.map((cell: any, idx: number) => {
          const val = cell?.v !== null && cell?.v !== undefined ? String(cell.v).trim() : "";
          return val || `col_${idx}`;
        });
        // Jika baris pertama memang nama kolom
        if (potentialHeaders.some((h: string) => !h.startsWith("col_"))) {
          cols = potentialHeaders;
          rawRows = rawRows.slice(1);
        }
      }
    }

    const resultRows: Record<string, any>[] = [];
    for (const r of rawRows) {
      if (!r || !r.c || !Array.isArray(r.c)) continue;
      const rowObj: Record<string, any> = {};
      let hasData = false;

      for (let i = 0; i < cols.length; i++) {
        const cell = r.c[i];
        const val = parseGvizCellValue(cell);
        const colName = cols[i];
        rowObj[colName] = val;
        if (val !== "" && val !== null && val !== undefined) {
          hasData = true;
        }
      }

      if (hasData) {
        resultRows.push(rowObj);
      }
    }

    // Reset error jika pembacaan berhasil
    setGvizSyncError(null);

    return {
      success: true,
      rows: resultRows,
      message: `Berhasil memuat ${resultRows.length} baris langsung dari Google Sheets (${sheetName || "Sheet Utama"}).`
    };
  } catch (err: any) {
    const errorPrefix = `Gagal sinkron: Sheet ID ${cleanId.slice(0, 5)}... belum di-share Anyone with link - Viewer. Buka Google Sheet > Share > General access > Anyone with link`;
    setGvizSyncError(errorPrefix);

    return {
      success: false,
      rows: [],
      message: errorPrefix
    };
  }
}

/**
 * Parsing teks CSV menjadi baris dan kolom dengan penanganan tanda kutip ganda
 */
function parseCsvText(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) {
        result.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) {
      result.push(row);
    }
  }

  return result;
}

/**
 * Mengambil baris data langsung dari Google Sheets via CSV export (mode: cors, anti-cache &t=)
 */
export async function fetchGoogleSheetCsvRows(
  spreadsheetId?: string,
  sheetName?: string
): Promise<{ success: boolean; rows: Record<string, any>[]; message: string }> {
  const cleanId = (spreadsheetId || getSavedSheetConfig()?.spreadsheetId || DEFAULT_SPREADSHEET_ID).trim();
  const sheetParam = sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : "";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv${sheetParam}&t=${Date.now()}`;

  try {
    const res = await fetch(csvUrl, {
      method: "GET",
      mode: "cors",
      headers: { Accept: "*/*" }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const rows = parseCsvText(text);
    if (rows.length < 2) return { success: true, rows: [], message: "CSV kosong atau hanya header." };

    const headers = rows[0].map((h) => h.trim());
    const dataRows: Record<string, any>[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !c || c.trim() === "")) continue;
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] !== undefined ? r[idx] : "";
      });
      dataRows.push(obj);
    }

    return {
      success: true,
      rows: dataRows,
      message: `Berhasil memuat ${dataRows.length} baris via CSV export.`
    };
  } catch (err: any) {
    return {
      success: false,
      rows: [],
      message: `Direct CSV notice: ${err?.message || String(err)}`
    };
  }
}

/**
 * Mengambil baris data secara langsung dengan mencoba beberapa kemungkinan nama tab
 */
export async function fetchDirectGoogleSheetRows(
  spreadsheetId?: string,
  candidateSheetNames: string[] = ["Data Laporan GHPR", "Laporan PE GHPR", "Sheet1", "Sheet 1", "Form Responses 1", ""]
): Promise<{ success: boolean; rows: Record<string, any>[]; sheetUsed: string }> {
  const cleanId = (spreadsheetId || getSavedSheetConfig()?.spreadsheetId || DEFAULT_SPREADSHEET_ID).trim();

  for (const sheet of candidateSheetNames) {
    // 1. Coba GViz JSON
    const gvizRes = await fetchGoogleSheetGvizRows(cleanId, sheet);
    if (gvizRes.success && gvizRes.rows.length > 0) {
      return { success: true, rows: gvizRes.rows, sheetUsed: sheet || "Sheet1" };
    }

    // 2. Coba CSV
    const csvRes = await fetchGoogleSheetCsvRows(cleanId, sheet);
    if (csvRes.success && csvRes.rows.length > 0) {
      return { success: true, rows: csvRes.rows, sheetUsed: sheet || "Sheet1" };
    }
  }

  return { success: false, rows: [], sheetUsed: "" };
}

/**
 * Mengambil daftar akun petugas dari Google Spreadsheet sheet 'Data_Petugas' via Apps Script atau Direct GViz/CSV
 */
export async function fetchOfficerAccountsFromAppsScript(
  targetUrl?: string
): Promise<{ success: boolean; data: any[]; message: string }> {
  const cleanUrl = (targetUrl || "").trim();

  // Strategi 1: Coba langsung dari Google Spreadsheet Tab 'Data_Petugas'
  try {
    const directRes = await fetchDirectGoogleSheetRows(DEFAULT_SPREADSHEET_ID, [
      "Data_Petugas",
      "Data Petugas",
      "Petugas"
    ]);

    if (directRes.success && directRes.rows.length > 0) {
      return {
        success: true,
        data: directRes.rows,
        message: `Berhasil memuat ${directRes.rows.length} akun petugas langsung dari Google Sheets (tab: ${directRes.sheetUsed}).`
      };
    }
  } catch (eDirect) {
    console.warn("Direct officer fetch notice:", eDirect);
  }

  // Strategi 2: Coba melalui Apps Script Web App jika URL tersedia
  if (cleanUrl) {
    try {
      const fetchUrl = `${cleanUrl}${cleanUrl.includes("?") ? "&" : "?"}action=getAccounts&_t=${Date.now()}`;
      const res = await fetch(fetchUrl, {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (res.ok) {
        const json = await res.json();
        const accounts = Array.isArray(json) ? json : (json && Array.isArray(json.data) ? json.data : []);
        if (accounts.length > 0) {
          return {
            success: true,
            data: accounts,
            message: `Berhasil memuat ${accounts.length} akun petugas via Web App.`
          };
        }
      }
    } catch (err: any) {
      console.warn("Apps Script officer fetch notice:", err);
    }
  }

  return {
    success: false,
    data: [],
    message: "Belum ada akun petugas khusus di spreadsheet, menggunakan konfigurasi standar 7 petugas."
  };
}

/**
 * Menyimpan seluruh akun petugas ke Google Spreadsheet sheet 'Data_Petugas' via Apps Script
 */
export async function pushOfficerAccountsToAppsScript(
  accounts: any[],
  targetUrl: string
): Promise<{ success: boolean; message: string }> {
  const cleanUrl = (targetUrl || "").trim();
  if (!cleanUrl) {
    return { success: false, message: "URL Web App belum dikonfigurasi." };
  }

  const payload = {
    action: "saveAccounts",
    accounts: accounts
  };
  const jsonStr = JSON.stringify(payload);

  try {
    await fetch(cleanUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: jsonStr
    });

    return {
      success: true,
      message: `Berhasil sinkron ${accounts.length} akun petugas ke Google Sheets.`
    };
  } catch (err) {
    // Fallback: submit via hidden form iframe
    try {
      const iframeId = "gas_hidden_officer_frame";
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = "none";
        iframe.style.width = "0";
        iframe.style.height = "0";
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = cleanUrl;
      form.target = iframeId;
      form.style.display = "none";

      const payloadInput = document.createElement("input");
      payloadInput.type = "hidden";
      payloadInput.name = "payload";
      payloadInput.value = jsonStr;
      form.appendChild(payloadInput);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => {
        try { form.remove(); } catch (e) {}
      }, 3000);

      return {
        success: true,
        message: `Sinkron ${accounts.length} akun petugas dikirim via iframe ke Google Sheets.`
      };
    } catch (eForm) {
      return { success: false, message: `Gagal sinkron akun: ${String(err)}` };
    }
  }
}

/**
 * Mengirim seluruh data pasien monitoring ke Google Spreadsheet (sheet 'Data Laporan GHPR')
 */
export async function pushAllPatientsToAppsScript(
  patients: any[],
  targetUrl: string
): Promise<{ success: boolean; message: string; count?: number }> {
  const cleanUrl = (targetUrl || "").trim();
  if (!cleanUrl) {
    return { success: false, message: "URL Web App belum dikonfigurasi." };
  }

  // Format data pasien agar sesuai kolom Apps Script
  const formattedPatients = patients.map((p) => {
    const full = p.fullData || {};
    return {
      id_kasus: p.id_kasus,
      timestamp_submit: p.timestamp_submit || new Date().toLocaleString("id-ID"),
      waktuKejadian: p.waktuKejadian || "",
      alamatKejadian: p.alamatKorban || full.alamatKejadian || "-",
      kelurahan_final: p.kelurahan || full.kelurahan || "Sananwetan",
      kecamatan_final: p.kecamatan || full.kecamatan || "Sananwetan",
      kabupatenKota_final: p.kabupatenKota || full.kabupatenKota || "Kota Blitar",
      provinsi: full.provinsi || "Jawa Timur",
      sumberInfo: full.sumberInfo || "Laporan Masyarakat / Puskesmas",
      kronologi: full.kronologi || `Kasus gigitan ${p.spesiesHPR || "HPR"} terpantau.`,
      spesies_final: p.spesiesHPR || full.spesiesHPR || "Anjing",
      ras: p.rasHewan || full.ras || "-",
      jkHewan: full.jkHewan || "Jantan",
      umurHewan: full.umurHewan || "1",
      satuanUmur: full.satuanUmur || "Tahun",
      metodePelihara: full.metodePelihara || "Dipelihara / Dikandangkan",
      kondisiHewan: p.kondisiHewan || full.kondisiHewan || "Dalam Observasi",
      riwayatVaksin: full.riwayatVaksin || "Tidak Tahu",
      tanggalVaksin: full.tanggalVaksin || "",
      pemilikHewan: p.pemilikHewan || full.pemilikHewan || "-",
      alamatPemilik: p.alamatPemilik || full.alamatPemilik || "-",
      kontakPemilik: p.kontakPemilik || full.kontakPemilik || "-",
      namaKorban: p.namaKorban || "Tanpa Nama",
      noHpKorban: p.noHpKorban || p.kontakKorban || "-",
      umurKorban: p.umurKorban ? String(p.umurKorban).replace(/\D/g, "") : "-",
      alamatKorban: p.alamatKorban || "-",
      jkKorban: p.jkKorban || "Laki-laki",
      kondisiLuka: p.kondisiLuka || "Kategori 2",
      lokasiLuka: p.lokasiLuka || "-",
      pertolonganPertama: p.pertolonganPertama || "Cuci luka air mengalir + sabun 15 menit",
      detailPertolongan: p.detailPertolongan || "",
      tindakanKasus: p.tindakanKasus || "Penyelidikan Epidemiologi & Perawatan Luka",
      tindakanHPR: p.tindakanHPR || "Observasi 14 Hari",
      rekomendasi: p.rekomendasi || "Observasi harian kondisi korban dan hewan.",
      timKetua: full.timKetua || "dr. Triana Sulistyaningsih",
      timAnggota: full.timAnggota || "Petugas Surveilans Rabies",
      tanggalPelaksanaan: full.tanggalPelaksanaan || String(p.waktuKejadian || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      pelaksanaNama: p.petugasPJ || full.pelaksanaNama || "Widodo Suprianto A.Md.Kep",
      pelaksanaNIP: p.nipPJ || full.pelaksanaNIP || "197606252009011007"
    };
  });

  const payload = {
    action: "saveAllPatients",
    patients: formattedPatients
  };
  const jsonStr = JSON.stringify(payload);

  try {
    await fetch(cleanUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: jsonStr
    });

    return {
      success: true,
      count: formattedPatients.length,
      message: `Berhasil mengirim ${formattedPatients.length} data pasien ke Google Spreadsheet.`
    };
  } catch (err) {
    try {
      const iframeId = "gas_hidden_bulk_patients_frame";
      let iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.name = iframeId;
        iframe.style.display = "none";
        iframe.style.width = "0";
        iframe.style.height = "0";
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = cleanUrl;
      form.target = iframeId;
      form.style.display = "none";

      const payloadInput = document.createElement("input");
      payloadInput.type = "hidden";
      payloadInput.name = "payload";
      payloadInput.value = jsonStr;
      form.appendChild(payloadInput);

      document.body.appendChild(form);
      form.submit();
      setTimeout(() => {
        try { form.remove(); } catch (e) {}
      }, 3000);

      return {
        success: true,
        count: formattedPatients.length,
        message: `Sinkron ${formattedPatients.length} data pasien dikirim via iframe ke Google Spreadsheet.`
      };
    } catch (eForm) {
      return { success: false, message: `Gagal sinkron data pasien: ${String(err)}` };
    }
  }
}



