import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  X,
  Edit3,
  Calendar,
  User,
  MapPin,
  RefreshCw,
  ExternalLink,
  Shield,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles
} from "lucide-react";
import {
  fetchCasesHistory,
  StoredCaseItem,
  DEFAULT_SPREADSHEET_URL
} from "../lib/googleSheets";

interface AdminCaseSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  webAppUrl: string;
  onSelectCaseForEdit: (caseItem: StoredCaseItem) => void;
  activeEditingId: string | null;
}

export const AdminCaseSearchModal: React.FC<AdminCaseSearchModalProps> = ({
  isOpen,
  onClose,
  webAppUrl,
  onSelectCaseForEdit,
  activeEditingId
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [allCases, setAllCases] = useState<StoredCaseItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPredictions, setShowPredictions] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const items = await fetchCasesHistory(webAppUrl, "");
      setAllCases(items);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Tutup dropdown prediksi saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowPredictions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter daftar kasus secara real-time
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return allCases;
    const q = searchQuery.toLowerCase().trim();
    return allCases.filter((item) => {
      const nama = (item.namaKorban || "").toLowerCase();
      const id = (item.id_kasus || "").toLowerCase();
      const alamat = (item.alamatKejadian || "").toLowerCase();
      const kel = (item.kelurahan || "").toLowerCase();
      const pet = (item.pelaksanaNama || "").toLowerCase();
      return (
        nama.includes(q) ||
        id.includes(q) ||
        alamat.includes(q) ||
        kel.includes(q) ||
        pet.includes(q)
      );
    });
  }, [allCases, searchQuery]);

  // Prediksi nama korban / penderita berdasarkan karakter yang diketikkan
  const victimNamePredictions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 1) return [];
    const q = searchQuery.toLowerCase().trim();
    const matches: { name: string; caseItem: StoredCaseItem }[] = [];
    const seen = new Set<string>();

    for (const item of allCases) {
      const name = (item.namaKorban || "").trim();
      if (name && name !== "-" && name.toLowerCase().includes(q)) {
        const lower = name.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          matches.push({ name, caseItem: item });
        }
      }
    }
    return matches.slice(0, 6);
  }, [allCases, searchQuery]);

  const handleSelectPrediction = (name: string) => {
    setSearchQuery(name);
    setShowPredictions(false);
  };

  if (!isOpen) return null;

  return (
    <div
      id="admin-search-modal-overlay"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="admin-search-modal-content"
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-4.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Search size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Pencarian & Kelola Laporan GHPR
                <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-600/30 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                  Admin Tool
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Pencarian real-time berdasarkan nama korban/penderita, ID Kasus, atau lokasi untuk diedit & diperbarui.
              </p>
            </div>
          </div>
          <button
            id="btn-close-search-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar & Auto-Suggest Box */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200">
          <div className="relative flex gap-2" ref={searchContainerRef}>
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchInputRef}
                id="input-admin-search-query"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowPredictions(true);
                }}
                onFocus={() => setShowPredictions(true)}
                placeholder="Ketik nama penderita/korban (contoh: Siti, Budi...), atau ID Kasus..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setShowPredictions(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded"
                >
                  Clear
                </button>
              )}

              {/* Dropdown Prediksi Nama Korban */}
              {showPredictions && victimNamePredictions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <Sparkles size={13} className="text-amber-500" /> Prediksi Nama Korban / Penderita
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Klik nama untuk filter</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {victimNamePredictions.map(({ name, caseItem }) => (
                      <div
                        key={caseItem.id_kasus}
                        onClick={() => handleSelectPrediction(name)}
                        className="px-3.5 py-2.5 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between gap-3 group transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                            <User size={13} />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                              {name}
                              {caseItem.umurKorban && caseItem.umurKorban !== "-" && (
                                <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                                  ({caseItem.umurKorban})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                              <span className="font-mono">{caseItem.id_kasus}</span>
                              <span>•</span>
                              <span>Kel. {caseItem.kelurahan}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCaseForEdit(caseItem);
                            onClose();
                          }}
                          className="text-[11px] font-bold text-blue-700 hover:text-white hover:bg-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg transition shrink-0 flex items-center gap-1"
                        >
                          <Edit3 size={11} /> Edit Data Ini
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              title="Perbarui data lokal"
              className="p-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs transition cursor-pointer flex items-center gap-1 shrink-0"
            >
              <RefreshCw size={15} className={isLoading ? "animate-spin text-blue-600" : ""} />
              <span className="hidden sm:inline text-xs font-medium">Refresh</span>
            </button>
          </div>

          {/* Quick Info Bar */}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>
                Menampilkan: <b className="text-slate-800">{filteredCases.length}</b> laporan
                {searchQuery && <span className="text-blue-600 ml-1">untuk pencarian "{searchQuery}"</span>}
              </span>
              {activeEditingId && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10.5px] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  <Edit3 size={11} /> Sedang Diedit: {activeEditingId}
                </span>
              )}
            </div>
            <a
              href={DEFAULT_SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 hover:underline"
            >
              <FileSpreadsheet size={13} /> Buka Google Spreadsheet <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredCases.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3 border-2 border-dashed border-slate-200 rounded-xl p-8">
              <AlertCircle size={32} className="mx-auto text-slate-400" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700">
                  {searchQuery
                    ? `Tidak ada laporan yang sesuai dengan nama/kata kunci "${searchQuery}".`
                    : "Belum ada laporan kasus yang tersimpan di browser ini."}
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Setiap formulir laporan yang telah Anda simpan atau kirim akan otomatis tercatat di sini sehingga bisa dicari dan diedit kapan saja.
                </p>
              </div>
            </div>
          ) : (
            filteredCases.map((item) => {
              const isCurrentlyEditing = activeEditingId === item.id_kasus;
              return (
                <div
                  key={item.id_kasus}
                  id={`case-card-${item.id_kasus}`}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrentlyEditing
                      ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20 shadow-xs"
                      : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {item.id_kasus}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" /> {item.timestamp_submit}
                        </span>
                        {isCurrentlyEditing && (
                          <span className="bg-amber-500 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                            Aktif Di Formulir
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        <span className="text-blue-700">{item.namaKorban}</span>
                        {item.umurKorban && item.umurKorban !== "-" && (
                          <span className="text-xs font-normal text-slate-500">
                            ({item.umurKorban})
                          </span>
                        )}
                        <span className="text-xs font-medium text-slate-400">•</span>
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          HPR: {item.spesiesHPR}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-slate-400" />
                          {item.alamatKejadian} (Kel. {item.kelurahan}, Kec. {item.kecamatan})
                        </span>
                        {item.pelaksanaNama && item.pelaksanaNama !== "-" && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <User size={12} className="text-slate-400" /> Petugas: {item.pelaksanaNama}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        id={`btn-edit-case-${item.id_kasus}`}
                        type="button"
                        onClick={() => {
                          onSelectCaseForEdit(item);
                          onClose();
                        }}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition shadow-xs cursor-pointer ${
                          isCurrentlyEditing
                            ? "bg-amber-600 hover:bg-amber-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                      >
                        <Edit3 size={13} />
                        <span>{isCurrentlyEditing ? "Lanjutkan Edit" : "Pilih & Edit Laporan"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Modal */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-slate-600">
            <Shield size={13} className="text-blue-600" />
            Setelah selesai mengedit, buka Langkah 4 dan klik <b>"Perbarui Data di Google Sheets"</b> untuk menyimpan perubahan ke Spreadsheet.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
