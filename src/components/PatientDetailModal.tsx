import React from "react";
import {
  X,
  Printer,
  Edit3,
  Calendar,
  User,
  MapPin,
  HeartPulse,
  Syringe,
  History,
  ShieldCheck,
  Clock,
  Dog,
  FileSpreadsheet
} from "lucide-react";
import { PatientMonitoringItem, UserAccessProfile } from "../types";
import { calculateObservationDay, parseChronologicalLogs } from "../lib/patientMonitoring";

interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientMonitoringItem | null;
  currentUser: UserAccessProfile;
  onOpenUpdateModal: (patient: PatientMonitoringItem) => void;
  onOpenFullFormEdit: (patient: PatientMonitoringItem) => void;
  onPrintPatientCase?: (patient: PatientMonitoringItem) => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  isOpen,
  onClose,
  patient,
  currentUser,
  onOpenUpdateModal,
  onOpenFullFormEdit,
  onPrintPatientCase
}) => {
  if (!isOpen || !patient) return null;

  const handlePrint = () => {
    if (onPrintPatientCase) {
      onClose();
      onPrintPatientCase(patient);
    } else {
      window.print();
    }
  };

  return (
    <div
      id="patient-detail-modal-overlay"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="patient-detail-modal-content"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-700 print:bg-slate-900 print:text-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <HeartPulse size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Kartu Rekam Pemantauan Pasien GHPR
                <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-600/40 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded">
                  Kel. {patient.kelurahan}
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                UPT Puskesmas Sananwetan • ID: <span className="font-mono text-white">{patient.id_kasus}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg border border-white/20 transition cursor-pointer flex items-center gap-1"
            >
              <Printer size={14} /> Cetak Kartu
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Status Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Status Pemantauan Kasus
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                <ShieldCheck size={14} className="text-blue-600" />
                {patient.statusPemantauan}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Observasi Hewan 14 Hari
              </span>
              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                Hari ke-{calculateObservationDay(patient)} dari 14 Hari ({patient.statusHewanObservasi})
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Petugas PJ Wilayah
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {patient.petugasPJ} {patient.nipPJ ? `(NIP. ${patient.nipPJ})` : ""}
              </span>
            </div>
          </div>

          {/* Grid Informasi Kasus */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Kolom 1: Identitas Korban & Luka */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <User size={14} className="text-blue-600" />
                A. Identitas Korban & Kejadian Gigitan
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Nama Korban:</span>
                  <span className="font-bold text-slate-900">{patient.namaKorban}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">No. HP / WA Korban:</span>
                  <span className="font-semibold text-emerald-700">{patient.noHpKorban || patient.kontakKorban || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Umur / Jenis Kelamin:</span>
                  <span className="font-semibold text-slate-800">{patient.umurKorban} Tahun / {patient.jkKorban}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Alamat Lengkap:</span>
                  <span className="font-semibold text-slate-800 text-right">{patient.alamatKorban} (Kel. {patient.kelurahan})</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Waktu Kejadian Gigitan:</span>
                  <span className="font-semibold text-slate-800">{patient.waktuKejadian}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Kondisi & Lokasi Luka:</span>
                  <span className="font-semibold text-slate-800 text-right">{patient.kondisiLuka} (Lokasi: {patient.lokasiLuka || "-"})</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Pertolongan Pertama:</span>
                  <span className="font-semibold text-slate-800 text-right">{patient.pertolonganPertama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tindakan Medis Kasus:</span>
                  <span className="font-semibold text-slate-800 text-right">{patient.tindakanKasus}</span>
                </div>
              </div>
            </div>

            {/* Kolom 2: Identitas Hewan & Pemilik */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Dog size={14} className="text-amber-600" />
                B. Identitas Hewan Penular Rabies (HPR)
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Spesies / Ras HPR:</span>
                  <span className="font-bold text-slate-900">{patient.spesiesHPR} {patient.rasHewan ? `(${patient.rasHewan})` : ""}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Kondisi Hewan Saat Ini:</span>
                  <span className="font-semibold text-slate-800">{patient.kondisiHewan || "-"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Status Observasi 14 Hari:</span>
                  <span className="font-bold text-blue-700">{patient.statusHewanObservasi}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Nama Pemilik Hewan:</span>
                  <span className="font-semibold text-slate-800">{patient.pemilikHewan || "Tidak Diketahui / Liar"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-1.5">
                  <span className="text-slate-500 font-medium">Alamat / Kontak Pemilik:</span>
                  <span className="font-semibold text-slate-800 text-right">{patient.alamatPemilik || "-"} {patient.kontakPemilik ? `(${patient.kontakPemilik})` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Rekomendasi Tindak Lanjut:</span>
                  <span className="font-semibold text-slate-800 text-right">{patient.rekomendasi || "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Jadwal Vaksin Anti Rabies (VAR) */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
            <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Syringe size={14} className="text-emerald-600" />
              C. Jadwal & Status Vaksinasi Anti Rabies (VAR)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Dosis 0 */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-700 block">Dosis 0 (Hari 0)</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    Tgl: <span className="font-medium text-slate-900">{patient.jadwalVAR?.dosis0?.tanggal || "Belum diisi"}</span>
                  </span>
                  {patient.jadwalVAR?.dosis0?.lokasiPemberian && (
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={patient.jadwalVAR.dosis0.lokasiPemberian}>
                      📍 {patient.jadwalVAR.dosis0.lokasiPemberian}
                    </span>
                  )}
                </div>
                <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded w-fit ${
                  patient.jadwalVAR?.dosis0?.status === "Sudah Diberikan"
                    ? "bg-emerald-100 text-emerald-800"
                    : patient.jadwalVAR?.dosis0?.status === "Terjadwal"
                    ? "bg-blue-100 text-blue-800"
                    : patient.jadwalVAR?.dosis0?.status === "Tidak Perlu"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}>
                  {patient.jadwalVAR?.dosis0?.status || "Belum Diberikan"}
                </span>
              </div>

              {/* Dosis 3 */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-700 block">Dosis 3 (Hari 3)</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    Tgl: <span className="font-medium text-slate-900">{patient.jadwalVAR?.dosis3?.tanggal || "Belum diisi"}</span>
                  </span>
                  {patient.jadwalVAR?.dosis3?.lokasiPemberian && (
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={patient.jadwalVAR.dosis3.lokasiPemberian}>
                      📍 {patient.jadwalVAR.dosis3.lokasiPemberian}
                    </span>
                  )}
                </div>
                <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded w-fit ${
                  patient.jadwalVAR?.dosis3?.status === "Sudah Diberikan"
                    ? "bg-emerald-100 text-emerald-800"
                    : patient.jadwalVAR?.dosis3?.status === "Terjadwal"
                    ? "bg-blue-100 text-blue-800"
                    : patient.jadwalVAR?.dosis3?.status === "Tidak Perlu"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}>
                  {patient.jadwalVAR?.dosis3?.status || "Belum Diberikan"}
                </span>
              </div>

              {/* Dosis 7 */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-700 block">Dosis 7 (Hari 7)</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    Tgl: <span className="font-medium text-slate-900">{patient.jadwalVAR?.dosis7?.tanggal || "Belum diisi"}</span>
                  </span>
                  {patient.jadwalVAR?.dosis7?.lokasiPemberian && (
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={patient.jadwalVAR.dosis7.lokasiPemberian}>
                      📍 {patient.jadwalVAR.dosis7.lokasiPemberian}
                    </span>
                  )}
                </div>
                <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded w-fit ${
                  patient.jadwalVAR?.dosis7?.status === "Sudah Diberikan"
                    ? "bg-emerald-100 text-emerald-800"
                    : patient.jadwalVAR?.dosis7?.status === "Terjadwal"
                    ? "bg-blue-100 text-blue-800"
                    : patient.jadwalVAR?.dosis7?.status === "Tidak Perlu"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}>
                  {patient.jadwalVAR?.dosis7?.status || "Belum Diberikan"}
                </span>
              </div>

              {/* Dosis 21 */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <span className="font-bold text-slate-700 block">Dosis 21 (Hari 21)</span>
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    Tgl: <span className="font-medium text-slate-900">{patient.jadwalVAR?.dosis21?.tanggal || "Belum diisi"}</span>
                  </span>
                  {patient.jadwalVAR?.dosis21?.lokasiPemberian && (
                    <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={patient.jadwalVAR.dosis21.lokasiPemberian}>
                      📍 {patient.jadwalVAR.dosis21.lokasiPemberian}
                    </span>
                  )}
                </div>
                <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded w-fit ${
                  patient.jadwalVAR?.dosis21?.status === "Sudah Diberikan"
                    ? "bg-emerald-100 text-emerald-800"
                    : patient.jadwalVAR?.dosis21?.status === "Terjadwal"
                    ? "bg-blue-100 text-blue-800"
                    : patient.jadwalVAR?.dosis21?.status === "Tidak Perlu"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}>
                  {patient.jadwalVAR?.dosis21?.status || "Opsional"}
                </span>
              </div>
            </div>
          </div>

          {/* Catatan Harian Pemantauan */}
          <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white space-y-3">
            <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2 text-xs uppercase tracking-wider">
              <History size={15} className="text-indigo-600" />
              D. Catatan Kronologis Pemantauan Harian
            </h4>
            <div className="space-y-3">
              {(() => {
                const logs = parseChronologicalLogs(patient);
                if (logs.length === 0) {
                  return <p className="text-xs text-slate-400 italic py-2">Belum ada catatan log pemantauan.</p>;
                }
                return logs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 text-xs space-y-2.5 shadow-2xs hover:border-slate-300 transition"
                  >
                    {/* Header baris 1: Hari & Tanggal + Suhu + Petugas */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                          Hari ke-{log.hariKe} • Tanggal: {log.tanggal}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                          <span>🌡️</span>
                          <span>{log.suhuTubuh || "36.5 °C"}</span>
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg">
                        Petugas: {log.petugasNama || patient.petugasPJ || "Petugas Puskesmas"}
                      </span>
                    </div>

                    {/* Baris 2: Kolom Kondisi Korban & Kondisi Hewan */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700 text-xs pt-0.5">
                      <div>
                        <span className="font-bold text-slate-900">Kondisi Korban & Luka:</span>{" "}
                        <span className="text-slate-700">{log.kondisiKorban || log.statusLuka || "Kondisi umum baik, tidak demam."}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Kondisi Hewan HPR:</span>{" "}
                        <span className="text-slate-700">{log.kondisiHewan || "Sehat & aktif (dikandangkan/diikat)"}</span>
                      </div>
                    </div>

                    {/* Baris 3: Tindakan / Edukasi */}
                    <div className="text-slate-700 text-xs">
                      <span className="font-bold text-slate-900">Tindakan / Edukasi:</span>{" "}
                      <span className="text-slate-700">{log.tindakanDilakukan || "Pemantauan berkala & edukasi perawatan luka."}</span>
                    </div>

                    {/* Catatan Khusus Tambahan jika bukan format standar */}
                    {log.catatanKhusus && log.catatanKhusus !== "-" && !log.catatanKhusus.startsWith("[") && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                        "{log.catatanKhusus}"
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap print:hidden">
          <button
            type="button"
            onClick={() => {
              onOpenFullFormEdit(patient);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <Edit3 size={13} />
            <span>Edit di Formulir 4 Langkah</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUpdateModal(patient);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white px-4 py-2 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <HeartPulse size={14} />
              <span>Update Data Pantauan</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
