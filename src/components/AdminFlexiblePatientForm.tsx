import React, { useState, useMemo } from "react";
import {
  FilePlus,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Save,
  Loader2,
  Users,
  ExternalLink,
  Info,
  Check
} from "lucide-react";
import { FormGHPRData, UserAccessProfile } from "../types";
import { FormSteps } from "./FormSteps";
import { OFFICIAL_SIGNATURE_STAMP_URL, DEFAULT_PELAKSANA_NAMA, DEFAULT_PELAKSANA_NIP } from "./SignatureData";
import {
  sendToAppsScript,
  DEFAULT_WEB_APP_URL,
  getSavedSheetConfig
} from "../lib/googleSheets";
import {
  syncPatientFromFormSubmission,
  getActiveUserProfile
} from "../lib/patientMonitoring";
import { addToOfflineQueue, isAppOnline } from "../lib/offlineSyncService";

const initialFlexibleFormState: FormGHPRData = {
  waktuKejadian: "",
  alamatKejadian: "",
  kelurahan: "",
  kelurahanCustom: "",
  kecamatan: "",
  kecamatanCustom: "",
  kabupatenKota: "Kota Blitar",
  kabupatenKotaCustom: "",
  provinsi: "Jawa Timur",
  sumberInfo: "",
  kronologi: "",
  spesiesHPR: "",
  spesiesLain: "",
  ras: "",
  jkHewan: "",
  umurHewan: "",
  satuanUmur: "Tahun",
  metodePelihara: "",
  asalHewan: "",
  pakan: "",
  biosekuriti: "",
  sumberAir: "",
  kondisiHewan: "",
  pemilikHewan: "",
  alamatPemilik: "",
  kontakPemilik: "",
  riwayatVaksin: "",
  tanggalVaksin: "",
  namaKorban: "",
  umurKorban: "",
  alamatKorban: "",
  noHpKorban: "",
  jkKorban: "",
  kondisiKorban: "",
  pertolonganPertama: "",
  detailPertolongan: "",
  kondisiLuka: "",
  lokasiLuka: "",
  tindakanHPR: "",
  tindakanKasus: "",
  tindakanMasyarakat: "",
  rekomendasi: "",
  sumberLaporan: "",
  fotoDokumentasi: "",
  timKetua: "",
  timAnggota: "",
  tanggalPelaksanaan: new Date().toISOString().slice(0, 10),
  pelaksanaNama: DEFAULT_PELAKSANA_NAMA,
  pelaksanaNIP: DEFAULT_PELAKSANA_NIP,
  tandaTanganUrl: OFFICIAL_SIGNATURE_STAMP_URL,
  tandaTanganOtomatis: false,
  jenisTandaTangan: "gambar"
};

const listKelurahan = [
  "Sananwetan",
  "Gedog",
  "Bendogerit",
  "Karangtengah",
  "Klampok",
  "Plosokerep",
  "Rembang"
];

const listKecamatan = ["Sananwetan", "Kepanjenkidul", "Sukorejo"];
const listKabKota = ["Kota Blitar", "Kab Blitar"];
const OTHER_VAL = "Lainnya";
const OTHER_DATALIST = "Lainnya - ketik manual";

interface AdminFlexiblePatientFormProps {
  webAppUrl?: string;
  onPatientAdded?: (patientId: string) => void;
  onSwitchToMonitoring?: () => void;
}

export const AdminFlexiblePatientForm: React.FC<AdminFlexiblePatientFormProps> = ({
  webAppUrl = DEFAULT_WEB_APP_URL,
  onPatientAdded,
  onSwitchToMonitoring
}) => {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormGHPRData>(() => ({
    ...initialFlexibleFormState,
    tanggalPelaksanaan: new Date().toISOString().slice(0, 10),
  }));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<{
    id: string;
    namaKorban: string;
    time: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string>("");

  const updateField = (field: keyof FormGHPRData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isOther = (val?: string) => {
    const trimmed = (val || "").trim().toLowerCase();
    return (
      trimmed === "lainnya" ||
      trimmed === "lainnya - ketik manual" ||
      trimmed.startsWith("lainnya")
    );
  };

  const isExactOther = (val?: string) => (val || "").trim().toLowerCase() === "lainnya";

  const getFinalKelurahan = () => {
    if (isOther(formData.kelurahan)) return (formData.kelurahanCustom || "").trim();
    return (formData.kelurahan || "").trim();
  };

  const getFinalKecamatan = () => {
    if (isOther(formData.kecamatan)) return (formData.kecamatanCustom || "").trim();
    return (formData.kecamatan || "").trim();
  };

  const getFinalKabKota = () => {
    if (isOther(formData.kabupatenKota)) return (formData.kabupatenKotaCustom || "").trim();
    return (formData.kabupatenKota || "").trim();
  };

  const handleReset = () => {
    setFormData({
      ...initialFlexibleFormState,
      tanggalPelaksanaan: new Date().toISOString().slice(0, 10),
    });
    setStep(1);
    setSubmitSuccess(null);
    setSubmitError("");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedId = `GHPR-${dateStr}-${randomSuffix}`;

    const activeUser = getActiveUserProfile();
    const finalKel = getFinalKelurahan();
    const finalKec = getFinalKecamatan();
    const finalKab = getFinalKabKota();

    const kel = finalKel || formData.kelurahan || (activeUser?.kelurahan && activeUser.kelurahan !== "Semua" ? activeUser.kelurahan : "Sananwetan");
    const kec = finalKec || formData.kecamatan || "Sananwetan";
    const kab = finalKab || formData.kabupatenKota || "Kota Blitar";
    const namaPasien = (formData.namaKorban || "").trim() || "Pasien Baru (Admin)";

    const payload = {
      id_kasus: generatedId,
      timestamp_submit: now.toISOString(),
      ...formData,
      action: "create",
      is_update: false,
      namaKorban: namaPasien,
      kelurahan: kel,
      kecamatan: kec,
      kabupatenKota: kab,
      provinsi: formData.provinsi || "Jawa Timur",
      spesies_final: formData.spesiesHPR === "Lainnya" ? (formData.spesiesLain || "Lainnya") : (formData.spesiesHPR || "Anjing"),
      kelurahan_final: kel,
      kecamatan_final: kec,
      kabupatenKota_final: kab,
      waktuKejadian: formData.waktuKejadian || now.toISOString().slice(0, 16),
      tanggalPelaksanaan: formData.tanggalPelaksanaan || now.toISOString().slice(0, 10),
      pelaksanaNama: formData.pelaksanaNama || DEFAULT_PELAKSANA_NAMA,
      pelaksanaNIP: formData.pelaksanaNIP || DEFAULT_PELAKSANA_NIP,
      kondisiLuka: formData.kondisiLuka || "Kategori 1",
      noHpKorban: formData.noHpKorban || formData.kontakPemilik || "-",
    };

    const saveLocalHistory = () => {
      try {
        const savedHistory = localStorage.getItem("ghpr_recorded_submissions") || "[]";
        const parsed = JSON.parse(savedHistory);
        parsed.unshift({ ...payload, timestamp_recorded: new Date().toISOString() });
        localStorage.setItem("ghpr_recorded_submissions", JSON.stringify(parsed));

        const sheetConfigStr = localStorage.getItem("ghpr_google_sheet_config_v1");
        if (sheetConfigStr) {
          const cfg = JSON.parse(sheetConfigStr);
          cfg.totalRecorded = (cfg.totalRecorded || 0) + 1;
          localStorage.setItem("ghpr_google_sheet_config_v1", JSON.stringify(cfg));
        }
      } catch (e) {
        console.warn("Gagal simpan riwayat lokal:", e);
      }
    };

    try {
      const onlineNow = isAppOnline();

      if (!onlineNow) {
        // Simpan ke antrean offline jika jaringan terputus
        addToOfflineQueue({
          type: "new_case",
          caseId: payload.id_kasus,
          patientName: payload.namaKorban,
          kelurahan: payload.kelurahan,
          payload: payload
        });
        saveLocalHistory();
        syncPatientFromFormSubmission(payload as unknown as FormGHPRData, payload.id_kasus, false);
      } else {
        const targetUrl = (webAppUrl || DEFAULT_WEB_APP_URL).trim();
        await sendToAppsScript(targetUrl, payload, "create");
        saveLocalHistory();
        syncPatientFromFormSubmission(payload as unknown as FormGHPRData, payload.id_kasus, false);
      }

      setSubmitSuccess({
        id: payload.id_kasus,
        namaKorban: payload.namaKorban,
        time: new Date().toLocaleTimeString("id-ID")
      });

      if (onPatientAdded) {
        onPatientAdded(payload.id_kasus);
      }
    } catch (err: any) {
      console.warn("Koneksi gagal, mengamankan ke antrean offline:", err);
      addToOfflineQueue({
        type: "new_case",
        caseId: payload.id_kasus,
        patientName: payload.namaKorban,
        kelurahan: payload.kelurahan,
        payload: payload
      });
      saveLocalHistory();
      syncPatientFromFormSubmission(payload as unknown as FormGHPRData, payload.id_kasus, false);

      setSubmitSuccess({
        id: payload.id_kasus,
        namaKorban: payload.namaKorban,
        time: new Date().toLocaleTimeString("id-ID")
      });

      if (onPatientAdded) {
        onPatientAdded(payload.id_kasus);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, title: "Informasi Dasar", desc: "Waktu & Wilayah" },
    { num: 2, title: "Data Hewan HPR", desc: "Spesies & Status" },
    { num: 3, title: "Data Pasien & Klinis", desc: "Korban & Luka" },
    { num: 4, title: "Tindak Lanjut & Validasi", desc: "Rekomendasi & Petugas" }
  ];

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Header Banner Salinan Formulir Fleksibel */}
      <div className="rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-900 via-teal-900 to-slate-900 p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
            <FilePlus size={24} className="text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Salinan Formulir PE GHPR (Input Pasien Baru Fleksibel)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                Khusus Admin
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                Boleh Dikosongi di Seluruh Pertanyaan
              </span>
            </div>
            <p className="text-xs text-emerald-100/90 mt-1 max-w-2xl leading-relaxed">
              Formulir ini tidak memiliki tanda bintang merah (<span className="text-rose-300 font-bold">*</span>) sehingga seluruh pertanyaan boleh dikosongi tanpa validasi wajib. Digunakan untuk input cepat pasien baru langsung oleh Admin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/20 cursor-pointer"
            title="Kosongkan formulir"
          >
            <RotateCcw size={13} /> Kosongkan
          </button>
          {onSwitchToMonitoring && (
            <button
              type="button"
              onClick={onSwitchToMonitoring}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Users size={14} /> Daftar Pasien
            </button>
          )}
        </div>
      </div>

      {/* Pesan Sukses Submit */}
      {submitSuccess && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 shadow-sm animate-in zoom-in-95">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-900">
                  Pasien Baru Berhasil Disimpan & Masuk Pemantauan!
                </h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  ID Kasus: <strong className="font-mono bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-900">{submitSuccess.id}</strong> — Korban: <strong>{submitSuccess.namaKorban}</strong> ({submitSuccess.time})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <FilePlus size={14} /> + Input Pasien Baru Lagi
              </button>
              {onSwitchToMonitoring && (
                <button
                  type="button"
                  onClick={onSwitchToMonitoring}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition cursor-pointer"
                >
                  <Users size={14} /> Lihat di Pemantauan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Petunjuk Boleh Dikosongi */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs text-blue-900 flex items-center gap-2.5">
        <Info size={18} className="text-blue-600 shrink-0" />
        <div>
          <strong>Catatan Fleksibilitas:</strong> Anda dapat berpindah langkah (1, 2, 3, 4) kapan saja secara bebas atau langsung menekan tombol <strong>Simpan & Buat Pasien Baru</strong> di bawah. Field yang belum diisi akan diberi nilai default otomatis.
        </div>
      </div>

      {/* Stepper Navigasi Langkah */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        {stepsList.map((st) => (
          <button
            key={st.num}
            type="button"
            onClick={() => setStep(st.num)}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left transition cursor-pointer ${
              step === st.num
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold ring-2 ring-emerald-500/20"
                : "text-slate-600 hover:bg-slate-200/60"
            }`}
          >
            <div
              className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                step === st.num
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-300 text-slate-700"
              }`}
            >
              {st.num}
            </div>
            <div className="min-w-0">
              <div className="text-xs truncate font-semibold">{st.title}</div>
              <div className="text-[10px] text-slate-400 truncate">{st.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Form Input Area */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <FormSteps
          step={step}
          formData={formData}
          errors={{}}
          updateField={updateField}
          listKelurahan={listKelurahan}
          listKecamatan={listKecamatan}
          listKabKota={listKabKota}
          OTHER_VAL={OTHER_VAL}
          OTHER_DATALIST={OTHER_DATALIST}
          isOther={isOther}
          isExactOther={isExactOther}
          getFinalKelurahan={getFinalKelurahan}
          getFinalKecamatan={getFinalKecamatan}
          getFinalKabKota={getFinalKabKota}
          isAdminMode={true}
          isEditing={false}
          showAsterisk={false}
        />

        {submitError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-2 font-medium">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Footer Navigasi Langkah & Tombol Simpan */}
        <div className="mt-8 pt-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <ArrowLeft size={14} /> Langkah {step - 1}
              </button>
            )}
            {step < 4 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Langkah {step + 1} <ArrowRight size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              <RotateCcw size={13} /> Reset
            </button>

            <button
              id="btn-submit-flexible-patient"
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Menyimpan Pasien...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Simpan & Buat Pasien Baru</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
