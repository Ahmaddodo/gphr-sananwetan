export interface FormGHPRData {
  waktuKejadian: string;
  tanggalKejadian?: string;
  jamKejadian?: string;
  tanggalBerkunjungFaskes?: string;
  namaFaskes?: string;
  alamatKejadian: string;
  kelurahan: string;
  kelurahanCustom: string;
  kelurahanKejadian?: string;
  kecamatan: string;
  kecamatanCustom: string;
  kecamatanKejadian?: string;
  kabupatenKota: string;
  kabupatenKotaCustom: string;
  kabupatenKotaKejadian?: string;
  provinsi: string;
  provinsiKejadian?: string;
  sumberInfo: string;
  kronologi: string;
  spesiesHPR: string;
  spesiesLain: string;
  ras: string;
  jkHewan: string;
  umurHewan: string;
  satuanUmur: string;
  metodePelihara: string;
  asalHewan: string;
  pakan: string;
  biosekuriti: string;
  sumberAir: string;
  kondisiHewan: string;
  pemilikHewan: string;
  alamatPemilik: string;
  kontakPemilik: string;
  riwayatVaksin: string;
  tanggalVaksin: string;
  namaKorban: string;
  umurKorban: string;
  alamatKorban: string;
  kelurahanDomisili?: string;
  kelurahanDomisiliCustom?: string;
  kecamatanDomisili?: string;
  kecamatanDomisiliCustom?: string;
  kabupatenKotaDomisili?: string;
  kabupatenKotaDomisiliCustom?: string;
  provinsiDomisili?: string;
  noHpKorban: string;
  jkKorban: string;
  kondisiKorban: string;
  kondisiUmumKorban?: string;
  pertolonganPertama: string;
  pertolonganPertamaList?: string[];
  cuciLukaKurang12Jam?: string;
  cuciLukaLebih12Jam?: string;
  varDosis1?: string;
  sar?: string;
  detailPertolongan: string;
  kondisiLuka: string;
  lokasiLuka: string;
  tindakanHPR: string;
  tindakanKasus: string;
  tindakanMasyarakat: string;
  rekomendasi: string;
  sumberLaporan: string;
  fotoDokumentasi?: string;
  timKetua: string;
  timAnggota: string;
  tanggalPelaksanaan: string;
  pelaksanaNama: string;
  pelaksanaNIP: string;
  tandaTanganUrl?: string;
  tandaTanganOtomatis?: boolean;
  jenisTandaTangan?: "otomatis" | "gambar" | "pad";
  id_kasus?: string;
  statusPemantauan?: string;
  hariObservasiKe?: number | string;
  statusHewanObservasi?: string;
  jadwalVAR?: Record<string, any>;
  catatanPerkembanganHarian?: string;
  riwayatLog?: any[];
}

export type FormErrors = Partial<Record<keyof FormGHPRData, string>>;

export interface SubmissionPayload extends FormGHPRData {
  id_kasus: string;
  timestamp_submit: string;
  spesies_final: string;
  kelurahan_final: string;
  kecamatan_final: string;
  kabupatenKota_final: string;
  action?: string;
  is_update?: boolean;
}

export interface SubmissionResult {
  id: string;
  time: string;
}

export interface StepItem {
  id: number;
  title: string;
  desc: string;
  iconName: string;
}

// ==========================================
// HAK AKSES & MONITORING PASIEN PER KELURAHAN
// ==========================================

export type KelurahanWilayah =
  | "Semua"
  | "Sananwetan"
  | "Gedog"
  | "Bendogerit"
  | "Karangtengah"
  | "Klampok"
  | "Plosokerep"
  | "Rembang";

export interface UserAccessProfile {
  id: string;
  nama: string;
  nip: string;
  role: string;
  kelurahan: KelurahanWilayah;
  jabatan: string;
  username: string;
  password?: string;
  email?: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isKoordinator: boolean;
}

export interface VarDoseItem {
  tanggal: string;
  status: "Sudah Diberikan" | "Belum Diberikan" | "Tidak Perlu" | "Terjadwal";
  lokasiPemberian?: string;
  keterangan?: string;
}

export interface MonitoringDailyLog {
  id: string;
  tanggal: string;
  hariKe: number;
  petugasNama: string;
  petugasNIP?: string;
  kelurahan: string;
  kondisiKorban: string;
  kondisiUmumKorban?: string;
  statusLuka: string;
  kondisiHewan: string;
  suhuTubuh?: string;
  gejalaMuncul?: string;
  tindakanDilakukan: string;
  catatanKhusus: string;
}

export type StatusPemantauanPasien =
  | "Dalam Pemantauan (Aktif)"
  | "Selesai Observasi (14 Hari)"
  | "Perlu Follow-up VAR"
  | "Dirujuk / Perawatan Lanjut"
  | "Meninggal Dunia (Kasus Rabies)";

export type StatusHewanObservasi =
  | "Sehat / Normal (Observasi)"
  | "Mati dalam 14 Hari"
  | "Hilang / Kabur"
  | "Positif Rabies (FAT Lab)"
  | "Hewan Dieliminasi";

export interface PatientMonitoringItem {
  id_kasus: string;
  timestamp_submit: string;
  waktuKejadian: string;
  tanggalKejadian?: string;
  jamKejadian?: string;
  tanggalBerkunjungFaskes?: string;
  namaFaskes?: string;
  namaKorban: string;
  nikKorban?: string;
  umurKorban: string;
  jkKorban: string;
  alamatKorban: string;
  kelurahanDomisili?: string;
  kecamatanDomisili?: string;
  kabupatenKotaDomisili?: string;
  provinsiDomisili?: string;
  kontakKorban: string;
  noHpKorban?: string;
  kondisiKorban?: string;
  kondisiUmumKorban?: string;
  kelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi?: string;
  alamatKejadian?: string;
  kelurahanKejadian?: string;
  kecamatanKejadian?: string;
  kabupatenKotaKejadian?: string;
  provinsiKejadian?: string;
  spesiesHPR: string;
  rasHewan?: string;
  kondisiHewan: string;
  pemilikHewan?: string;
  alamatPemilik?: string;
  kontakPemilik?: string;
  kondisiLuka: string;
  lokasiLuka: string;
  pertolonganPertama: string;
  pertolonganPertamaList?: string[];
  cuciLukaKurang12Jam?: string;
  cuciLukaLebih12Jam?: string;
  varDosis1?: string;
  sar?: string;
  detailPertolongan?: string;
  tindakanKasus: string;
  tindakanHPR?: string;
  rekomendasi?: string;
  statusPemantauan: StatusPemantauanPasien;
  statusHewanObservasi: StatusHewanObservasi;
  hariObservasiKe: number;
  tglMulaiObservasi: string;
  tglSelesaiObservasi: string;
  jadwalVAR: {
    dosis0: VarDoseItem;
    dosis3: VarDoseItem;
    dosis7: VarDoseItem;
    dosis21?: VarDoseItem;
  };
  riwayatLog: MonitoringDailyLog[];
  catatanPerkembanganHarian?: string;
  petugasPJ: string;
  nipPJ: string;
  lastUpdated?: string;
  fullData?: FormGHPRData;
}

// ==========================================
// OFFLINE QUEUE & SYNC TYPES
// ==========================================

export type OfflineQueueActionType =
  | "new_case"
  | "edit_case"
  | "update_var"
  | "daily_log"
  | "status_update"
  | "delete_case";

export type OfflineSyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface OfflineQueueItem {
  id: string;
  type: OfflineQueueActionType;
  timestamp: string;
  caseId: string;
  patientName: string;
  kelurahan: string;
  payload: Record<string, any>;
  status: OfflineSyncStatus;
  retryCount: number;
  errorMessage?: string;
  syncedAt?: string;
}
