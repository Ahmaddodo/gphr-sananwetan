import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  MapPin,
  Activity,
  Syringe,
  Save,
  PlusCircle,
  FileText,
  Shield,
  Edit3,
  Trash2,
  Check,
  Dog,
  HeartPulse,
  History,
  Loader2,
  RefreshCw
} from "lucide-react";
import {
  PatientMonitoringItem,
  StatusPemantauanPasien,
  StatusHewanObservasi,
  UserAccessProfile,
  VarDoseItem,
  MonitoringDailyLog,
  SubmissionPayload
} from "../types";
import {
  addPatientMonitoringLog,
  upsertPatient,
  normalizeDateToIso,
  calculateObservationDay,
  parseChronologicalLogs,
  deduplicateAndSortLogs
} from "../lib/patientMonitoring";
import { sendToAppsScript, DEFAULT_WEB_APP_URL } from "../lib/googleSheets";
import { addToOfflineQueue, isAppOnline } from "../lib/offlineSyncService";
import { getWebAppUrl } from "../lib/config";
import { DEFAULT_PELAKSANA_NAMA, DEFAULT_PELAKSANA_NIP } from "./SignatureData";

interface PatientUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientMonitoringItem | null;
  currentUser: UserAccessProfile;
  onPatientUpdated: (updated: PatientMonitoringItem) => void;
  onOpenFullFormEdit: (patient: PatientMonitoringItem) => void;
  webAppUrl?: string;
}

export const PatientUpdateModal: React.FC<PatientUpdateModalProps> = ({
  isOpen,
  onClose,
  patient,
  currentUser,
  onPatientUpdated,
  onOpenFullFormEdit,
  webAppUrl
}) => {
  const [statusPemantauan, setStatusPemantauan] = useState<StatusPemantauanPasien>(
    patient?.statusPemantauan || "Dalam Pemantauan (Aktif)"
  );
  const [statusHewan, setStatusHewan] = useState<StatusHewanObservasi>(
    patient?.statusHewanObservasi || "Sehat / Normal (Observasi)"
  );
  const [hariObservasi, setHariObservasi] = useState<number>(patient?.hariObservasiKe || 1);
  const [kondisiLuka, setKondisiLuka] = useState<string>(patient?.kondisiLuka || "");
  const [kondisiHewanText, setKondisiHewanText] = useState<string>(patient?.kondisiHewan || "");
  const [rekomendasi, setRekomendasi] = useState<string>(patient?.rekomendasi || "");

  // VAR Doses state
  const [jadwalVAR, setJadwalVAR] = useState<{
    dosis0: VarDoseItem;
    dosis3: VarDoseItem;
    dosis7: VarDoseItem;
    dosis21?: VarDoseItem;
  }>(patient?.jadwalVAR || {
    dosis0: { tanggal: "", status: "Belum Diberikan" as const, lokasiPemberian: "", keterangan: "" },
    dosis3: { tanggal: "", status: "Belum Diberikan" as const, lokasiPemberian: "", keterangan: "" },
    dosis7: { tanggal: "", status: "Belum Diberikan" as const, lokasiPemberian: "", keterangan: "" },
    dosis21: { tanggal: "", status: "Belum Diberikan" as const, lokasiPemberian: "", keterangan: "" }
  });

  // Daily Logs state
  const [logsList, setLogsList] = useState<MonitoringDailyLog[]>(patient?.riwayatLog || []);
  const [showAddLog, setShowAddLog] = useState<boolean>(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Sub-form input states
  const [logTanggal, setLogTanggal] = useState<string>(new Date().toISOString().slice(0, 10));
  const [logHariKe, setLogHariKe] = useState<number>(patient?.hariObservasiKe || 1);
  const [logKondisiKorban, setLogKondisiKorban] = useState<string>("Kondisi umum baik, tidak demam.");
  const [logStatusLuka, setLogStatusLuka] = useState<string>("Luka bersih dan mulai mengering.");
  const [logKondisiHewan, setLogKondisiHewan] = useState<string>("Hewan sehat, aktif, nafsu makan baik.");
  const [logSuhu, setLogSuhu] = useState<string>("36.5");
  const [logTindakan, setLogTindakan] = useState<string>("Pemantauan berkala & edukasi perawatan luka.");
  const [logCatatan, setLogCatatan] = useState<string>("");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");
  const [saveErrorMsg, setSaveErrorMsg] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Helper reset seluruh inputan sub-form catatan harian
  const resetLogSubForm = () => {
    setEditingLogId(null);
    setLogTanggal(new Date().toISOString().slice(0, 10));
    setLogHariKe(hariObservasi || patient?.hariObservasiKe || 1);
    setLogKondisiKorban("Kondisi umum baik, tidak demam.");
    setLogStatusLuka(kondisiLuka || "Luka bersih dan mulai mengering.");
    setLogKondisiHewan(kondisiHewanText || "Hewan sehat, aktif, nafsu makan baik.");
    setLogSuhu("36.5");
    setLogTindakan("Pemantauan berkala & edukasi perawatan luka.");
    setLogCatatan("");
  };

  useEffect(() => {
    if (patient) {
      setStatusPemantauan(patient.statusPemantauan);
      setStatusHewan(patient.statusHewanObservasi);
      const obsDay = calculateObservationDay(patient);
      setHariObservasi(obsDay);
      setKondisiLuka(patient.kondisiLuka || "");
      setKondisiHewanText(patient.kondisiHewan || "");
      setRekomendasi(patient.rekomendasi || "");
      setJadwalVAR(patient.jadwalVAR || {
        dosis0: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
        dosis3: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
        dosis7: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
        dosis21: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" }
      });
      const parsedLogs = parseChronologicalLogs(patient);
      setLogsList(parsedLogs);
      setShowAddLog(false);
      setEditingLogId(null);
      resetLogSubForm();
      setSaveSuccessMsg("");
      setSaveErrorMsg("");
      setValidationErrors({});
    }
  }, [patient]);

  const handleClearAllVarDates = () => {
    setJadwalVAR({
      dosis0: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
      dosis3: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
      dosis7: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
      dosis21: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" }
    });
  };

  const handleAutoCalculateVarDates = () => {
    if (!patient) return;
    const baseDateStr = normalizeDateToIso(patient.waktuKejadian || patient.tglMulaiObservasi);
    setJadwalVAR({
      dosis0: { tanggal: baseDateStr, status: "Sudah Diberikan", lokasiPemberian: "Puskesmas Sananwetan" },
      dosis3: { tanggal: normalizeDateToIso(baseDateStr, 3), status: "Terjadwal", lokasiPemberian: "Puskesmas Sananwetan" },
      dosis7: { tanggal: normalizeDateToIso(baseDateStr, 7), status: "Terjadwal", lokasiPemberian: "Puskesmas Sananwetan" },
      dosis21: { tanggal: normalizeDateToIso(baseDateStr, 21), status: "Belum Diberikan", lokasiPemberian: "Puskesmas Sananwetan" }
    });
  };

  const handleUpdateVarDose = (
    doseKey: "dosis0" | "dosis3" | "dosis7" | "dosis21",
    field: keyof VarDoseItem,
    value: string
  ) => {
    setJadwalVAR((prev) => ({
      ...prev,
      [doseKey]: {
        ...prev[doseKey],
        [field]: value
      }
    }));
  };

  // Handler untuk Buka Form Catatan Baru (Membersihkan Form dari data sebelumnya secara tuntas)
  const handleOpenNewLogForm = () => {
    resetLogSubForm();
    setShowAddLog(true);
  };

  // Handler untuk Memulai Edit Catatan yang Sudah Ada
  const handleStartEditLog = (log: MonitoringDailyLog) => {
    const targetId = log.id || `log-${log.tanggal}-${log.hariKe}`;
    log.id = targetId;
    setEditingLogId(targetId);
    setLogTanggal(log.tanggal || new Date().toISOString().slice(0, 10));
    setLogHariKe(log.hariKe || 1);
    setLogKondisiKorban(log.kondisiKorban || "");
    setLogStatusLuka(log.statusLuka || "");
    setLogKondisiHewan(log.kondisiHewan || "");
    setLogSuhu((log.suhuTubuh || "").replace(" °C", "").replace("°C", "").trim() || "36.5");
    setLogTindakan(log.tindakanDilakukan || "");
    setLogCatatan(log.catatanKhusus || "");
    setShowAddLog(true);
  };

  // Handler untuk Menyimpan Catatan Baru atau Perubahan Edit ke logsList
  const handleSaveLogItem = () => {
    if (!patient) return;

    const formattedSuhu = logSuhu.trim() ? (logSuhu.includes("°C") ? logSuhu.trim() : `${logSuhu.trim()} °C`) : "36.5 °C";

    if (editingLogId) {
      // Update item yang sedang diedit
      setLogsList((prev) =>
        prev.map((item) => {
          const itemId = item.id || `log-${item.tanggal}-${item.hariKe}`;
          if (itemId === editingLogId || item.id === editingLogId) {
            return {
              ...item,
              id: item.id || editingLogId,
              tanggal: logTanggal,
              hariKe: Number(logHariKe) || 1,
              petugasNama: currentUser.nama || item.petugasNama,
              petugasNIP: currentUser.nip || item.petugasNIP,
              kondisiKorban: logKondisiKorban,
              statusLuka: logStatusLuka,
              kondisiHewan: logKondisiHewan,
              suhuTubuh: formattedSuhu,
              tindakanDilakukan: logTindakan,
              catatanKhusus: logCatatan
            };
          }
          return item;
        })
      );
    } else {
      // Tambah item catatan baru
      const newLog: MonitoringDailyLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tanggal: logTanggal,
        hariKe: Number(logHariKe) || 1,
        petugasNama: currentUser.nama,
        petugasNIP: currentUser.nip,
        kelurahan: patient.kelurahan,
        kondisiKorban: logKondisiKorban,
        statusLuka: logStatusLuka || kondisiLuka,
        kondisiHewan: logKondisiHewan,
        suhuTubuh: formattedSuhu,
        tindakanDilakukan: logTindakan,
        catatanKhusus: logCatatan
      };
      setLogsList((prev) => [...prev, newLog]);
    }

    if (logStatusLuka && !kondisiLuka) setKondisiLuka(logStatusLuka);
    if (logKondisiHewan && !kondisiHewanText) setKondisiHewanText(logKondisiHewan);
    if (Number(logHariKe) > Number(hariObservasi)) setHariObservasi(Number(logHariKe));

    // Reset dan tutup form catatan secara bersih
    resetLogSubForm();
    setShowAddLog(false);
  };

  // Handler untuk Menghapus Catatan
  const handleDeleteLogItem = (targetLog: MonitoringDailyLog, index: number) => {
    const targetId = targetLog.id || `log-${targetLog.tanggal}-${targetLog.hariKe}`;
    if (window.confirm(`Apakah Anda yakin ingin menghapus catatan hari ke-${targetLog.hariKe} (${targetLog.tanggal})?`)) {
      setLogsList((prev) => prev.filter((item, idx) => {
        const itemId = item.id || `log-${item.tanggal}-${item.hariKe}`;
        return itemId !== targetId && item.id !== targetId && idx !== index;
      }));
      if (editingLogId === targetId) {
        resetLogSubForm();
        setShowAddLog(false);
      }
    }
  };

  const handleSaveAllUpdates = async () => {
    if (!patient || isSaving) return;

    setSaveSuccessMsg("");
    setSaveErrorMsg("");

    const errors: Record<string, string> = {};
    if (!statusPemantauan) errors.statusPemantauan = "Wajib dipilih";
    if (!statusHewan) errors.statusHewan = "Wajib dipilih";
    if (!kondisiLuka || !kondisiLuka.trim()) errors.kondisiLuka = "Wajib pilih kondisi luka korban";
    if (!kondisiHewanText || !kondisiHewanText.trim()) errors.kondisiHewanText = "Wajib isi catatan kondisi hewan";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setSaveErrorMsg("Mohon lengkapi isian bertanda bintang (*) sebelum menyimpan update pemantauan.");
      const contentEl = document.getElementById("patient-update-modal-scroll");
      if (contentEl) contentEl.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setValidationErrors({});
    setIsSaving(true);

    let updatedLogs = [...logsList];

    // Jika form log baru atau edit sedang terbuka saat menekan tombol Simpan Utama
    if (showAddLog) {
      const formattedSuhu = logSuhu.trim() ? (logSuhu.includes("°C") ? logSuhu.trim() : `${logSuhu.trim()} °C`) : "36.5 °C";
      if (editingLogId) {
        updatedLogs = updatedLogs.map((item) => {
          const itemId = item.id || `log-${item.tanggal}-${item.hariKe}`;
          if (itemId === editingLogId || item.id === editingLogId) {
            return {
              ...item,
              id: item.id || editingLogId,
              tanggal: logTanggal,
              hariKe: Number(logHariKe) || 1,
              petugasNama: currentUser.nama || item.petugasNama,
              petugasNIP: currentUser.nip || item.petugasNIP,
              kondisiKorban: logKondisiKorban,
              statusLuka: logStatusLuka,
              kondisiHewan: logKondisiHewan,
              suhuTubuh: formattedSuhu,
              tindakanDilakukan: logTindakan,
              catatanKhusus: logCatatan
            };
          }
          return item;
        });
      } else if (logCatatan.trim() || logKondisiKorban.trim() || logTindakan.trim()) {
        const newLog: MonitoringDailyLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tanggal: logTanggal,
          hariKe: Number(logHariKe) || 1,
          petugasNama: currentUser.nama,
          petugasNIP: currentUser.nip,
          kelurahan: patient.kelurahan,
          kondisiKorban: logKondisiKorban,
          statusLuka: logStatusLuka || kondisiLuka,
          kondisiHewan: logKondisiHewan,
          suhuTubuh: formattedSuhu,
          tindakanDilakukan: logTindakan,
          catatanKhusus: logCatatan
        };
        updatedLogs.push(newLog);
      }
    }

    // Pastikan log bersih, terurut, dan tidak ganda
    updatedLogs = deduplicateAndSortLogs(updatedLogs);

    const updatedItem: PatientMonitoringItem = {
      ...patient,
      statusPemantauan,
      statusHewanObservasi: statusHewan,
      hariObservasiKe: Number(hariObservasi),
      kondisiLuka,
      kondisiHewan: kondisiHewanText,
      rekomendasi,
      jadwalVAR,
      riwayatLog: updatedLogs,
      petugasPJ: currentUser.nama,
      nipPJ: currentUser.nip,
      lastUpdated: new Date().toLocaleString("id-ID")
    };

    // 1. Simpan ke Local Storage Monitoring
    upsertPatient(updatedItem);

    // 2. Siapkan Payload Update Komprehensif untuk Google Spreadsheet
    const rawData: Record<string, any> = patient.fullData || {};

    // Format Data Pemantauan Tambahan (Kolom 37 - 46)
    const catatanLogText = updatedLogs.length > 0
      ? updatedLogs.map((log: any, idx: number) => `[${log.tanggal || `Hari ke-${log.hariKe || idx + 1}`}] ${log.petugasNama ? `(${log.petugasNama})` : ""} Kondisi: ${log.kondisiKorban || log.statusLuka || "-"}, Suhu: ${log.suhuTubuh ? `${log.suhuTubuh}` : "-"}, Hewan: ${log.kondisiHewan || "-"}, Tindakan: ${log.tindakanDilakukan || "-"}, Catatan: ${log.catatanKhusus || "-"}`).join("\n\n")
      : "-";

    const var0Text = jadwalVAR?.dosis0?.status ? `${jadwalVAR.dosis0.status}${jadwalVAR.dosis0.tanggal ? ` (${jadwalVAR.dosis0.tanggal})` : ""}${jadwalVAR.dosis0.lokasiPemberian ? ` - ${jadwalVAR.dosis0.lokasiPemberian}` : ""}` : "-";
    const var3Text = jadwalVAR?.dosis3?.status ? `${jadwalVAR.dosis3.status}${jadwalVAR.dosis3.tanggal ? ` (${jadwalVAR.dosis3.tanggal})` : ""}${jadwalVAR.dosis3.lokasiPemberian ? ` - ${jadwalVAR.dosis3.lokasiPemberian}` : ""}` : "-";
    const var7Text = jadwalVAR?.dosis7?.status ? `${jadwalVAR.dosis7.status}${jadwalVAR.dosis7.tanggal ? ` (${jadwalVAR.dosis7.tanggal})` : ""}${jadwalVAR.dosis7.lokasiPemberian ? ` - ${jadwalVAR.dosis7.lokasiPemberian}` : ""}` : "-";
    const var21Text = jadwalVAR?.dosis21?.status ? `${jadwalVAR.dosis21.status}${jadwalVAR.dosis21.tanggal ? ` (${jadwalVAR.dosis21.tanggal})` : ""}${jadwalVAR.dosis21.lokasiPemberian ? ` - ${jadwalVAR.dosis21.lokasiPemberian}` : ""}` : "-";
    const lastUpdateTimestamp = new Date().toLocaleString("id-ID");
    const latestLogDate = updatedLogs.length > 0 && updatedLogs[0].tanggal
      ? updatedLogs[0].tanggal
      : new Date().toISOString().slice(0, 10);

    const updatePayload: SubmissionPayload = {
      id_kasus: patient.id_kasus,
      timestamp_submit: patient.timestamp_submit || new Date().toISOString(),
      waktuKejadian: patient.waktuKejadian || rawData.waktuKejadian || "",
      alamatKejadian: patient.alamatKorban || rawData.alamatKejadian || patient.kelurahan || "",
      kelurahan: patient.kelurahan,
      kelurahanCustom: rawData.kelurahanCustom || "",
      kelurahan_final: patient.kelurahan,
      kecamatan: patient.kecamatan || "Sananwetan",
      kecamatanCustom: rawData.kecamatanCustom || "",
      kecamatan_final: patient.kecamatan || "Sananwetan",
      kabupatenKota: patient.kabupatenKota || "Kota Blitar",
      kabupatenKotaCustom: rawData.kabupatenKotaCustom || "",
      kabupatenKota_final: patient.kabupatenKota || "Kota Blitar",
      provinsi: "Jawa Timur",
      sumberInfo: rawData.sumberInfo || "Laporan Petugas Puskesmas",
      kronologi: rawData.kronologi || `Kasus gigitan HPR di wilayah Kel. ${patient.kelurahan}`,
      spesiesHPR: patient.spesiesHPR || "Anjing",
      spesiesLain: rawData.spesiesLain || "",
      spesies_final: patient.spesiesHPR || "Anjing",
      ras: patient.rasHewan || rawData.ras || "-",
      jkHewan: rawData.jkHewan || "Jantan",
      umurHewan: rawData.umurHewan || "2",
      satuanUmur: rawData.satuanUmur || "Tahun",
      metodePelihara: rawData.metodePelihara || "Diliarkan / Bebas",
      asalHewan: rawData.asalHewan || "-",
      pakan: rawData.pakan || "-",
      biosekuriti: rawData.biosekuriti || "-",
      sumberAir: rawData.sumberAir || "-",
      kondisiHewan: kondisiHewanText,
      riwayatVaksin: rawData.riwayatVaksin || "Tidak Tahu",
      tanggalVaksin: rawData.tanggalVaksin || "-",
      pemilikHewan: patient.pemilikHewan || "-",
      alamatPemilik: patient.alamatPemilik || "-",
      kontakPemilik: patient.kontakPemilik || "-",
      namaKorban: patient.namaKorban,
      noHpKorban: patient.noHpKorban || patient.kontakKorban || "-",
      umurKorban: patient.umurKorban,
      alamatKorban: patient.alamatKorban,
      jkKorban: patient.jkKorban,
      kondisiKorban: rawData.kondisiKorban || "Sadar Baik",
      kondisiLuka: kondisiLuka, // Data Kondisi Luka yang baru diganti!
      lokasiLuka: patient.lokasiLuka || "-",
      pertolonganPertama: patient.pertolonganPertama || "-",
      detailPertolongan: patient.detailPertolongan || "",
      tindakanKasus: patient.tindakanKasus || "-",
      tindakanHPR: patient.tindakanHPR || "Observasi 14 Hari",
      tindakanMasyarakat: rawData.tindakanMasyarakat || "Edukasi Bahaya Rabies",
      rekomendasi: rekomendasi,
      sumberLaporan: rawData.sumberLaporan || "Puskesmas",
      timKetua: rawData.timKetua || currentUser.nama,
      timAnggota: rawData.timAnggota || "Petugas Surveilans",
      tanggalPelaksanaan: rawData.tanggalPelaksanaan || new Date().toISOString().slice(0, 10),
      pelaksanaNama: DEFAULT_PELAKSANA_NAMA,
      pelaksanaNIP: DEFAULT_PELAKSANA_NIP,
      statusPemantauan,
      hariObservasi: Number(hariObservasi),
      hariObservasiKe: Number(hariObservasi),
      hariPemantauan: Number(hariObservasi),
      tanggalPemantauan: latestLogDate || new Date().toISOString().slice(0, 10),
      tanggalObservasi: latestLogDate || new Date().toISOString().slice(0, 10),
      statusHewanObservasi: statusHewan,
      jadwalVAR_0: var0Text,
      jadwalVAR_3: var3Text,
      jadwalVAR_7: var7Text,
      jadwalVAR_21: var21Text,
      catatanPerkembanganHarian: catatanLogText,
      petugasPJMonitoring: currentUser.nama ? `${currentUser.nama}${currentUser.nip ? ` (${currentUser.nip})` : ""}` : (patient.petugasPJ || DEFAULT_PELAKSANA_NAMA),
      nipPJMonitoring: currentUser.nip || patient.nipPJ || DEFAULT_PELAKSANA_NIP,
      lastUpdated: lastUpdateTimestamp,
      // Header names untuk Google Spreadsheet
      "Status Pemantauan": statusPemantauan,
      "Hari Observasi": Number(hariObservasi),
      "Hari Pemantauan": Number(hariObservasi),
      "Tanggal Pemantauan": latestLogDate || new Date().toISOString().slice(0, 10),
      "Tanggal Observasi": latestLogDate || new Date().toISOString().slice(0, 10),
      "Status Hewan Observasi": statusHewan,
      "Jadwal VAR Dosis 0": var0Text,
      "Jadwal VAR Dosis 3": var3Text,
      "Jadwal VAR Dosis 7": var7Text,
      "Jadwal VAR Dosis 21": var21Text,
      "Catatan Perkembangan Harian": catatanLogText,
      "Petugas PJ Monitoring": currentUser.nama ? `${currentUser.nama}${currentUser.nip ? ` (${currentUser.nip})` : ""}` : (patient.petugasPJ || DEFAULT_PELAKSANA_NAMA),
      "Terakhir Diperbarui": lastUpdateTimestamp,
      action: "update",
      is_update: true
    } as any;

    // 3. Update Riwayat Pengiriman Lokal
    try {
      const savedHistory = localStorage.getItem("ghpr_recorded_submissions") || "[]";
      const parsed = JSON.parse(savedHistory);
      const existingIdx = parsed.findIndex((item: any) => item.id_kasus === patient.id_kasus);
      if (existingIdx >= 0) {
        parsed[existingIdx] = {
          ...parsed[existingIdx],
          ...updatePayload,
          kondisiLuka,
          kondisiHewan: kondisiHewanText,
          rekomendasi,
          timestamp_recorded: new Date().toISOString()
        };
      } else {
        parsed.unshift({
          ...updatePayload,
          kondisiLuka,
          timestamp_recorded: new Date().toISOString()
        });
      }
      localStorage.setItem("ghpr_recorded_submissions", JSON.stringify(parsed));
    } catch (e) {
      console.warn("Gagal update local submission history:", e);
    }

    // 4. Sinkronisasi Langsung ke Google Sheets / Google Apps Script atau Masuk Antrean Offline
    const targetUrl = (webAppUrl || getWebAppUrl() || DEFAULT_WEB_APP_URL || "").trim();
    let sheetSyncSuccess = false;
    const onlineNow = isAppOnline();

    if (!onlineNow) {
      // Tambahkan ke antrean offline jika sedang tanpa koneksi
      addToOfflineQueue({
        type: showAddLog && logCatatan.trim() ? "daily_log" : "update_var",
        caseId: patient.id_kasus,
        patientName: patient.namaKorban,
        kelurahan: patient.kelurahan,
        payload: updatePayload
      });
    } else if (targetUrl && targetUrl.includes("script.google.com")) {
      try {
        await sendToAppsScript(targetUrl, updatePayload, "update");
        sheetSyncSuccess = true;
      } catch (err: any) {
        console.warn("Sinkronisasi Apps Script gagal saat update, masuk antrean offline:", err);
        addToOfflineQueue({
          type: showAddLog && logCatatan.trim() ? "daily_log" : "update_var",
          caseId: patient.id_kasus,
          patientName: patient.namaKorban,
          kelurahan: patient.kelurahan,
          payload: updatePayload
        });
      }
    }

    onPatientUpdated(updatedItem);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ghpr_patient_data_updated", { detail: { updatedItem } }));
    }

    if (sheetSyncSuccess) {
      setSaveSuccessMsg(`Data pasien & catatan pemantauan berhasil disinkronkan ke Google Spreadsheet!`);
    } else if (!onlineNow) {
      setSaveSuccessMsg(`Mode Offline: Pembaruan pasien disimpan ke memori lokal & antrean sinkronisasi. Otomatis terkirim saat online!`);
    } else {
      setSaveSuccessMsg(`Data pasien dan catatan harian berhasil diperbarui di sistem pemantauan lokal!`);
    }

    setIsSaving(false);
    setTimeout(() => {
      setSaveSuccessMsg("");
      onClose();
    }, 1500);
  };

  if (!isOpen || !patient) return null;

  return (
    <div
      id="patient-update-modal-overlay"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="patient-update-modal-content"
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-blue-700">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-blue-200">
              <HeartPulse size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Update Pemantauan Pasien GHPR
                <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-500/40 text-blue-100 border border-blue-400/30 px-2 py-0.5 rounded">
                  Kel. {patient.kelurahan}
                </span>
              </h3>
              <p className="text-xs text-blue-200">
                {patient.namaKorban} ({patient.umurKorban} Th) • ID: <span className="font-mono">{patient.id_kasus}</span>
              </p>
            </div>
          </div>
          <button
            id="btn-close-patient-update-modal"
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div id="patient-update-modal-scroll" className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {saveSuccessMsg && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {saveErrorMsg && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-800 flex items-center gap-2 font-bold animate-in fade-in">
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
              <span>{saveErrorMsg}</span>
            </div>
          )}

          {/* Quick Summary Banner */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-semibold text-[11px]">KORBAN & LOKASI</span>
              <span className="font-bold text-slate-800">{patient.namaKorban} ({patient.jkKorban})</span>
              <p className="text-slate-500 truncate">{patient.alamatKorban || patient.kelurahan}</p>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold text-[11px]">HEWAN PENULAR (HPR)</span>
              <span className="font-bold text-slate-800">{patient.spesiesHPR} {patient.rasHewan ? `(${patient.rasHewan})` : ""}</span>
              <p className="text-slate-500 truncate">Pemilik: {patient.pemilikHewan || "Tidak Diketahui"}</p>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold text-[11px]">MASA OBSERVASI 14 HARI</span>
              <span className="font-bold text-blue-700">
                Hari ke-{hariObservasi} dari 14 Hari
              </span>
              <p className="text-slate-500">Mulai: {patient.tglMulaiObservasi || "-"}</p>
            </div>
          </div>

          {/* 1. Status Utama Pemantauan */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Activity size={14} className="text-blue-600" />
              1. Status Pemantauan & Perkembangan
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Status Pemantauan Pasien */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  <span>Status Pemantauan Korban:</span>
                  <span className="text-rose-500 font-bold ml-1 text-sm leading-none" title="Wajib diisi">*</span>
                </label>
                <select
                  id="select-status-pemantauan"
                  value={statusPemantauan}
                  onChange={(e) => {
                    setStatusPemantauan(e.target.value as StatusPemantauanPasien);
                    if (validationErrors.statusPemantauan) {
                      setValidationErrors((prev) => ({ ...prev, statusPemantauan: "" }));
                    }
                  }}
                  className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    validationErrors.statusPemantauan ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                  }`}
                >
                  <option value="Dalam Pemantauan (Aktif)">Dalam Pemantauan (Aktif)</option>
                  <option value="Selesai Observasi (14 Hari)">Selesai Observasi (14 Hari - Sembuh & Aman)</option>
                  <option value="Perlu Follow-up VAR">Perlu Follow-up VAR (Jadwal Mendatang / Tertunda)</option>
                  <option value="Dirujuk / Perawatan Lanjut">Dirujuk / Perawatan Lanjut</option>
                  <option value="Meninggal Dunia (Kasus Rabies)">Meninggal Dunia (Kasus Rabies)</option>
                </select>
                {validationErrors.statusPemantauan && (
                  <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                    <AlertTriangle size={12} /> {validationErrors.statusPemantauan}
                  </span>
                )}
              </div>

              {/* Status Hewan Observasi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  <span>Status Hewan HPR (Observasi 14 Hari):</span>
                  <span className="text-rose-500 font-bold ml-1 text-sm leading-none" title="Wajib diisi">*</span>
                </label>
                <select
                  id="select-status-hewan"
                  value={statusHewan}
                  onChange={(e) => {
                    setStatusHewan(e.target.value as StatusHewanObservasi);
                    if (validationErrors.statusHewan) {
                      setValidationErrors((prev) => ({ ...prev, statusHewan: "" }));
                    }
                  }}
                  className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                    validationErrors.statusHewan ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                  }`}
                >
                  <option value="Sehat / Normal (Observasi)">Sehat / Normal (Dalam Observasi)</option>
                  <option value="Mati dalam 14 Hari">Mati dalam 14 Hari (Waspada Rabies)</option>
                  <option value="Hilang / Kabur">Hilang / Kabur (Hewan Liar)</option>
                  <option value="Positif Rabies (FAT Lab)">Positif Rabies (Hasil Uji Lab FAT)</option>
                  <option value="Hewan Dieliminasi">Hewan Dieliminasi</option>
                </select>
                {validationErrors.statusHewan && (
                  <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                    <AlertTriangle size={12} /> {validationErrors.statusHewan}
                  </span>
                )}
              </div>
            </div>

            {/* Slider / Input Hari Observasi */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Kemajuan Observasi Hari Ke:</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                  Hari Ke-{hariObservasi} / 14
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={14}
                value={hariObservasi}
                onChange={(e) => setHariObservasi(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-1">
                <span>Hari 1 (Gigitan)</span>
                <span>Hari 7 (VAR Dosis 3)</span>
                <span>Hari 14 (Tuntas Observasi)</span>
              </div>
            </div>

            {/* Kondisi Luka & Hewan saat ini */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  <span>Kondisi Luka Korban Saat Ini:</span>
                  <span className="text-rose-500 font-bold ml-1 text-sm leading-none" title="Wajib diisi">*</span>
                </label>
                <div className="space-y-1.5">
                  <select
                    id="select-kondisi-luka-modal"
                    value={kondisiLuka}
                    onChange={(e) => {
                      setKondisiLuka(e.target.value);
                      if (validationErrors.kondisiLuka) {
                        setValidationErrors((prev) => ({ ...prev, kondisiLuka: "" }));
                      }
                    }}
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      validationErrors.kondisiLuka ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                    }`}
                  >
                    <option value="">-- Pilih Kondisi Luka --</option>
                    <option value="Kategori 1">Kategori 1 (Menyentuh/Menjilat Kulit Utuh / Luka Sangat Ringan)</option>
                    <option value="Kategori 2">Kategori 2 (Gigitan / Cakaran Dangkal / Tidak Berdarah Parah)</option>
                    <option value="Kategori 3">Kategori 3 (Luka Robek Dalam / Multiple / Mukosa / Berdarah Aktif)</option>
                    <option value="Kategori 4">Kategori 4 (Gigitan Risiko Sangat Tinggi / Leher, Muka, Jari)</option>
                  </select>
                  {validationErrors.kondisiLuka && (
                    <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle size={12} /> {validationErrors.kondisiLuka}
                    </span>
                  )}
                  {/* Quick Select Chips */}
                  <div className="flex flex-wrap gap-1.5 items-center pt-0.5">
                    {[
                      "Kategori 1",
                      "Kategori 2",
                      "Kategori 3",
                      "Kategori 4"
                    ].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setKondisiLuka(opt);
                          if (validationErrors.kondisiLuka) {
                            setValidationErrors((prev) => ({ ...prev, kondisiLuka: "" }));
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition cursor-pointer ${
                          kondisiLuka === opt || kondisiLuka.startsWith(opt)
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                            : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  <span>Catatan Kondisi Hewan:</span>
                  <span className="text-rose-500 font-bold ml-1 text-sm leading-none" title="Wajib diisi">*</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={kondisiHewanText}
                    onChange={(e) => {
                      setKondisiHewanText(e.target.value);
                      if (validationErrors.kondisiHewanText) {
                        setValidationErrors((prev) => ({ ...prev, kondisiHewanText: "" }));
                      }
                    }}
                    placeholder="Contoh: Anjing sehat diikat, makan normal"
                    className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      validationErrors.kondisiHewanText ? "border-rose-400 bg-rose-50/40" : "border-slate-300"
                    }`}
                  />
                  {validationErrors.kondisiHewanText && (
                    <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertTriangle size={12} /> {validationErrors.kondisiHewanText}
                    </span>
                  )}
                  {/* Quick Select Chips Hewan */}
                  <div className="flex flex-wrap gap-1 items-center pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Pilihan:</span>
                    {[
                      "Sehat & aktif (dikandangkan/diikat)",
                      "Nafsu makan baik, tidak agresif",
                      "Mati dalam masa observasi",
                      "Hilang / kabur"
                    ].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setKondisiHewanText(opt);
                          if (validationErrors.kondisiHewanText) {
                            setValidationErrors((prev) => ({ ...prev, kondisiHewanText: "" }));
                          }
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border font-medium transition cursor-pointer ${
                          kondisiHewanText.toLowerCase() === opt.toLowerCase()
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Jadwal & Status Vaksin Anti Rabies (VAR) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Syringe size={14} className="text-emerald-600" />
                  2. Jadwal & Pemberian Vaksin Anti Rabies (VAR)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Isi tanggal dan status pemberian VAR sesuai riwayat/rencana vaksinasi korban.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearAllVarDates}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                  title="Kosongkan seluruh isian tanggal VAR"
                >
                  Kosongkan Jadwal
                </button>
                <button
                  type="button"
                  onClick={handleAutoCalculateVarDates}
                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1"
                  title="Bantu isi tanggal otomatis berdasarkan tanggal kejadian (H+0, H+3, H+7, H+21)"
                >
                  <RefreshCw size={11} />
                  Hitung Otomatis
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Dosis 0 */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">VAR Dosis 0 (Hari ke-0)</span>
                  <span className="text-[10px] text-slate-400 font-medium">2 Injeksi IM</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Tanggal</label>
                    <input
                      type="date"
                      value={jadwalVAR.dosis0?.tanggal || ""}
                      onChange={(e) => handleUpdateVarDose("dosis0", "tanggal", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Status</label>
                    <select
                      value={jadwalVAR.dosis0?.status || "Belum Diberikan"}
                      onChange={(e) => handleUpdateVarDose("dosis0", "status", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Belum Diberikan">Belum Diberikan</option>
                      <option value="Terjadwal">Terjadwal</option>
                      <option value="Sudah Diberikan">Sudah Diberikan</option>
                      <option value="Tidak Perlu">Tidak Perlu</option>
                    </select>
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Lokasi faskes / Keterangan batch (opsional)"
                    value={jadwalVAR.dosis0?.lokasiPemberian || ""}
                    onChange={(e) => handleUpdateVarDose("dosis0", "lokasiPemberian", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Dosis 3 */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">VAR Dosis 3 (Hari ke-3)</span>
                  <span className="text-[10px] text-slate-400 font-medium">1 Injeksi IM</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Tanggal</label>
                    <input
                      type="date"
                      value={jadwalVAR.dosis3?.tanggal || ""}
                      onChange={(e) => handleUpdateVarDose("dosis3", "tanggal", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Status</label>
                    <select
                      value={jadwalVAR.dosis3?.status || "Belum Diberikan"}
                      onChange={(e) => handleUpdateVarDose("dosis3", "status", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Belum Diberikan">Belum Diberikan</option>
                      <option value="Terjadwal">Terjadwal</option>
                      <option value="Sudah Diberikan">Sudah Diberikan</option>
                      <option value="Tidak Perlu">Tidak Perlu</option>
                    </select>
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Lokasi faskes / Keterangan batch (opsional)"
                    value={jadwalVAR.dosis3?.lokasiPemberian || ""}
                    onChange={(e) => handleUpdateVarDose("dosis3", "lokasiPemberian", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Dosis 7 */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">VAR Dosis 7 (Hari ke-7)</span>
                  <span className="text-[10px] text-slate-400 font-medium">1 Injeksi IM</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Tanggal</label>
                    <input
                      type="date"
                      value={jadwalVAR.dosis7?.tanggal || ""}
                      onChange={(e) => handleUpdateVarDose("dosis7", "tanggal", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Status</label>
                    <select
                      value={jadwalVAR.dosis7?.status || "Belum Diberikan"}
                      onChange={(e) => handleUpdateVarDose("dosis7", "status", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Belum Diberikan">Belum Diberikan</option>
                      <option value="Terjadwal">Terjadwal</option>
                      <option value="Sudah Diberikan">Sudah Diberikan</option>
                      <option value="Tidak Perlu">Tidak Perlu</option>
                    </select>
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Lokasi faskes / Keterangan batch (opsional)"
                    value={jadwalVAR.dosis7?.lokasiPemberian || ""}
                    onChange={(e) => handleUpdateVarDose("dosis7", "lokasiPemberian", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Dosis 21 */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">VAR Dosis 21 (Bila Hewan Positif/Mati)</span>
                  <span className="text-[10px] text-slate-400 font-medium">Opsional</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Tanggal</label>
                    <input
                      type="date"
                      value={jadwalVAR.dosis21?.tanggal || ""}
                      onChange={(e) => handleUpdateVarDose("dosis21", "tanggal", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block">Status</label>
                    <select
                      value={jadwalVAR.dosis21?.status || "Belum Diberikan"}
                      onChange={(e) => handleUpdateVarDose("dosis21", "status", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Belum Diberikan">Belum Diberikan</option>
                      <option value="Terjadwal">Terjadwal</option>
                      <option value="Sudah Diberikan">Sudah Diberikan</option>
                      <option value="Tidak Perlu">Tidak Perlu</option>
                    </select>
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Lokasi faskes / Keterangan batch (opsional)"
                    value={jadwalVAR.dosis21?.lokasiPemberian || ""}
                    onChange={(e) => handleUpdateVarDose("dosis21", "lokasiPemberian", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Riwayat & Tambah Catatan Pemantauan Harian */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <History size={14} className="text-indigo-600" />
                3. Log Catatan Perkembangan Harian
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                  {logsList.length} Catatan
                </span>
              </h4>
              <button
                type="button"
                id="btn-toggle-add-log"
                onClick={() => {
                  if (showAddLog && !editingLogId) {
                    setShowAddLog(false);
                  } else {
                    handleOpenNewLogForm();
                  }
                }}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition cursor-pointer"
              >
                <PlusCircle size={14} />
                <span>{showAddLog && !editingLogId ? "Tutup Form" : "+ Tambah Catatan Baru"}</span>
              </button>
            </div>

            {/* Sub-form input catatan perkembangan baru / edit catatan */}
            {showAddLog && (
              <div className="rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between text-xs font-bold text-blue-950 border-b border-blue-200/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                      {editingLogId ? <Edit3 size={13} /> : <PlusCircle size={13} />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-blue-900">
                        {editingLogId ? `Edit Catatan Perkembangan (Hari ke-${logHariKe})` : "Input Catatan Perkembangan Baru"}
                      </span>
                      <p className="text-[10px] font-normal text-blue-700">
                        {editingLogId ? "Perbarui informasi observasi log ini" : "Form bersih siap untuk diisi catatan hari ini"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-blue-800 bg-blue-100/80 px-2.5 py-0.5 rounded-md border border-blue-200">
                      Petugas: {currentUser.nama}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        resetLogSubForm();
                        setShowAddLog(false);
                      }}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-white/60 transition"
                      title="Batal"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Tanggal Pemantauan</label>
                    <input
                      type="date"
                      value={logTanggal}
                      onChange={(e) => setLogTanggal(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Observasi Hari Ke (1-14)</label>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={logHariKe}
                      onChange={(e) => setLogHariKe(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Suhu Tubuh Korban (°C)</label>
                    <input
                      type="text"
                      value={logSuhu}
                      onChange={(e) => setLogSuhu(e.target.value)}
                      placeholder="Contoh: 36.5"
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Kondisi Korban & Luka</label>
                    <input
                      type="text"
                      value={logKondisiKorban}
                      onChange={(e) => setLogKondisiKorban(e.target.value)}
                      placeholder="Contoh: Kondisi baik, luka mengering"
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Kondisi Hewan (HPR)</label>
                    <input
                      type="text"
                      value={logKondisiHewan}
                      onChange={(e) => setLogKondisiHewan(e.target.value)}
                      placeholder="Contoh: Hewan sehat, nafsu makan baik"
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Tindakan / Edukasi yang Diberikan</label>
                  <input
                    type="text"
                    value={logTindakan}
                    onChange={(e) => setLogTindakan(e.target.value)}
                    placeholder="Contoh: Pembersihan luka berkala & edukasi rabies"
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Catatan Khusus Perkembangan Korban / Hewan</label>
                  <textarea
                    rows={2}
                    value={logCatatan}
                    onChange={(e) => setLogCatatan(e.target.value)}
                    placeholder="Tuliskan evaluasi perkembangan luka, keluhan korban, atau keterangan observasi hewan..."
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs"
                  />
                </div>

                {/* Tombol Simpan / Batal Form Catatan */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetLogSubForm();
                      setShowAddLog(false);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    id="btn-save-log-item"
                    onClick={handleSaveLogItem}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <Check size={14} />
                    <span>{editingLogId ? "Simpan Perubahan Catatan" : "Tambahkan ke Daftar Catatan"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Riwayat Logs dengan Tombol Edit ditiap Catatan */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {logsList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center">
                  <p className="text-xs text-slate-500 font-medium">Belum ada riwayat catatan harian yang tersimpan.</p>
                  <button
                    type="button"
                    onClick={handleOpenNewLogForm}
                    className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                  >
                    + Buat Catatan Pertama Sekarang
                  </button>
                </div>
              ) : (
                logsList.map((log, idx) => {
                  const targetId = log.id || `log-${log.tanggal}-${log.hariKe}`;
                  const isCurrentEditing = editingLogId === targetId;

                  return (
                    <div
                      key={targetId}
                      className={`rounded-xl border p-3 text-xs space-y-1.5 transition ${
                        isCurrentEditing
                          ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-500/20"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                            Hari ke-{log.hariKe} • {log.tanggal}
                          </span>
                          {log.suhuTubuh && (
                            <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              🌡️ {log.suhuTubuh}
                            </span>
                          )}
                          <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            Petugas: {log.petugasNama || "-"}
                          </span>
                        </div>

                        {/* Kolom Tombol Edit & Hapus ditiap Catatan */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            id={`btn-edit-log-${idx}`}
                            onClick={() => handleStartEditLog(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                            title="Edit catatan observasi ini"
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-log-${idx}`}
                            onClick={() => handleDeleteLogItem(log, idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer"
                            title="Hapus catatan ini"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600 pt-0.5">
                        <div>
                          <span className="font-semibold text-slate-700">Korban & Luka:</span> {log.kondisiKorban || log.statusLuka || "-"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">Kondisi HPR:</span> {log.kondisiHewan || "-"}
                        </div>
                      </div>

                      {log.tindakanDilakukan && (
                        <div className="text-slate-600 text-[11px]">
                          <span className="font-semibold text-slate-700">Tindakan:</span> {log.tindakanDilakukan}
                        </div>
                      )}

                      {log.catatanKhusus && (
                        <p className="text-slate-700 italic bg-slate-50 border border-slate-100 p-2 rounded-lg text-[11px]">
                          "{log.catatanKhusus}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              onOpenFullFormEdit(patient);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <Edit3 size={13} />
            <span>Edit Form Lengkap PE GHPR</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              id="btn-save-patient-updates"
              type="button"
              disabled={isSaving}
              onClick={handleSaveAllUpdates}
              className={`inline-flex items-center gap-1.5 rounded-xl text-white px-5 py-2 text-xs font-bold transition shadow-sm cursor-pointer ${
                isSaving
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Menyimpan ke Google Sheets...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Simpan Update Pemantauan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
