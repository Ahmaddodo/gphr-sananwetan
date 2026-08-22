import React from "react";
import { RotateCcw, X, AlertTriangle, Trash2 } from "lucide-react";

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="h-12 w-12 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Kosongkan Formulir & Draf?
            </h3>
            <p className="text-xs text-slate-500">
              Konfirmasi tindakan reset formulir
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          Tindakan ini akan **menghapus seluruh isian data** dari Step 1 hingga Step 4, membatalkan draf yang tersimpan di memori lokal browser (*localStorage*), dan mengembalikan formulir ke keadaan awal.
        </p>

        <div className="rounded-xl bg-rose-50 border border-rose-200/80 p-3 mb-6 text-[11px] text-rose-800 space-y-1 font-medium">
          <div className="flex items-center gap-1.5 font-bold">
            <Trash2 size={13} /> Data yang akan dibersihkan:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-rose-700 pl-1">
            <li>Identitas korban, kronologi & lokasi kasus</li>
            <li>Spesies & kondisi hewan penular (HPR)</li>
            <li>Tindakan medis, rekomendasi & foto dokumentasi</li>
            <li>Tanda tangan & pelaksana penyelidikan</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition"
          >
            <RotateCcw size={15} /> Ya, Kosongkan Form
          </button>
        </div>
      </div>
    </div>
  );
};
