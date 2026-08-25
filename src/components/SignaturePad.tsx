import React, { useRef, useState, useEffect } from "react";
import { PenTool, CheckCircle2, RotateCcw, Sparkles, Image as ImageIcon, ShieldCheck, Lock } from "lucide-react";
import { FormGHPRData } from "../types";
import { OFFICIAL_SIGNATURE_STAMP_URL, getOfficialSignatureUrl } from "./SignatureData";

interface SignaturePadProps {
  formData: FormGHPRData;
  updateField: (field: keyof FormGHPRData, value: any) => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  formData,
  updateField
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeMode = "gambar";

  // Pastikan stempel dan tanda tangan resmi selalu terisi permanen
  useEffect(() => {
    const validUrl = getOfficialSignatureUrl(formData.tandaTanganUrl);
    if (formData.tandaTanganUrl !== validUrl || formData.jenisTandaTangan !== "gambar") {
      updateField("tandaTanganUrl", validUrl);
      updateField("jenisTandaTangan", "gambar");
      updateField("tandaTanganOtomatis", false);
    }
  }, [formData.tandaTanganUrl, formData.jenisTandaTangan]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateField("tandaTanganUrl", event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/90 text-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <PenTool size={15} className="text-emerald-400" /> Tanda Tangan & Stempel Resmi Pelaksana
        </label>
        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
          <CheckCircle2 size={13} /> Stempel & TTD Resmi Terlampir
        </span>
      </div>

      {/* Mode Switcher Buttons */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700">
        <button
          type="button"
          disabled
          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-bold bg-emerald-600 text-white shadow-sm cursor-default"
        >
          <ShieldCheck size={14} /> Stempel & TTD Resmi
        </button>

        <button
          type="button"
          disabled
          title="Mode gambar manual dinonaktifkan"
          className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-md text-[11px] font-semibold text-slate-500 bg-slate-900/60 opacity-50 cursor-not-allowed select-none border border-slate-800"
        >
          <PenTool size={13} /> Coret / Gambar <Lock size={10} className="ml-0.5 text-amber-400" />
        </button>

        <button
          type="button"
          disabled
          title="Mode digital font dinonaktifkan"
          className="flex items-center justify-center gap-1 py-2 px-1.5 rounded-md text-[11px] font-semibold text-slate-500 bg-slate-900/60 opacity-50 cursor-not-allowed select-none border border-slate-800"
        >
          <Sparkles size={13} /> Digital Font <Lock size={10} className="ml-0.5 text-amber-400" />
        </button>
      </div>

      {/* GAMBAR STEMPEL & TTD RESMI */}
      <div className="space-y-3">
        <div className="p-4 bg-white/95 rounded-xl border border-slate-300 text-center shadow-inner">
          <div className="bg-white p-2 rounded-lg border border-slate-200 inline-block max-w-full overflow-hidden">
            <img
              src={getOfficialSignatureUrl(formData.tandaTanganUrl)}
              alt="Tanda Tangan & Stempel Resmi"
              className="max-h-28 max-w-full mx-auto object-contain rounded"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <button
            type="button"
            disabled
            title="Tombol dinonaktifkan"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 text-slate-500 font-semibold text-[11px] border border-slate-700/80 cursor-not-allowed opacity-50 select-none"
          >
            <RotateCcw size={12} /> Reset ke Stempel Resmi Default <Lock size={10} className="ml-0.5 text-amber-400" />
          </button>

          <div className="relative">
            <input
              type="file"
              accept="image/*"
              id="signature-file-input"
              disabled
              className="hidden"
            />
            <span
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 text-[11px] font-semibold text-slate-500 cursor-not-allowed opacity-50 select-none"
              title="Upload file dinonaktifkan"
            >
              <ImageIcon size={13} className="text-slate-500" /> Upload File Gambar Lain <Lock size={10} className="ml-0.5 text-amber-400" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


