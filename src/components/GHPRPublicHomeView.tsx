import React, { useState, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Syringe,
  MapPin,
  Calendar,
  CheckCircle2,
  Phone,
  Clock,
  Info,
  Users,
  Building2,
  ChevronRight,
  TrendingUp,
  HeartPulse,
  Award,
  Sparkles,
  ExternalLink,
  LogIn
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from "recharts";
import { PatientMonitoringItem, UserAccessProfile } from "../types";
import { PUSKESMAS_LOGO_URL } from "./SignatureData";

interface GHPRPublicHomeViewProps {
  patientsList: PatientMonitoringItem[];
  currentUser: UserAccessProfile | null;
  onOpenLogin: () => void;
  onNavigateToMonitoring: () => void;
  onNavigateToForm?: () => void;
}

const WILAYAH_SANANWETAN = [
  "Sananwetan",
  "Gedog",
  "Bendogerit",
  "Karangtengah",
  "Klampok",
  "Plosokerep",
  "Rembang"
];

const COLORS_PIE = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#64748B"];

export const GHPRPublicHomeView: React.FC<GHPRPublicHomeViewProps> = ({
  patientsList,
  currentUser,
  onOpenLogin,
  onNavigateToMonitoring,
  onNavigateToForm
}) => {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedKelurahan, setSelectedKelurahan] = useState<string>("all");

  // Ekstrak daftar tahun yang tersedia dari data pasien
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    patientsList.forEach((p) => {
      const dateStr = p.tanggalKejadian || p.waktuKejadian || "";
      if (dateStr) {
        const year = dateStr.slice(0, 4);
        if (/^\d{4}$/.test(year)) {
          yearsSet.add(year);
        }
      }
    });
    return Array.from(yearsSet).sort().reverse();
  }, [patientsList]);

  // Data terfilter berdasarkan tahun dan kelurahan
  const filteredPatients = useMemo(() => {
    return patientsList.filter((p) => {
      const dateStr = p.tanggalKejadian || p.waktuKejadian || "";
      const year = dateStr.slice(0, 4);
      if (selectedYear !== "all" && year !== selectedYear) return false;

      const kel = p.kelurahanKejadian || p.kelurahan || "";
      if (selectedKelurahan !== "all") {
        if (selectedKelurahan === "Luar Wilayah") {
          if (WILAYAH_SANANWETAN.includes(kel)) return false;
        } else if (kel.toLowerCase() !== selectedKelurahan.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [patientsList, selectedYear, selectedKelurahan]);

  // Statistik Utama
  const metrics = useMemo(() => {
    const total = filteredPatients.length;
    let aktif = 0;
    let selesai = 0;
    let hewanRisiko = 0;
    let totalDosisVar = 0;
    let varLengkap = 0;

    filteredPatients.forEach((p) => {
      if (p.statusPemantauan === "Dalam Pemantauan (Aktif)") {
        aktif++;
      } else if (p.statusPemantauan === "Selesai Observasi (14 Hari)") {
        selesai++;
      }

      if (
        p.statusHewanObservasi === "Mati dalam 14 Hari" ||
        p.statusHewanObservasi === "Hilang / Kabur" ||
        p.statusHewanObservasi === "Positif Rabies (FAT Lab)" ||
        p.statusHewanObservasi === "Hewan Dieliminasi"
      ) {
        hewanRisiko++;
      }

      // Hitung dosis VAR yang diberikan (Regimen standar: Dosis 0, 7, dan 21)
      let dosesGiven = 0;
      let hasD0 = false;
      let hasD7 = false;
      let hasD21 = false;

      if (p.jadwalVAR) {
        if (p.jadwalVAR.dosis0?.status === "Sudah Diberikan") {
          totalDosisVar++;
          dosesGiven++;
          hasD0 = true;
        }
        if (p.jadwalVAR.dosis7?.status === "Sudah Diberikan") {
          totalDosisVar++;
          dosesGiven++;
          hasD7 = true;
        }
        if (p.jadwalVAR.dosis21?.status === "Sudah Diberikan") {
          totalDosisVar++;
          dosesGiven++;
          hasD21 = true;
        }
        // Jika terdapat dosis 3 pada catatan data sebelumnya
        if (p.jadwalVAR.dosis3?.status === "Sudah Diberikan") {
          totalDosisVar++;
          dosesGiven++;
        }
      }
      // Status lengkap terpenuhi bila dosis 0, 7, dan 21 telah diberikan (atau total minimal 3 dosis)
      if ((hasD0 && hasD7 && hasD21) || dosesGiven >= 3) {
        varLengkap++;
      }
    });

    const completionRate = total > 0 ? Math.round((selesai / total) * 100) : 100;

    return {
      total,
      aktif,
      selesai,
      hewanRisiko,
      totalDosisVar,
      varLengkap,
      completionRate
    };
  }, [filteredPatients]);

  // 1. Data Grafik Sebaran Kasus per Kelurahan
  const kelurahanBarData = useMemo(() => {
    const counts: Record<string, { total: number; aktif: number; selesai: number }> = {};
    
    // Inisialisasi 7 kelurahan
    WILAYAH_SANANWETAN.forEach((k) => {
      counts[k] = { total: 0, aktif: 0, selesai: 0 };
    });
    counts["Luar Wilayah"] = { total: 0, aktif: 0, selesai: 0 };

    filteredPatients.forEach((p) => {
      const kel = p.kelurahanKejadian || p.kelurahan || "";
      const isKnown = WILAYAH_SANANWETAN.find(
        (wk) => wk.toLowerCase() === kel.toLowerCase()
      );
      const targetKey = isKnown || "Luar Wilayah";

      if (!counts[targetKey]) {
        counts[targetKey] = { total: 0, aktif: 0, selesai: 0 };
      }
      counts[targetKey].total += 1;
      if (p.statusPemantauan === "Dalam Pemantauan (Aktif)") {
        counts[targetKey].aktif += 1;
      } else {
        counts[targetKey].selesai += 1;
      }
    });

    return Object.entries(counts).map(([name, data]) => ({
      kelurahan: name,
      Total: data.total,
      Aktif: data.aktif,
      Selesai: data.selesai
    }));
  }, [filteredPatients]);

  // 2. Data Grafik Spesies HPR (Pie Chart)
  const spesiesPieData = useMemo(() => {
    const speciesMap: Record<string, number> = {
      Anjing: 0,
      Kucing: 0,
      "Kera / Monyet": 0,
      Lainnya: 0
    };

    filteredPatients.forEach((p) => {
      const sp = (p.spesiesHPR || "").toLowerCase();
      if (sp.includes("anjing")) {
        speciesMap["Anjing"] += 1;
      } else if (sp.includes("kucing")) {
        speciesMap["Kucing"] += 1;
      } else if (sp.includes("kera") || sp.includes("monyet")) {
        speciesMap["Kera / Monyet"] += 1;
      } else {
        speciesMap["Lainnya"] += 1;
      }
    });

    return Object.entries(speciesMap)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  }, [filteredPatients]);

  // 3. Data Grafik Tren Bulanan
  const monthlyTrendData = useMemo(() => {
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
    ];
    const monthCounts = new Array(12).fill(0);

    filteredPatients.forEach((p) => {
      const dateStr = p.tanggalKejadian || p.waktuKejadian || "";
      if (dateStr) {
        const parts = dateStr.split("-");
        if (parts.length >= 2) {
          const monthIdx = parseInt(parts[1], 10) - 1;
          if (monthIdx >= 0 && monthIdx < 12) {
            monthCounts[monthIdx] += 1;
          }
        }
      }
    });

    return monthNames.map((name, index) => ({
      bulan: name,
      Kasus: monthCounts[index]
    }));
  }, [filteredPatients]);

  // 4. Data Distribusi Kategori Usia
  const ageGroupData = useMemo(() => {
    const groups = {
      "Anak (<12 th)": 0,
      "Remaja (12-18 th)": 0,
      "Dewasa (19-59 th)": 0,
      "Lansia (≥60 th)": 0
    };

    filteredPatients.forEach((p) => {
      const ageNum = parseInt(p.umurKorban, 10);
      if (isNaN(ageNum)) return;

      if (ageNum < 12) {
        groups["Anak (<12 th)"] += 1;
      } else if (ageNum <= 18) {
        groups["Remaja (12-18 th)"] += 1;
      } else if (ageNum <= 59) {
        groups["Dewasa (19-59 th)"] += 1;
      } else {
        groups["Lansia (≥60 th)"] += 1;
      }
    });

    return Object.entries(groups).map(([name, count]) => ({
      kelompok: name,
      Jumlah: count
    }));
  }, [filteredPatients]);

  // 5. Data Status Hewan Observasi
  const animalStatusData = useMemo(() => {
    const statusMap = {
      "Sehat / Normal": 0,
      "Mati dalam 14 Hari": 0,
      "Hilang / Kabur": 0,
      "Lainnya": 0
    };

    filteredPatients.forEach((p) => {
      const s = p.statusHewanObservasi || "";
      if (s.includes("Sehat")) {
        statusMap["Sehat / Normal"] += 1;
      } else if (s.includes("Mati")) {
        statusMap["Mati dalam 14 Hari"] += 1;
      } else if (s.includes("Hilang") || s.includes("Kabur")) {
        statusMap["Hilang / Kabur"] += 1;
      } else {
        statusMap["Lainnya"] += 1;
      }
    });

    return Object.entries(statusMap)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  }, [filteredPatients]);

  // Ringkasan Kasus Terkini (Dianonimkan untuk Publik)
  const recentPublicCases = useMemo(() => {
    return [...filteredPatients]
      .sort((a, b) => {
        const dateA = a.tanggalKejadian || a.waktuKejadian || "";
        const dateB = b.tanggalKejadian || b.waktuKejadian || "";
        return dateB.localeCompare(dateA);
      })
      .slice(0, 5)
      .map((p) => {
        // Samarkan nama menjadi inisial (misal: "Budi Santoso" -> "B. S.")
        const parts = (p.namaKorban || "Pasien").trim().split(" ");
        const initialName = parts.map((part) => part.charAt(0).toUpperCase() + ".").join(" ");
        return {
          id: p.id_kasus,
          initialName,
          umur: p.umurKorban ? `${p.umurKorban} th` : "-",
          kelurahan: p.kelurahan || "Sananwetan",
          hewan: p.spesiesHPR || "Hewan",
          tanggal: p.tanggalKejadian || p.waktuKejadian || "-",
          status: p.statusPemantauan
        };
      });
  }, [filteredPatients]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* 1. HERO SECTION & PORTAL IDENTITAS RESMI */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-blue-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 md:p-10 border border-blue-900/60 shadow-xl">
        {/* Background Decorative Glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>PORTAL INFORMASI & SITUASI EPIDEMIOLOGI RESMI</span>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white p-1.5 shadow-lg shrink-0 flex items-center justify-center border-2 border-white/20">
                <img
                  src={PUSKESMAS_LOGO_URL}
                  alt="Logo UPTD Puskesmas Sananwetan"
                  className="h-full w-full object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                  Infografis & Situasi Kasus GHPR
                </h1>
                <p className="text-sm sm:text-base text-blue-200/90 font-medium mt-1">
                  Penyelidikan Epidemiologi & Pemantauan Kasus Gigitan Hewan Penular Rabies
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-blue-300">
                  <div className="flex items-center gap-1.5 bg-blue-900/60 px-2.5 py-0.5 rounded-lg border border-blue-400/20">
                    <Building2 size={13} className="text-blue-300" />
                    <span>UPTD Puskesmas Sananwetan <b>(FKTP)</b></span>
                  </div>
                  <span className="text-blue-400 hidden sm:inline">•</span>
                  <div className="flex items-center gap-1.5 bg-indigo-900/60 px-2.5 py-0.5 rounded-lg border border-indigo-400/20 text-indigo-200">
                    <ShieldCheck size={13} className="text-emerald-400" />
                    <span>Rabies Center: <b>RSUD Mardi Waluyo</b></span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1 max-w-2xl">
              Portal publikasi terpadu untuk memantau sebaran kasus gigitan, kepatuhan vaksinasi VAR (Dosis 0, 7, dan 21),
              serta alur tata laksana tanggap darurat rabies di 7 kelurahan wilayah kerja UPTD Puskesmas Sananwetan (FKTP)
              berjejaring rujukan dengan Rabies Center RSUD Mardi Waluyo Kota Blitar.
            </p>
          </div>

          {/* Quick Action Button Box */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            {currentUser ? (
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center sm:text-left md:text-center space-y-2">
                <div className="text-[11px] text-blue-200">
                  Petugas Aktif: <b className="text-white">{currentUser.nama.split(",")[0]}</b>
                </div>
                <button
                  id="btn-hero-go-monitoring"
                  type="button"
                  onClick={onNavigateToMonitoring}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
                >
                  <Users size={16} />
                  <span>Buka Panel Pemantauan</span>
                </button>
                {currentUser.username.toLowerCase() === "admin" && onNavigateToForm && (
                  <button
                    id="btn-hero-go-form"
                    type="button"
                    onClick={onNavigateToForm}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <span>+ Input Kasus Baru</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center space-y-2.5">
                <div className="text-[11px] text-blue-200">Akses Petugas & Koordinator Wilayah</div>
                <button
                  id="btn-hero-open-login"
                  type="button"
                  onClick={onOpenLogin}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
                >
                  <LogIn size={16} />
                  <span>Masuk Petugas Faskes</span>
                </button>
                <div className="text-[10px] text-slate-400">
                  Untuk mengupdate catatan harian & observasi pasien
                </div>
              </div>
            )}

            <a
              href="#section-first-aid"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white text-xs font-medium border border-white/10 transition"
            >
              <HeartPulse size={15} className="text-rose-400" />
              <span>Prosedur Tanggap Gigitan</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. FILTER PERIODE & WILAYAH CEPAT */}
      <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Activity size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Filter Situasi & Grafik Kasus</h2>
              <p className="text-xs text-slate-500">Sesuaikan rentang tahun dan wilayah kerja untuk data spesifik</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter Tahun */}
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar size={14} className="text-slate-500" />
              <label htmlFor="filter-year" className="font-semibold text-slate-700">
                Tahun:
              </label>
              <select
                id="filter-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Tahun</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Tahun {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kelurahan */}
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin size={14} className="text-slate-500" />
              <label htmlFor="filter-kelurahan" className="font-semibold text-slate-700">
                Kelurahan:
              </label>
              <select
                id="filter-kelurahan"
                value={selectedKelurahan}
                onChange={(e) => setSelectedKelurahan(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Semua Kelurahan</option>
                {WILAYAH_SANANWETAN.map((kel) => (
                  <option key={kel} value={kel}>
                    Kel. {kel}
                  </option>
                ))}
                <option value="Luar Wilayah">Luar Wilayah</option>
              </select>
            </div>

            {(selectedYear !== "all" || selectedKelurahan !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear("all");
                  setSelectedKelurahan("all");
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2 py-1 underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3. KARTU INDIKATOR UTAMA (KEY METRICS) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Kasus */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Kasus</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {metrics.total}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Kasus gigitan terdata</p>
          </div>
        </div>

        {/* Aktif Pemantauan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200 bg-linear-to-b from-amber-50/40 to-white shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">Aktif Observasi</span>
            <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-900 tracking-tight">
              {metrics.aktif}
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5">Masa observasi 14 hari</p>
          </div>
        </div>

        {/* Selesai Observasi */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200 bg-linear-to-b from-emerald-50/40 to-white shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">Observasi Tuntas</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 tracking-tight">
              {metrics.selesai}
            </div>
            <p className="text-[11px] text-emerald-800 mt-0.5">Kondisi aman & sehat</p>
          </div>
        </div>

        {/* Hewan Berisiko */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-rose-200 bg-linear-to-b from-rose-50/40 to-white shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">Hewan Berisiko</span>
            <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-900 tracking-tight">
              {metrics.hewanRisiko}
            </div>
            <p className="text-[11px] text-rose-800 mt-0.5">Mati / hilang / kabur</p>
          </div>
        </div>

        {/* Cakupan Vaksinasi VAR */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-200 bg-linear-to-b from-indigo-50/40 to-white shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900">Dosis VAR Diberikan</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Syringe size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-indigo-900 tracking-tight">
              {metrics.totalDosisVar}
            </div>
            <p className="text-[11px] text-indigo-800 mt-0.5 font-medium">
              Regimen 0, 7, 21 ({metrics.varLengkap} pasien tuntas)
            </p>
          </div>
        </div>
      </section>

      {/* 4. VISUALISASI GRAFIK UTAMA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grafik 1: Sebaran Kasus per Kelurahan */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Sebaran Kasus per Kelurahan</h3>
              <p className="text-xs text-slate-500">Distribusi wilayah kerja UPTD Puskesmas Sananwetan</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
              Wilayah Sananwetan
            </span>
          </div>

          <div className="h-72 w-full pt-2 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <BarChart data={kelurahanBarData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="kelurahan"
                  tick={{ fontSize: 11, fill: "#475569" }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderRadius: "12px",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)"
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="Aktif" stackId="a" fill="#F59E0B" name="Dalam Pemantauan" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Selesai" stackId="a" fill="#10B981" name="Selesai Observasi" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafik 2: Spesies Hewan Penular Rabies */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Spesies Hewan Gigitan (HPR)</h3>
              <p className="text-xs text-slate-500">Proporsi jenis hewan penular rabies yang terlibat</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold">
              Spesies HPR
            </span>
          </div>

          <div className="h-72 w-full flex items-center justify-center min-w-0">
            {spesiesPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                <PieChart>
                  <Pie
                    data={spesiesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {spesiesPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderRadius: "12px",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      border: "none"
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400 text-center">Belum ada data spesies gigitan untuk filter ini</div>
            )}
          </div>
        </div>

        {/* Grafik 3: Tren Kasus Bulanan */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Tren Kasus Gigitan Bulanan</h3>
              <p className="text-xs text-slate-500">Distribusi kejadian gigitan per bulan berjalan</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
              Kurva Epidemiologi
            </span>
          </div>

          <div className="h-72 w-full pt-2 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorKasus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderRadius: "12px",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    border: "none"
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Kasus"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorKasus)"
                  name="Jumlah Kasus"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafik 4: Distribusi Kelompok Usia Korban */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Demografi Kelompok Usia Korban</h3>
              <p className="text-xs text-slate-500">Rentang usia populasi terdampak kasus gigitan</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-[11px] font-bold">
              Demografi
            </span>
          </div>

          <div className="h-72 w-full pt-2 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
              <BarChart data={ageGroupData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="kelompok" tick={{ fontSize: 11, fill: "#475569" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#475569" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderRadius: "12px",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    border: "none"
                  }}
                />
                <Bar dataKey="Jumlah" fill="#8B5CF6" radius={[6, 6, 0, 0]} name="Korban Gigitan" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. TABEL SITUASI TERKINI (ANONIM / PRIVASI AMAN) */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">Catatan Kasus Terkini (Transparansi Publik)</h3>
            <p className="text-xs text-slate-500">
              Menampilkan 5 pelaporan terbaru (Nama pasien disamarkan sesuai protokol privasi medis)
            </p>
          </div>
          {currentUser && (
            <button
              type="button"
              onClick={onNavigateToMonitoring}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
            >
              <span>Lihat Detail Lengkap Pasien</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Inisial Korban</th>
                <th className="px-4 py-3">Usia</th>
                <th className="px-4 py-3">Wilayah Kelurahan</th>
                <th className="px-4 py-3">Spesies HPR</th>
                <th className="px-4 py-3">Tanggal Kejadian</th>
                <th className="px-4 py-3 text-right">Status Observasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPublicCases.length > 0 ? (
                recentPublicCases.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                        {item.initialName.charAt(0)}
                      </span>
                      <span>{item.initialName}</span>
                    </td>
                    <td className="px-4 py-3">{item.umur}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-medium">
                        <MapPin size={11} className="text-slate-500" />
                        Kel. {item.kelurahan}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.hewan}</td>
                    <td className="px-4 py-3 text-slate-600">{item.tanggal}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          item.status === "Dalam Pemantauan (Aktif)"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Belum ada data kasus yang tercatat untuk filter ini
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. PANDUAN TANGGAP DARURAT GIGITAN (EDUKASI PUBLIK KEMENKES RI) */}
      <section
        id="section-first-aid"
        className="rounded-3xl border border-rose-200 bg-linear-to-br from-rose-50/70 via-white to-amber-50/50 p-6 sm:p-8 shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-200/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Panduan Edukasi Masyarakat
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Pertolongan Pertama Kasus Gigitan Hewan Penular Rabies
              </h2>
            </div>
          </div>
          <div className="text-xs font-semibold text-rose-700 bg-rose-100 px-3 py-1.5 rounded-full shrink-0">
            SOP Kemenkes RI & Dinas Kesehatan
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Langkah 1 */}
          <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs space-y-2 relative overflow-hidden">
            <div className="text-3xl font-black text-rose-200 absolute top-2 right-3 pointer-events-none">01</div>
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              💧
            </div>
            <h4 className="text-sm font-bold text-slate-900">Cuci Luka Segera</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cuci luka gigitan atau cakaran dengan <b>air bersih mengalir dan sabun / deterjen selama 10–15 menit</b> sesegera mungkin setelah kejadian.
            </p>
          </div>

          {/* Langkah 2 */}
          <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs space-y-2 relative overflow-hidden">
            <div className="text-3xl font-black text-rose-200 absolute top-2 right-3 pointer-events-none">02</div>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              🧴
            </div>
            <h4 className="text-sm font-bold text-slate-900">Beri Antiseptik</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Oleskan antiseptik berupa <b>Povidone Iodine (Betadine)</b> atau alkohol 70% pada area luka setelah dicuci bersih untuk membunuh virus.
            </p>
          </div>

          {/* Langkah 3 */}
          <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs space-y-2 relative overflow-hidden">
            <div className="text-3xl font-black text-rose-200 absolute top-2 right-3 pointer-events-none">03</div>
            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              🏥
            </div>
            <h4 className="text-sm font-bold text-slate-900">Periksa ke FKTP / Puskesmas</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Segera periksakan diri ke <b>UPTD Puskesmas Sananwetan (FKTP)</b> untuk penanganan luka medis standar, atau dirujuk ke <b>Rabies Center RSUD Mardi Waluyo</b> untuk tata laksana VAR/SAR lanjutan.
            </p>
          </div>

          {/* Langkah 4 */}
          <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs space-y-2 relative overflow-hidden">
            <div className="text-3xl font-black text-rose-200 absolute top-2 right-3 pointer-events-none">04</div>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              🐕
            </div>
            <h4 className="text-sm font-bold text-slate-900">Observasi Hewan 14 Hari</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kandangkan atau ikat hewan yang menggigit. <b>Jangan dibunuh</b> jika memungkinkan, amati apakah hewan tetap sehat atau mati dalam 14 hari.
            </p>
          </div>
        </div>
      </section>

      {/* 7. INFORMASI FASKES FKTP & RABIES CENTER KOTA BLITAR */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold mb-2">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>Jejaring Pelayanan Kasus Rabies Terpadu Kota Blitar</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">
              Fasilitas Kesehatan FKTP & Rabies Center
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Alur koordinasi penanganan gigitan antara Puskesmas sebagai Fasilitas Kesehatan Tingkat Pertama (FKTP) dan RSUD Mardi Waluyo sebagai Rabies Center.
            </p>
          </div>

          {/* Badge Regimen VAR */}
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 shrink-0">
            <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
              <Syringe size={14} className="text-indigo-600" />
              <span>Standar Layanan Vaksin (VAR)</span>
            </div>
            <div className="text-xs font-extrabold text-indigo-700 mt-0.5">
              Regimen 3 Kunjungan: Dosis 0, 7, dan 21
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Rabies Center (RSUD Mardi Waluyo) */}
          <div className="p-5 rounded-2xl bg-linear-to-b from-blue-50/80 to-white border border-blue-200 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg">
                Rabies Center Kota Blitar
              </span>
              <span className="text-[11px] font-semibold text-blue-700">Faskes Rujukan</span>
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900">
                RSUD Mardi Waluyo Kota Blitar
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                Pusat Rujukan Rabies (Rabies Center) resmi Kota Blitar untuk penanganan luka gigitan risiko tinggi, penyediaan Serum Anti Rabies (SAR), serta perawatan intensif spesifik.
              </p>
            </div>

            <div className="text-xs text-slate-700 space-y-2 pt-2 border-t border-blue-100">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <span>Jl. Kalimantan No. 113, Sananwetan, Kota Blitar</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-blue-600 shrink-0" />
                <span>IGD 24 Jam / Layanan Rabies Center Terpadu</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-blue-600 shrink-0" />
                <span>Telepon: (0342) 801118 / PSC 119</span>
              </div>
            </div>
          </div>

          {/* Card 2: Faskes FKTP (UPTD Puskesmas Sananwetan) */}
          <div className="p-5 rounded-2xl bg-linear-to-b from-emerald-50/70 to-white border border-emerald-200 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-lg">
                Fasilitas Kesehatan Tingkat Pertama (FKTP)
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">Penanganan Awal</span>
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900">
                UPTD Puskesmas Sananwetan
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mt-1">
                Melayani pertolongan pertama pencucian luka standar medis (15 menit air mengalir + sabun/antiseptik), Penyelidikan Epidemiologi (PE), edukasi warga, dan rujukan kasus.
              </p>
            </div>

            <div className="text-xs text-slate-700 space-y-2 pt-2 border-t border-emerald-100">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Jl. Kalimantan No. 67, Kel. Sananwetan, Kota Blitar</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-emerald-600 shrink-0" />
                <span>Pelayanan Poli & UGD: Senin – Sabtu</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-emerald-600 shrink-0" />
                <span>Telepon Informasi: (0342) 801648</span>
              </div>
            </div>
          </div>

          {/* Card 3: Regimen VAR & Wilayah Pemantauan 7 Kelurahan */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Syringe size={15} className="text-indigo-600" />
                <span>Tahapan Dosis Vaksin Anti Rabies (VAR)</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-black text-indigo-600 text-xs">Dosis 0</div>
                  <div className="text-[10px] text-slate-600 font-bold mt-0.5">Hari Ke-0</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Saat kunjungan</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-black text-indigo-600 text-xs">Dosis 7</div>
                  <div className="text-[10px] text-slate-600 font-bold mt-0.5">Hari Ke-7</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Minggu ke-1</div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-200">
                  <div className="font-black text-indigo-600 text-xs">Dosis 21</div>
                  <div className="text-[10px] text-slate-600 font-bold mt-0.5">Hari Ke-21</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Minggu ke-3</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                <Info size={13} className="text-blue-600" />
                <span>Wilayah Pemantauan PE 7 Kelurahan:</span>
              </div>
              <div className="flex flex-wrap gap-1 text-[11px]">
                {WILAYAH_SANANWETAN.map((wil) => (
                  <span
                    key={wil}
                    className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold"
                  >
                    {wil}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 italic pt-1">
                Observasi hewan 14 hari dipantau bersama tenaga kesehatan PJ Kelurahan & kader posyandu.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
