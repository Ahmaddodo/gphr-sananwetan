import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
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
import { addPatientMonitoringLog, upsertPatient, normalizeDateToIso } from "../lib/patientMonitoring";
import { sendToAppsScript, DEFAULT_WEB_APP_URL } from "../lib/googleSheets";
import { addToOfflineQueue, isAppOnline } from "../lib/offlineSyncService";
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

  // New Daily Log Form State
  const [showAddLog, setShowAddLog] = useState<boolean>(false);
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

  useEffect(() => {
    if (patient) {
      setStatusPemantauan(patient.statusPemantauan);
      setStatusHewan(patient.statusHewanObservasi);
      setHariObservasi(patient.hariObservasiKe || 1);
      setKondisiLuka(patient.kondisiLuka || "");
      setKondisiHewanText(patient.kondisiHewan || "");
      setRekomendasi(patient.rekomendasi || "");
      setJadwalVAR(patient.jadwalVAR || {
        dosis0: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
        dosis3: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
        dosis7: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" },
        dosis21: { tanggal: "", status: "Belum Diberikan", lokasiPemberian: "", keterangan: "" }
      });
      setLogHariKe(patient.hariObservasiKe || 1);
      setSaveSuccessMsg("");
      setSaveErrorMsg("");
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

  const handleSaveAllUpdates = async () => {
    if (!patient || isSaving) return;

    setIsSaving(true);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");

    let updatedLogs = [...(patient.riwayatLog || [])];

    // Jika form log baru diisi / dibuka
    if (showAddLog && logCatatan.trim()) {
      const newLog: MonitoringDailyLog = {
        id: `log-${Date.now()}`,
        tanggal: logTanggal,
        hariKe: logHariKe,
        petugasNama: currentUser.nama,
        petugasNIP: currentUser.nip,
        kelurahan: patient.kelurahan,
        kondisiKorban: logKondisiKorban,
        statusLuka: logStatusLuka || kondisiLuka,
        kondisiHewan: logKondisiHewan,
        suhuTubuh: logSuhu ? `${logSuhu} °C` : undefined,
        tindakanDilakukan: logTindakan,
        catatanKhusus: logCatatan
      };
      updatedLogs.push(newLog);
    }

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
      action: "update",
      is_update: true
    };

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
    const targetUrl = webAppUrl || DEFAULT_WEB_APP_URL;
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

    if (sheetSyncSuccess) {
      setSaveSuccessMsg(`Data pasien & kolom Kondisi Luka ("${kondisiLuka}") berhasil disinkronkan ke Google Spreadsheet!`);
    } else if (!onlineNow) {
      setSaveSuccessMsg(`Mode Offline: Pembaruan pasien disimpan ke memori lokal & antrean sinkronisasi. Otomatis terkirim saat online!`);
    } else {
      setSaveSuccessMsg(`Data pasien dan kondisi luka berhasil diperbarui di sistem pemantauan lokal!`);
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {saveSuccessMsg && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
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
                  Status Pemantauan Korban:
                </label>
                <select
                  id="select-status-pemantauan"
                  value={statusPemantauan}
                  onChange={(e) => setStatusPemantauan(e.target.value as StatusPemantauanPasien)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Dalam Pemantauan (Aktif)">Dalam Pemantauan (Aktif)</option>
                  <option value="Selesai Observasi (14 Hari)">Selesai Observasi (14 Hari - Sembuh & Aman)</option>
                  <option value="Perlu Follow-up VAR">Perlu Follow-up VAR (Jadwal Mendatang / Tertunda)</option>
                  <option value="Dirujuk / Perawatan Lanjut">Dirujuk / Perawatan Lanjut</option>
                  <option value="Meninggal Dunia (Kasus Rabies)">Meninggal Dunia (Kasus Rabies)</option>
                </select>
              </div>

              {/* Status Hewan Observasi */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Status Hewan HPR (Observasi 14 Hari):
                </label>
                <select
                  id="select-status-hewan"
                  value={statusHewan}
                  onChange={(e) => setStatusHewan(e.target.value as StatusHewanObservasi)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Sehat / Normal (Observasi)">Sehat / Normal (Dalam Observasi)</option>
                  <option value="Mati dalam 14 Hari">Mati dalam 14 Hari (Waspada Rabies)</option>
                  <option value="Hilang / Kabur">Hilang / Kabur (Hewan Liar)</option>
                  <option value="Positif Rabies (FAT Lab)">Positif Rabies (Hasil Uji Lab FAT)</option>
                  <option value="Hewan Dieliminasi">Hewan Dieliminasi</option>
                </select>
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
                  Kondisi Luka Korban Saat Ini:
                </label>
                <div className="space-y-1.5">
                  <select
                    id="select-kondisi-luka-modal"
                    value={kondisiLuka}
                    onChange={(e) => setKondisiLuka(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">-- Pilih Kondisi Luka --</option>
                    <option value="Kategori 1">Kategori 1 (Menyentuh/Menjilat Kulit Utuh / Luka Sangat Ringan)</option>
                    <option value="Kategori 2">Kategori 2 (Gigitan / Cakaran Dangkal / Tidak Berdarah Parah)</option>
                    <option value="Kategori 3">Kategori 3 (Luka Robek Dalam / Multiple / Mukosa / Berdarah Aktif)</option>
                    <option value="Kategori 4">Kategori 4 (Gigitan Risiko Sangat Tinggi / Leher, Muka, Jari)</option>
                  </select>
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
                        onClick={() => setKondisiLuka(opt)}
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
                  Catatan Kondisi Hewan:
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={kondisiHewanText}
                    onChange={(e) => setKondisiHewanText(e.target.value)}
                    placeholder="Contoh: Anjing sehat diikat, makan normal"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
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
                        onClick={() => setKondisiHewanText(opt)}
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
              </h4>
              <button
                type="button"
                onClick={() => setShowAddLog((prev) => !prev)}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                <PlusCircle size={13} />
                <span>{showAddLog ? "Tutup Form Catatan" : "+ Tambah Catatan Baru"}</span>
              </button>
            </div>

            {/* Sub-form input catatan perkembangan baru */}
            {showAddLog && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                  <span>Input Catatan Perkembangan Baru</span>
                  <span className="text-[11px] font-normal text-blue-700">Petugas: {currentUser.nama}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tanggal Pemantauan</label>
                    <input
                      type="date"
                      value={logTanggal}
                      onChange={(e) => setLogTanggal(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Observasi Hari Ke</label>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={logHariKe}
                      onChange={(e) => setLogHariKe(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Suhu Tubuh Korban (°C)</label>
                    <input
                      type="text"
                      value={logSuhu}
                      onChange={(e) => setLogSuhu(e.target.value)}
                      placeholder="Contoh: 36.5"
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Kondisi Korban & Luka</label>
                    <input
                      type="text"
                      value={logKondisiKorban}
                      onChange={(e) => setLogKondisiKorban(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Kondisi Hewan (HPR)</label>
                    <input
                      type="text"
                      value={logKondisiHewan}
                      onChange={(e) => setLogKondisiHewan(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">Catatan Khusus / Tindakan Petugas</label>
                  <textarea
                    rows={2}
                    value={logCatatan}
                    onChange={(e) => setLogCatatan(e.target.value)}
                    placeholder="Tuliskan catatan evaluasi, keluhan korban, atau pesan edukasi..."
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Riwayat Logs Sebelumnya */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(!patient.riwayatLog || patient.riwayatLog.length === 0) ? (
                <p className="text-xs text-slate-400 italic py-2">Belum ada riwayat catatan harian yang dicatat.</p>
              ) : (
                patient.riwayatLog.map((log, idx) => (
                  <div key={log.id || idx} className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-bold text-slate-800">
                        Hari ke-{log.hariKe} • {log.tanggal}
                      </span>
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {log.petugasNama}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      <b>Korban:</b> {log.kondisiKorban} | <b>Hewan:</b> {log.kondisiHewan}
                    </p>
                    {log.catatanKhusus && (
                      <p className="text-slate-500 italic bg-slate-50 p-1.5 rounded">
                        "{log.catatanKhusus}"
                      </p>
                    )}
                  </div>
                ))
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
