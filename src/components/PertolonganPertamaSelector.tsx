import React, { useMemo } from "react";
import { Check, CheckSquare, Square, RotateCcw, AlertCircle, Droplets, Syringe, ShieldAlert } from "lucide-react";
import { FormGHPRData } from "../types";

export interface PertolonganOption {
  id: string;
  label: string;
  tag: string;
  desc: string;
  icon: React.ReactNode;
  match: (val: string) => boolean;
}

export const PERTOLONGAN_OPTIONS: PertolonganOption[] = [
  {
    id: "cuci_kurang_12",
    label: "Cuci luka < 12 jam",
    tag: "Pencucian Segera",
    desc: "Cuci luka air mengalir & sabun 15 menit segera (< 12 jam pasca gigitan)",
    icon: <Droplets size={16} className="text-emerald-600 shrink-0" />,
    match: (val: string) => {
      const lower = val.toLowerCase();
      return lower.includes("< 12") || lower.includes("<12") || lower.includes("kurang 12");
    }
  },
  {
    id: "cuci_lebih_12",
    label: "Cuci luka > 12 jam",
    tag: "Pencucian Terlambat",
    desc: "Cuci luka air mengalir & sabun baru dilakukan terlambat (> 12 jam pasca gigitan)",
    icon: <Droplets size={16} className="text-amber-600 shrink-0" />,
    match: (val: string) => {
      const lower = val.toLowerCase();
      return lower.includes("> 12") || lower.includes(">12") || lower.includes("lebih 12");
    }
  },
  {
    id: "var_dosis_1",
    label: "Var dosis 1, 1 dosis dan 1 dosis",
    tag: "VAR Hari ke-0 (2 Dosis)",
    desc: "Pemberian Vaksin Anti Rabies dosis ke-1: 1 dosis deltoid kanan + 1 dosis deltoid kiri",
    icon: <Syringe size={16} className="text-blue-600 shrink-0" />,
    match: (val: string) => {
      const lower = val.toLowerCase();
      return (
        lower.includes("var dosis 1") ||
        lower.includes("1 dosis dan 1 dosis") ||
        (lower.includes("var") && lower.includes("1 dosis")) ||
        (lower.includes("var") && lower.includes("dosis 1"))
      );
    }
  },
  {
    id: "sar",
    label: "SAR",
    tag: "Serum Anti Rabies",
    desc: "Pemberian Serum Anti Rabies (SAR) pada luka risiko tinggi / Kategori III",
    icon: <ShieldAlert size={16} className="text-purple-600 shrink-0" />,
    match: (val: string) => {
      return /\bSAR\b/i.test(val) || val.toLowerCase().includes("serum anti rabies");
    }
  }
];

interface PertolonganPertamaSelectorProps {
  value?: string;
  updateField: (field: keyof FormGHPRData, value: string) => void;
  error?: string;
  showAsterisk?: boolean;
}

export const PertolonganPertamaSelector: React.FC<PertolonganPertamaSelectorProps> = ({
  value = "",
  updateField,
  error,
  showAsterisk = true
}) => {
  // Parsing selected items from value string
  const selectedIds = useMemo(() => {
    const raw = String(value || "").trim();
    if (!raw || raw === "-" || raw.toLowerCase() === "tidak" || raw.toLowerCase() === "tidak dilakukan") {
      return new Set<string>();
    }
    const matched = new Set<string>();
    PERTOLONGAN_OPTIONS.forEach((opt) => {
      if (opt.match(raw) || raw.includes(opt.label)) {
        matched.add(opt.id);
      }
    });
    return matched;
  }, [value]);

  const toggleOption = (optId: string) => {
    const nextSet = new Set(selectedIds);
    if (nextSet.has(optId)) {
      nextSet.delete(optId);
    } else {
      nextSet.add(optId);
    }

    applySelection(nextSet);
  };

  const applySelection = (activeSet: Set<string>) => {
    const selectedLabels: string[] = [];
    let hasKurang12 = false;
    let hasLebih12 = false;
    let hasVar1 = false;
    let hasSar = false;

    PERTOLONGAN_OPTIONS.forEach((opt) => {
      if (activeSet.has(opt.id)) {
        selectedLabels.push(opt.label);
        if (opt.id === "cuci_kurang_12") hasKurang12 = true;
        if (opt.id === "cuci_lebih_12") hasLebih12 = true;
        if (opt.id === "var_dosis_1") hasVar1 = true;
        if (opt.id === "sar") hasSar = true;
      }
    });

    const combinedStr = selectedLabels.length > 0 ? selectedLabels.join(", ") : "Tidak Dilakukan";
    updateField("pertolonganPertama", combinedStr);
    updateField("cuciLukaKurang12Jam", hasKurang12 ? "Ya" : "-");
    updateField("cuciLukaLebih12Jam", hasLebih12 ? "Ya" : "-");
    updateField("varDosis1", hasVar1 ? "Ya" : "-");
    updateField("sar", hasSar ? "Ya" : "-");
  };

  const handleClear = () => {
    updateField("pertolonganPertama", "Tidak Dilakukan");
    updateField("cuciLukaKurang12Jam", "-");
    updateField("cuciLukaLebih12Jam", "-");
    updateField("varDosis1", "-");
    updateField("sar", "-");
  };

  const handleSelectAll = () => {
    const allSet = new Set(PERTOLONGAN_OPTIONS.map((o) => o.id));
    applySelection(allSet);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1">
          <span>Pertolongan Pertama Dilakukan</span>
          {showAsterisk && (
            <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none" title="Pilihan Tindakan">*</span>
          )}
          <span className="ml-1 text-[11px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Dapat memilih lebih dari satu
          </span>
        </label>

        <div className="flex items-center gap-2 text-xs">
          {selectedIds.size > 0 && (
            <span className="font-semibold text-emerald-700 text-[11px]">
              {selectedIds.size} Tindakan Dipilih
            </span>
          )}
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2 cursor-pointer"
          >
            Pilih Semua
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={11} />
            Kosongkan
          </button>
        </div>
      </div>

      {/* Grid Multi-Option Checkboxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PERTOLONGAN_OPTIONS.map((opt) => {
          const isChecked = selectedIds.has(opt.id);
          return (
            <div
              key={opt.id}
              onClick={() => toggleOption(opt.id)}
              className={`group flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                isChecked
                  ? "bg-emerald-50/80 border-emerald-400 shadow-xs ring-1 ring-emerald-400/30"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isChecked ? (
                  <div className="h-5 w-5 rounded-md bg-emerald-600 text-white flex items-center justify-center transition shadow-xs">
                    <Check size={14} className="stroke-[3]" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-md border-2 border-slate-300 bg-white group-hover:border-slate-400 transition" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs font-bold ${isChecked ? "text-emerald-950" : "text-slate-800"}`}>
                    {opt.label}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      isChecked
                        ? "bg-emerald-200/80 text-emerald-900 font-semibold"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {opt.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug mt-1">
                  {opt.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Nilai yang Tersimpan */}
      <div className="mt-0.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
        <span className="text-[11px] text-slate-500">Tercatat di Sistem & Spreadsheet:</span>
        <span className="font-semibold text-slate-800 truncate ml-2 text-right">
          {value && value !== "-" ? value : "Belum ada tindakan dipilih"}
        </span>
      </div>

      {error && (
        <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
          <AlertCircle size={12} />
          {error}
        </span>
      )}
    </div>
  );
};
