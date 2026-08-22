import React from "react";
import { Shield, Eye, CircleCheck, FileText, Printer, Save, RotateCcw } from "lucide-react";
import { FormGHPRData, SubmissionPayload } from "../types";

interface SidebarSummaryProps {
  formData: FormGHPRData;
  previewJsonPayload: SubmissionPayload;
  step: number;
  getFinalKelurahan: () => string;
  getFinalKecamatan: () => string;
  getFinalKabKota: () => string;
  setShowJsonModal: (val: boolean) => void;
  setShowPdfModal: (val: boolean) => void;
  setShowConfig?: (val: boolean) => void;
  lastSavedTime: string | null;
  handleResetForm: () => void;
  isAdminMode?: boolean;
}

export const SidebarSummary: React.FC<SidebarSummaryProps> = ({
  formData,
  previewJsonPayload,
  step,
  getFinalKelurahan,
  getFinalKecamatan,
  getFinalKabKota,
  setShowJsonModal,
  setShowPdfModal,
  setShowConfig,
  lastSavedTime,
  handleResetForm,
  isAdminMode = false,
}) => {
  return (
    <div className="space-y-6 lg:sticky lg:top-[88px] min-w-0 print:hidden">
      {/* Auto-Save Info Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Save size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              Penyimpanan Otomatis
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
            </div>
            <div className="text-[11px] font-medium text-slate-500 truncate">
              {lastSavedTime ? `Tersimpan ${lastSavedTime}` : "Aktif di memori lokal"}
            </div>
          </div>
        </div>
      </div>

      {/* Dark Command Card */}
      <div className="bg-[#0F172A] rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <Shield size={14} className="text-blue-500" /> Ringkasan Kasus
          </span>
          <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
            Live Preview
          </span>
        </div>

        <div className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between gap-3 py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Spesies HPR</span>
            <b className="text-slate-100 font-semibold text-right">
              {formData.spesiesHPR
                ? formData.spesiesHPR === "Lainnya"
                  ? formData.spesiesLain
                  : formData.spesiesHPR
                : "-"}
            </b>
          </div>
          <div className="flex justify-between gap-3 py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Lokasi Kasus</span>
            <b className="text-slate-100 font-semibold text-right truncate max-w-[150px]">
              {getFinalKelurahan() || formData.kelurahan || formData.kecamatan || "-"}
            </b>
          </div>
          <div className="flex justify-between gap-3 py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Korban</span>
            <b className="text-slate-100 font-semibold">{formData.namaKorban || "-"}</b>
          </div>
          <div className="flex justify-between gap-3 py-1 border-b border-slate-800/60">
            <span className="text-slate-400">Kondisi HPR</span>
            <b className="text-slate-100 font-semibold">{formData.kondisiHewan || "-"}</b>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <span className="text-slate-400">Vaksin HPR</span>
            <b className="text-slate-100 font-semibold">{formData.riwayatVaksin || "-"}</b>
          </div>

          <div className="mt-3 rounded-lg bg-slate-800/80 p-3 border border-slate-700/60">
            <div className="text-slate-400 uppercase tracking-widest font-bold text-[10px]">
              Alamat Lengkap Final
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-200 leading-normal">
              {[getFinalKelurahan(), getFinalKecamatan(), getFinalKabKota()]
                .filter(Boolean)
                .join(", ") || "-"}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <button
            onClick={() => setShowPdfModal(true)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-lg uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Printer size={15} /> Cetak PDF (Format Resmi)
          </button>
          {isAdminMode && (
            <button
              onClick={() => setShowJsonModal(true)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg uppercase tracking-wider transition flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
            >
              <Eye size={14} /> Inspeksi Raw JSON
            </button>
          )}
        </div>
      </div>

      {/* Checklist Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">
          Checklist Kelengkapan Form
        </h4>
        <ul className="mt-3 space-y-2.5">
          {[
            ["1. Waktu & Tempat", step > 1 || !!formData.kronologi],
            ["2. Hewan Penular", step > 2 || !!formData.kondisiHewan],
            ["3. Kasus & Tindakan", step > 3 || !!formData.tindakanHPR],
            ["4. Rekomendasi & Tim", !!formData.pelaksanaNama && !!formData.rekomendasi]
          ].map(([itemTitle, isDone]) => (
            <li
              key={itemTitle as string}
              className={`flex items-center justify-between text-xs p-2 rounded-lg ${
                isDone ? "bg-emerald-50/60 text-emerald-800 font-semibold" : "text-slate-500 bg-slate-50"
              }`}
            >
              <span>{itemTitle}</span>
              {isDone ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
                  <CircleCheck size={12} /> Lengkap
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Draft</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ID Badge Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
          Nomor Registrasi / ID Kasus
        </span>
        <div className="font-mono text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg p-2.5 break-all">
          {previewJsonPayload.id_kasus}
        </div>
      </div>

      {/* Apps Script & Sheet Target Card - KHUSUS MODE ADMIN */}
      {isAdminMode && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-hidden space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <FileText size={14} className="text-emerald-600" /> Target Google Sheets
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Admin Dev
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs text-slate-600">
            <div className="font-semibold text-slate-800 text-[11px]">Perekam Data: Google Apps Script</div>
            <div className="text-[10.5px] text-slate-500 leading-snug">
              Buka panel konfigurasi untuk melihat endpoint Web App, uji kirim data, dan pengaturan Google Sheets.
            </div>
          </div>
          
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowConfig?.(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Shield size={14} /> Buka Pengaturan & Uji Kirim
            </button>
            
            <a
              href="https://docs.google.com/spreadsheets/d/1jRDFTZWEFTlNSVSP73LI_JGRrRlWyWsXeKrgEiAsBrg/edit"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <FileText size={14} /> Buka Google Sheets Langsung
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
