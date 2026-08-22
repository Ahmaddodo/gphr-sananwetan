import React from "react";
import { CheckCircle2, EyeOff, ShieldCheck, X } from "lucide-react";
import { PatientMonitoringItem, UserAccessProfile } from "../types";
import { canUserDeleteCases } from "../lib/patientMonitoring";

interface DeletePatientConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientMonitoringItem | null;
  currentUser: UserAccessProfile;
  onConfirmDelete: (id_kasus: string) => void;
}

export const DeletePatientConfirmModal: React.FC<DeletePatientConfirmModalProps> = ({
  isOpen,
  onClose,
  patient,
  currentUser,
  onConfirmDelete
}) => {
  if (!isOpen || !patient || !canUserDeleteCases(currentUser)) return null;

  return (
    <div
      id="delete-patient-modal-overlay"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
            <EyeOff size={28} />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              Selesai Masa Pemantauan
            </h3>
            <p className="text-xs text-slate-500">
              Bersihkan data pasien dari tampilan layar pemantauan aktif?
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">ID Kasus:</span>
              <span className="font-mono font-bold text-slate-800">{patient.id_kasus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Nama Korban:</span>
              <span className="font-bold text-blue-700">{patient.namaKorban}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Wilayah Kelurahan:</span>
              <span className="font-bold text-slate-700">Kel. {patient.kelurahan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Status Pemantauan:</span>
              <span className="font-medium text-emerald-700">{patient.statusPemantauan} (Hari ke-{patient.hariObservasiKe || 14})</span>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-left flex items-start gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              <span className="font-bold">Aman & Terarsip:</span> Data record di <span className="font-bold">Google Spreadsheet</span> tetap tersimpan permanen dan tidak akan terhapus.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              id="btn-cancel-delete-patient"
              type="button"
              onClick={onClose}
              className="w-1/2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              id="btn-confirm-delete-patient"
              type="button"
              onClick={() => {
                onConfirmDelete(patient.id_kasus);
                onClose();
              }}
              className="w-1/2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-bold transition shadow-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <EyeOff size={15} />
              <span>Hapus dari Layar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
