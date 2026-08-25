import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Send,
  TriangleAlert,
  X,
  Printer,
  RotateCcw,
  PlusCircle,
  Save,
  ExternalLink,
  FileSpreadsheet,
  Search,
  Edit3,
  RefreshCw,
  Clock,
  Users,
  KeyRound,
  FileText,
  ShieldAlert,
  Github,
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { FormGHPRData, FormErrors, SubmissionResult, UserAccessProfile, PatientMonitoringItem } from "./types";
import { Header } from "./components/Header";
import { StepTracker, stepsList } from "./components/StepTracker";
import { SidebarSummary } from "./components/SidebarSummary";
import { FormSteps } from "./components/FormSteps";
import { JsonModal } from "./components/JsonModal";
import { PrintPDFModal } from "./components/PrintPDFModal";
import { ResetConfirmModal } from "./components/ResetConfirmModal";
import { AdminCaseSearchModal } from "./components/AdminCaseSearchModal";
import { NavigationTabs, ActiveAppTab } from "./components/NavigationTabs";
import { PatientMonitoringDashboard } from "./components/PatientMonitoringDashboard";
import { LoginModal } from "./components/LoginModal";
import { UserLoginView } from "./components/UserLoginView";
import { GoogleSheetsManager } from "./components/GoogleSheetsManager";
import { OfflineSyncModal } from "./components/OfflineSyncModal";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { GvizSyncErrorBanner } from "./components/GvizSyncErrorBanner";
import {
  isAppOnline,
  getPendingQueueCount,
  addToOfflineQueue,
  syncAllPendingQueue
} from "./lib/offlineSyncService";
import {
  getAllPatients,
  getActiveUserProfile,
  saveActiveUserProfile,
  syncPatientFromFormSubmission,
  upsertPatient,
  deletePatientById,
  PREDEFINED_USER_PROFILES,
  logoutPetugas,
  recordUserActivity,
  getLastUserActivityTimestamp,
  INACTIVITY_TIMEOUT_MS,
  isSessionExpired,
  pullAllCloudData
} from "./lib/patientMonitoring";
import {
  computeAppNotifications,
  AppNotification
} from "./lib/notificationService";
import { OFFICIAL_SIGNATURE_STAMP_URL, DEFAULT_PELAKSANA_NAMA, DEFAULT_PELAKSANA_NIP } from "./components/SignatureData";
import {
  sendToAppsScript,
  DEFAULT_WEB_APP_URL,
  StoredCaseItem,
  ConnectedSheetConfig,
  getSavedSheetConfig,
  saveSheetConfig
} from "./lib/googleSheets";

const STORAGE_KEY_FORM = "ghpr_form_draft_data_v1";
const STORAGE_KEY_STEP = "ghpr_form_draft_step_v1";
const STORAGE_KEY_SAVED_AT = "ghpr_form_draft_time_v1";
const STORAGE_KEY_EDITING_ID = "ghpr_form_editing_case_id_v1";
const STORAGE_KEY_ACTIVE_TAB = "ghpr_active_app_tab_v2";

const initialFormState: FormGHPRData = {
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

export default function App() {
  const [step, setStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STEP);
      if (saved) {
        const parsed = Number(saved);
        if (parsed >= 1 && parsed <= 4) return parsed;
      }
    } catch (err) {
      console.warn("Gagal membaca step dari localStorage:", err);
    }
    return 1;
  });

  const [formData, setFormData] = useState<FormGHPRData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FORM);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...initialFormState,
          ...parsed,
          pelaksanaNama: DEFAULT_PELAKSANA_NAMA,
          pelaksanaNIP: DEFAULT_PELAKSANA_NIP
        };
      }
    } catch (err) {
      console.warn("Gagal membaca draft dari localStorage:", err);
    }
    return initialFormState;
  });

  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SAVED_AT);
    } catch {
      return null;
    }
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    // Check URL parameters first for cross-domain sharing
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const ep = params.get("endpoint") || params.get("webAppUrl") || params.get("url");
        if (ep && ep.includes("script.google.com") && ep.startsWith("http")) {
          localStorage.setItem("ghpr_google_sheets_url_v1", ep);
          return ep;
        }
      } catch (err) {}
    }
    try {
      const saved = localStorage.getItem("ghpr_google_sheets_url_v1");
      if (saved && saved.trim() && saved.startsWith("https://script.google.com/macros/s/")) {
        return saved.trim();
      }
    } catch (e) {
      console.warn("Gagal membaca webAppUrl dari localStorage:", e);
    }
    return DEFAULT_WEB_APP_URL;
  });
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        if (
          params.get("admin") === "1" ||
          params.get("admin") === "true" ||
          params.get("mode") === "admin" ||
          params.get("dev") === "1"
        ) {
          return true;
        }
        const saved = localStorage.getItem("ghpr_app_view_mode");
        if (saved === "admin") return true;
      } catch (e) {}
    }
    return false;
  });

  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [editingCaseId, setEditingCaseId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_EDITING_ID);
    } catch {
      return null;
    }
  });
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedData, setSubmittedData] = useState<SubmissionResult | null>(null);
  const [submitError, setSubmitError] = useState<string>("");
  const [feedbackCount, setFeedbackCount] = useState<number>(0);

  // Tab Navigasi & Hak Akses Pengguna
  const [activeTab, setActiveTab] = useState<ActiveAppTab>(() => {
    try {
      const user = getActiveUserProfile();
      const isAdm = user && (user.username.toLowerCase() === "admin" || user.role === "admin");
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
      if (saved === "monitoring" || saved === "form" || saved === "settings") {
        if (!isAdm && saved === "form" && !localStorage.getItem(STORAGE_KEY_EDITING_ID)) {
          return "monitoring";
        }
        return saved as ActiveAppTab;
      }
    } catch (e) {}
    return "monitoring";
  });

  const [adminSettingsSubTab, setAdminSettingsSubTab] = useState<"accounts" | "sync" | "sheets" | "github" | "flexible_form">("flexible_form");
  const [sheetConfig, setSheetConfig] = useState<ConnectedSheetConfig>(() => getSavedSheetConfig());

  const [currentUser, setCurrentUser] = useState<UserAccessProfile | null>(() => {
    return getActiveUserProfile();
  });

  // Mode Form Fleksibel (Revisi tanpa tanda bintang *, seluruh isian boleh dikosongi untuk input pasien baru)
  const [isFlexibleMode, setIsFlexibleMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("ghpr_form_flexible_mode");
      if (stored !== null) return stored === "true";
      const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      if (params && (params.get("flexible") === "1" || params.get("mode") === "flexible" || params.get("user") === "admin")) return true;
      const user = getActiveUserProfile();
      if (user && (user.username.toLowerCase() === "admin" || user.role === "admin" || user.isKoordinator)) return true;
      return true; // Default aktif untuk mempermudah perekaman pasien baru tanpa terhalang bintang merah
    } catch {
      return true;
    }
  });

  const toggleFlexibleMode = (val?: boolean) => {
    const nextVal = typeof val === "boolean" ? val : !isFlexibleMode;
    setIsFlexibleMode(nextVal);
    try {
      localStorage.setItem("ghpr_form_flexible_mode", String(nextVal));
    } catch (e) {}
    setErrors({});
    setSubmitError("");
  };

  // Notifikasi Sesi Berakhir Otomatis (Inactivity Timeout 1 Jam)
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string>(() => {
    if (typeof window !== "undefined" && isSessionExpired()) {
      return "Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 1 jam. Silakan masuk kembali.";
    }
    return "";
  });

  // Listener Aktivitas Pengguna & Pemantau Inaktivitas 1 Jam (60 menit)
  useEffect(() => {
    if (!currentUser) return;

    // Catat aktivitas awal saat login aktif
    recordUserActivity();

    let lastRecordedTs = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle: simpan ke localStorage maksimal tiap 3 detik untuk efisiensi
      if (now - lastRecordedTs > 3000) {
        lastRecordedTs = now;
        recordUserActivity();
      }
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
      "focus"
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Pengecekan interval berkala setiap 10 detik
    const inactivityInterval = setInterval(() => {
      const lastActive = getLastUserActivityTimestamp();
      const elapsed = Date.now() - lastActive;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        // Otomatis logout karena tidak aktif selama 1 jam
        logoutPetugas();
        setCurrentUser(null);
        setShowLoginModal(false);
        setShowSearchModal(false);
        setShowJsonModal(false);
        setShowPdfModal(false);
        setShowResetModal(false);
        setShowConfig(false);
        setShowOfflineModal(false);
        setSessionExpiredNotice(
          "Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 1 jam. Silakan masuk kembali."
        );
      }
    }, 10000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      clearInterval(inactivityInterval);
    };
  }, [currentUser]);

  // State untuk navigasi dari notifikasi langsung ke pasien tertentu di dashboard
  const [targetNotificationPatientId, setTargetNotificationPatientId] = useState<string | null>(null);
  const [targetNotificationAction, setTargetNotificationAction] = useState<"update_var" | "open_detail" | "update_log" | null>(null);

  useEffect(() => {
    const handleOfficersSync = () => {
      const refreshed = getActiveUserProfile();
      setCurrentUser(refreshed);
    };
    const handlePatientDataSync = () => {
      setPatientsList(getAllPatients());
    };
    window.addEventListener("ghpr_officers_updated", handleOfficersSync);
    window.addEventListener("ghpr_patient_data_updated", handlePatientDataSync);
    window.addEventListener("storage", handleOfficersSync);
    window.addEventListener("storage", handlePatientDataSync);
    return () => {
      window.removeEventListener("ghpr_officers_updated", handleOfficersSync);
      window.removeEventListener("ghpr_patient_data_updated", handlePatientDataSync);
      window.removeEventListener("storage", handleOfficersSync);
      window.removeEventListener("storage", handlePatientDataSync);
    };
  }, []);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [patientsList, setPatientsList] = useState<PatientMonitoringItem[]>(() => getAllPatients());

  // State Manajemen Mode Offline & Antrean Sinkronisasi
  const [isOnline, setIsOnline] = useState<boolean>(() => isAppOnline());
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() => getPendingQueueCount());
  const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);

  useEffect(() => {
    const handleNetworkChange = () => {
      setIsOnline(isAppOnline());
      setPendingOfflineCount(getPendingQueueCount());
    };

    const handleBackOnline = async () => {
      handleNetworkChange();
      const count = getPendingQueueCount();
      if (count > 0 && isAppOnline()) {
        try {
          const res = await syncAllPendingQueue(webAppUrl);
          setPendingOfflineCount(getPendingQueueCount());
          handleRefreshPatients();
          if (res.succeeded > 0) {
            setResetSuccessMessage(
              `Sinkronisasi Otomatis: ${res.succeeded} data laporan & pemantauan offline berhasil dikirim ke Google Sheets!`
            );
            setTimeout(() => setResetSuccessMessage(""), 5000);
          }
        } catch (e) {
          console.warn("Gagal auto sync saat kembali online:", e);
        }
      }
    };

    window.addEventListener("online", handleBackOnline);
    window.addEventListener("offline", handleNetworkChange);
    window.addEventListener("ghpr-offline-queue-updated", handleNetworkChange);

    return () => {
      window.removeEventListener("online", handleBackOnline);
      window.removeEventListener("offline", handleNetworkChange);
      window.removeEventListener("ghpr-offline-queue-updated", handleNetworkChange);
    };
  }, [webAppUrl]);

  useEffect(() => {
    // Jalankan sinkronisasi cloud otomatis saat aplikasi pertama kali dimuat
    pullAllCloudData(webAppUrl)
      .then((res) => {
        handleRefreshPatients();
        const refreshedUser = getActiveUserProfile();
        setCurrentUser(refreshedUser);
      })
      .catch((err) => {
        console.warn("Startup cloud sync notice:", err);
      });
  }, []);

  const handleRefreshPatients = useCallback(() => {
    setPatientsList(getAllPatients());
  }, []);

  // Sistem Notifikasi Pemantauan Pasien & Jatuh Tempo VAR
  const monitoringNotifications = useMemo(() => {
    if (!currentUser) return [];
    return computeAppNotifications(patientsList, currentUser);
  }, [patientsList, currentUser]);

  const dueNotificationCount = useMemo(() => {
    return monitoringNotifications.filter(
      (n) => n.type === "due_var" || n.type === "due_observation" || n.type === "urgent_case"
    ).length;
  }, [monitoringNotifications]);

  const newPatientNotificationCount = useMemo(() => {
    return monitoringNotifications.filter((n) => n.type === "new_patient").length;
  }, [monitoringNotifications]);

  const handleSelectNotificationAction = (
    patientId: string,
    actionType?: "update_var" | "open_detail" | "update_log"
  ) => {
    setTargetNotificationPatientId(patientId);
    setTargetNotificationAction(actionType || "open_detail");
    handleSwitchTab("monitoring");
  };

  const handleLoginSuccess = (user: UserAccessProfile) => {
    setCurrentUser(user);
    saveActiveUserProfile(user);
    setSessionExpiredNotice("");
    if (!user.isKoordinator && user.kelurahan !== "Semua") {
      setFormData((prev) => ({
        ...prev,
        kelurahan: user.kelurahan,
        kelurahanCustom: ""
      }));
    }
    // Halaman pertama setelah berhasil login adalah Daftar Pasien Dipantau (Monitoring)
    setActiveTab("monitoring");
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, "monitoring");
    } catch (e) {}
    setResetSuccessMessage(`Berhasil masuk sebagai ${user.nama} (${user.role}).`);
    setTimeout(() => setResetSuccessMessage(""), 4000);
  };

  const handleLogout = () => {
    logoutPetugas();
    setCurrentUser(null);
    setShowLoginModal(false);
    setSessionExpiredNotice("");
  };

  const handleSwitchTab = (tab: ActiveAppTab) => {
    if (tab === "settings" && !isAdminMode) {
      setActiveTab("monitoring");
      return;
    }
    const isUsernameAdmin = currentUser && currentUser.username.toLowerCase() === "admin";
    if (tab === "form" && !isUsernameAdmin && !editingCaseId) {
      setActiveTab("monitoring");
      return;
    }
    setActiveTab(tab);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, tab);
    } catch (e) {}
  };

  const handleStartNewPatientInput = () => {
    const isUsernameAdmin = currentUser && currentUser.username.toLowerCase() === "admin";
    if (!isUsernameAdmin) {
      setResetSuccessMessage("Input data kasus baru hanya dapat dilakukan oleh akun Admin.");
      setTimeout(() => setResetSuccessMessage(""), 4000);
      return;
    }
    setAdminSettingsSubTab("flexible_form");
    handleSwitchTab("settings");
  };

  const handleOpenPatientFullFormEdit = (patient: PatientMonitoringItem) => {
    const raw: Record<string, any> = patient.fullData || {};
    const updatedForm: FormGHPRData = {
      ...initialFormState,
      waktuKejadian: patient.waktuKejadian || raw.waktuKejadian || "",
      alamatKejadian: patient.alamatKorban || raw.alamatKejadian || "",
      kelurahan: patient.kelurahan || raw.kelurahan || "",
      kelurahanCustom: patient.kelurahan || "",
      kecamatan: patient.kecamatan || "Sananwetan",
      kecamatanCustom: "",
      kabupatenKota: patient.kabupatenKota || "Kota Blitar",
      kabupatenKotaCustom: "",
      provinsi: "Jawa Timur",
      sumberInfo: raw.sumberInfo || "Laporan Petugas Puskesmas",
      kronologi: raw.kronologi || `Kasus gigitan HPR di wilayah Kel. ${patient.kelurahan}`,
      spesiesHPR: patient.spesiesHPR || "Anjing",
      spesiesLain: "",
      ras: patient.rasHewan || "",
      jkHewan: raw.jkHewan || "Jantan",
      umurHewan: raw.umurHewan || "2",
      satuanUmur: "Tahun",
      metodePelihara: raw.metodePelihara || "Diliarkan / Bebas",
      asalHewan: raw.asalHewan || "Lokal",
      pakan: raw.pakan || "Sisa Makanan Rumah Tangga",
      biosekuriti: raw.biosekuriti || "Tidak Ada",
      sumberAir: raw.sumberAir || "Sumur",
      kondisiHewan: patient.kondisiHewan || "Dalam Observasi",
      pemilikHewan: patient.pemilikHewan || "",
      alamatPemilik: patient.alamatPemilik || "",
      kontakPemilik: patient.kontakPemilik || "",
      riwayatVaksin: raw.riwayatVaksin || "Tidak Tahu",
      tanggalVaksin: raw.tanggalVaksin || "",
      namaKorban: patient.namaKorban || "",
      umurKorban: patient.umurKorban || "",
      alamatKorban: patient.alamatKorban || "",
      jkKorban: patient.jkKorban || "Laki-laki",
      kondisiKorban: raw.kondisiKorban || "Luka gigitan dalam perawatan",
      pertolonganPertama: patient.pertolonganPertama || "Cuci luka sabun air mengalir 15 menit",
      detailPertolongan: patient.detailPertolongan || "",
      kondisiLuka: patient.kondisiLuka || "Luka gigitan",
      lokasiLuka: patient.lokasiLuka || "",
      tindakanHPR: patient.tindakanHPR || "Observasi 14 Hari",
      tindakanKasus: patient.tindakanKasus || "Pemberian VAR",
      tindakanMasyarakat: raw.tindakanMasyarakat || "",
      rekomendasi: patient.rekomendasi || "Observasi harian kondisi hewan dan korban",
      sumberLaporan: raw.sumberLaporan || "Laporan Faskes",
      fotoDokumentasi: raw.fotoDokumentasi || "",
      timKetua: raw.timKetua || currentUser.nama,
      timAnggota: raw.timAnggota || "Kader Kesehatan Kelurahan",
      tanggalPelaksanaan: raw.tanggalPelaksanaan || new Date().toISOString().slice(0, 10),
      pelaksanaNama: DEFAULT_PELAKSANA_NAMA,
      pelaksanaNIP: DEFAULT_PELAKSANA_NIP,
      tandaTanganUrl: OFFICIAL_SIGNATURE_STAMP_URL,
      tandaTanganOtomatis: false,
      jenisTandaTangan: "gambar"
    };

    setFormData(updatedForm);
    setEditingCaseId(patient.id_kasus);
    try {
      localStorage.setItem(STORAGE_KEY_EDITING_ID, patient.id_kasus);
    } catch (e) {}
    setStep(1);
    setSubmittedData(null);
    setSubmitError("");
    setResetSuccessMessage(
      `Kasus ${patient.id_kasus} (${patient.namaKorban}) siap diedit di formulir. Silakan sesuaikan data dan simpan.`
    );
    handleSwitchTab("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Auto-Save Effect
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FORM, JSON.stringify(formData));
      localStorage.setItem(STORAGE_KEY_STEP, String(step));
      if (editingCaseId) {
        localStorage.setItem(STORAGE_KEY_EDITING_ID, editingCaseId);
      } else {
        localStorage.removeItem(STORAGE_KEY_EDITING_ID);
      }
      const timeStr = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      localStorage.setItem(STORAGE_KEY_SAVED_AT, timeStr);
      setLastSavedTime(timeStr);
    } catch (err) {
      console.warn("Gagal menyimpan draft ke localStorage:", err);
    }
  }, [formData, step, editingCaseId]);

  const handleResetForm = () => {
    setShowResetModal(true);
  };

  const handleCancelEdit = () => {
    setEditingCaseId(null);
    try {
      localStorage.removeItem(STORAGE_KEY_EDITING_ID);
    } catch (e) {}
    setResetSuccessMessage("Mode edit dibatalkan.");
    setTimeout(() => setResetSuccessMessage(""), 4000);
    const isAdm = currentUser && (currentUser.username.toLowerCase() === "admin" || currentUser.role === "admin");
    if (!isAdm) {
      handleSwitchTab("monitoring");
    }
  };

  const handleSelectCaseForEdit = (caseItem: StoredCaseItem) => {
    const raw = caseItem.fullData || {};
    const updatedForm: FormGHPRData = {
      ...initialFormState,
      waktuKejadian: raw["Waktu Kejadian"] || caseItem.waktuKejadian || "",
      alamatKejadian: raw["Alamat Kejadian"] || caseItem.alamatKejadian || "",
      kelurahan: raw["Kelurahan"] || caseItem.kelurahan || "",
      kelurahanCustom: raw["Kelurahan"] || "",
      kecamatan: raw["Kecamatan"] || caseItem.kecamatan || "",
      kecamatanCustom: raw["Kecamatan"] || "",
      kabupatenKota: raw["Kabupaten/Kota"] || "Kota Blitar",
      kabupatenKotaCustom: "",
      provinsi: raw["Provinsi"] || "Jawa Timur",
      sumberInfo: raw["Sumber Info"] || raw["Sumber Informasi"] || "",
      kronologi: raw["Kronologi Kejadian"] || raw["Kronologi"] || "",
      spesiesHPR: raw["Spesies HPR"] || caseItem.spesiesHPR || "",
      spesiesLain: raw["Spesies Lainnya"] || "",
      ras: raw["Ras Hewan"] || raw["Ras"] || "",
      jkHewan: raw["Jenis Kelamin Hewan"] || raw["JK Hewan"] || "",
      umurHewan: raw["Umur Hewan"] || "",
      satuanUmur: "Tahun",
      metodePelihara: raw["Metode Pemeliharaan"] || raw["Cara Pelihara"] || "",
      asalHewan: raw["Asal Hewan"] || "",
      pakan: raw["Pakan"] || "",
      biosekuriti: raw["Biosekuriti"] || "",
      sumberAir: raw["Sumber Air"] || "",
      kondisiHewan: raw["Kondisi Hewan"] || "",
      pemilikHewan: raw["Nama Pemilik Hewan"] || raw["Pemilik Hewan"] || "",
      alamatPemilik: raw["Alamat Pemilik"] || "",
      kontakPemilik: raw["Kontak Pemilik"] || "",
      riwayatVaksin: raw["Riwayat Vaksinasi"] || raw["Riwayat Vaksin"] || "",
      tanggalVaksin: raw["Tanggal Vaksinasi"] || raw["Tanggal Vaksin"] || "",
      namaKorban: raw["Nama Korban"] || caseItem.namaKorban || "",
      umurKorban: raw["Umur Korban"] || caseItem.umurKorban || "",
      alamatKorban: raw["Alamat Korban"] || "",
      jkKorban: raw["Jenis Kelamin Korban"] || raw["JK Korban"] || "",
      kondisiKorban: raw["Kondisi Korban"] || "",
      pertolonganPertama: raw["Pertolongan Pertama"] || "",
      detailPertolongan: raw["Detail Pertolongan"] || "",
      kondisiLuka: raw["Kondisi Luka"] || caseItem.kondisiLuka || "",
      lokasiLuka: raw["Lokasi Luka"] || "",
      tindakanHPR: raw["Tindakan terhadap HPR"] || raw["Tindakan HPR"] || "",
      tindakanKasus: raw["Tindakan terhadap Korban"] || raw["Tindakan Kasus"] || "",
      tindakanMasyarakat: raw["Tindakan Masyarakat"] || "",
      rekomendasi: raw["Rekomendasi"] || "",
      sumberLaporan: raw["Sumber Laporan"] || "",
      fotoDokumentasi: raw["Foto Dokumentasi"] || "",
      timKetua: raw["Ketua Tim"] || "",
      timAnggota: raw["Anggota Tim"] || "",
      tanggalPelaksanaan: raw["Tanggal Pelaksanaan"] || new Date().toISOString().slice(0, 10),
      pelaksanaNama: DEFAULT_PELAKSANA_NAMA,
      pelaksanaNIP: DEFAULT_PELAKSANA_NIP,
      tandaTanganUrl: OFFICIAL_SIGNATURE_STAMP_URL,
      tandaTanganOtomatis: false,
      jenisTandaTangan: "gambar"
    };

    setFormData(updatedForm);
    setEditingCaseId(caseItem.id_kasus);
    try {
      localStorage.setItem(STORAGE_KEY_EDITING_ID, caseItem.id_kasus);
    } catch (e) {}
    setStep(1);
    setSubmittedData(null);
    setSubmitError("");
    setResetSuccessMessage(
      `Laporan ${caseItem.id_kasus} (${caseItem.namaKorban}) berhasil dimuat ke formulir untuk diperbaiki. Silakan tinjau/ubah data di Langkah 1-4 lalu simpan perbaruan.`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmResetForm = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_FORM);
      localStorage.removeItem(STORAGE_KEY_STEP);
      localStorage.removeItem(STORAGE_KEY_SAVED_AT);
      localStorage.removeItem(STORAGE_KEY_EDITING_ID);
    } catch (err) {
      console.warn("Gagal menghapus localStorage:", err);
    }

    const resetState: FormGHPRData = {
      ...initialFormState,
      tanggalPelaksanaan: new Date().toISOString().slice(0, 10),
    };

    setFormData(resetState);
    setEditingCaseId(null);
    setStep(1);
    setLastSavedTime(null);
    setErrors({});
    setSubmittedData(null);
    setSubmitError("");
    setShowResetModal(false);

    setResetSuccessMessage("Formulir dan draf lokal berhasil dikosongkan.");
    setTimeout(() => {
      setResetSuccessMessage("");
    }, 4000);
  };

  const handleNewReport = () => {
    confirmResetForm();
  };

  const updateField = (field: keyof FormGHPRData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
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

  const getFinalKelurahan = (data = formData) => {
    if (isOther(data.kelurahan)) return (data.kelurahanCustom || "").trim();
    return (data.kelurahan || "").trim();
  };

  const getFinalKecamatan = (data = formData) => {
    if (isOther(data.kecamatan)) return (data.kecamatanCustom || "").trim();
    return (data.kecamatan || "").trim();
  };

  const getFinalKabKota = (data = formData) => {
    if (isOther(data.kabupatenKota)) return (data.kabupatenKotaCustom || "").trim();
    return (data.kabupatenKota || "").trim();
  };

  const validateStep = (currentStep: number): boolean => {
    // Jika mode fleksibel aktif (untuk admin input pasien baru), seluruh pertanyaan boleh dikosongi tanpa tanda bintang!
    if (isFlexibleMode && !editingCaseId) {
      setErrors({});
      return true;
    }

    const errs: FormErrors = {};

    if (currentStep === 1) {
      if (!formData.waktuKejadian?.trim()) errs.waktuKejadian = "Wajib diisi";
      if (!formData.sumberInfo?.trim()) errs.sumberInfo = "Wajib diisi";
      if (!formData.alamatKejadian?.trim()) errs.alamatKejadian = "Wajib diisi";
      
      const kel = getFinalKelurahan();
      if (!formData.kelurahan?.trim()) {
        errs.kelurahan = "Wajib diisi";
      } else if (isOther(formData.kelurahan) && !kel) {
        errs.kelurahanCustom = "Wajib ketik kelurahan manual";
      }

      const kec = getFinalKecamatan();
      if (!formData.kecamatan?.trim()) {
        errs.kecamatan = "Wajib diisi";
      } else if (isOther(formData.kecamatan) && !kec) {
        errs.kecamatanCustom = "Wajib ketik kecamatan manual";
      }

      const kab = getFinalKabKota();
      if (!formData.kabupatenKota?.trim()) {
        errs.kabupatenKota = "Wajib diisi";
      } else if (isOther(formData.kabupatenKota) && !kab) {
        errs.kabupatenKotaCustom = "Wajib ketik kab/kota manual";
      }

      if (!formData.provinsi?.trim()) errs.provinsi = "Wajib diisi";
      if (!formData.kronologi?.trim()) errs.kronologi = "Wajib diisi kronologi";
    }

    if (currentStep === 2) {
      if (!formData.spesiesHPR?.trim()) errs.spesiesHPR = "Wajib pilih spesies";
      if (formData.spesiesHPR === "Lainnya" && !formData.spesiesLain?.trim()) errs.spesiesLain = "Wajib sebutkan spesies";
      if (!formData.jkHewan?.trim()) errs.jkHewan = "Wajib pilih jenis kelamin";
      if (!formData.metodePelihara?.trim()) errs.metodePelihara = "Wajib pilih metode pemeliharaan";
      if (!formData.kondisiHewan?.trim()) errs.kondisiHewan = "Wajib pilih kondisi hewan";
      if (!formData.riwayatVaksin?.trim()) errs.riwayatVaksin = "Wajib pilih riwayat vaksin";
      if (formData.riwayatVaksin === "Ya" && !formData.tanggalVaksin?.trim()) errs.tanggalVaksin = "Wajib isi tanggal vaksin";
    }

    if (currentStep === 3) {
      if (!formData.namaKorban?.trim()) errs.namaKorban = "Wajib isi nama korban";
      if (!formData.umurKorban?.toString().trim()) errs.umurKorban = "Wajib isi umur korban";
      if (!formData.alamatKorban?.trim()) errs.alamatKorban = "Wajib isi alamat korban";
      if (!formData.jkKorban?.trim()) errs.jkKorban = "Wajib pilih jenis kelamin korban";
      if (!formData.kondisiLuka?.trim()) errs.kondisiLuka = "Wajib pilih kondisi luka";
      if (!formData.tindakanHPR?.trim()) errs.tindakanHPR = "Wajib isi tindakan terhadap HPR";
      if (!formData.tindakanKasus?.trim()) errs.tindakanKasus = "Wajib isi tindakan terhadap kasus";
    }

    if (currentStep === 4) {
      if (!formData.rekomendasi?.trim()) errs.rekomendasi = "Wajib isi rekomendasi tindak lanjut";
      if (!formData.timKetua?.trim()) errs.timKetua = "Wajib isi ketua tim";
      if (!formData.tanggalPelaksanaan?.trim()) errs.tanggalPelaksanaan = "Wajib isi tanggal pelaksanaan";
      if (!formData.pelaksanaNama?.trim()) errs.pelaksanaNama = "Wajib isi nama pelaksana";
      if (!formData.pelaksanaNIP?.trim()) errs.pelaksanaNIP = "Wajib isi NIP pelaksana";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    setSubmitError("");
    if (!validateStep(step)) {
      setSubmitError(`Mohon lengkapi isian bertanda bintang (*) pada Langkah ${step} sebelum melanjutkan.`);
      return;
    }
    setStep((prev) => Math.min(4, prev + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevStep = () => {
    setSubmitError("");
    setStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const previewJsonPayload = useMemo(() => {
    const generatedId = `GHPR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const finalKel = getFinalKelurahan();
    const finalKec = getFinalKecamatan();
    const finalKab = getFinalKabKota();
    const defaultKel = currentUser && currentUser.kelurahan !== "Semua" ? currentUser.kelurahan : "Sananwetan";
    const kel = finalKel || formData.kelurahan || defaultKel;
    const kec = finalKec || formData.kecamatan || "Sananwetan";
    const kab = finalKab || formData.kabupatenKota || "Kota Blitar";

    return {
      id_kasus: editingCaseId || submittedData?.id || generatedId,
      timestamp_submit: new Date().toISOString(),
      ...formData,
      action: editingCaseId ? "update" : "create",
      is_update: !!editingCaseId,
      kelurahan: kel,
      kecamatan: kec,
      kabupatenKota: kab,
      provinsi: formData.provinsi || "Jawa Timur",
      spesies_final: formData.spesiesHPR === "Lainnya" ? (formData.spesiesLain || "Lainnya") : (formData.spesiesHPR || "Anjing"),
      kelurahan_final: kel,
      kecamatan_final: kec,
      kabupatenKota_final: kab,
      namaKorban: formData.namaKorban || "Pasien GHPR",
      noHpKorban: formData.noHpKorban || formData.kontakPemilik || "-",
      kondisiLuka: formData.kondisiLuka || "Kategori 1",
    };
  }, [formData, submittedData, editingCaseId, currentUser, getFinalKelurahan, getFinalKecamatan, getFinalKabKota]);

  const handleSubmit = async () => {
    setSubmitError("");
    
    let isValid = true;
    for (let s = 1; s <= 4; s++) {
      if (!validateStep(s)) {
        isValid = false;
        setStep(s);
        setSubmitError(
          `Mohon lengkapi isian bertanda bintang (*) pada Langkah ${s} (${stepsList[s - 1].title}) sebelum menyimpan.`
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        break;
      }
    }
    if (!isValid) return;

    const targetUrl = webAppUrl ? webAppUrl.trim() : "";
    if (!targetUrl) {
      setSubmitError("Isi Google Sheets Web App URL di Pengaturan Google Sheets terlebih dahulu.");
      setShowConfig(true);
      return;
    }

    setIsSubmitting(true);
    const payload = previewJsonPayload;
    const isUpdateMode = !!editingCaseId;

    const saveLocalHistory = () => {
      try {
        const savedHistory = localStorage.getItem("ghpr_recorded_submissions") || "[]";
        let parsed = JSON.parse(savedHistory);
        if (isUpdateMode) {
          parsed = parsed.filter((it: any) => it.id_kasus !== payload.id_kasus);
        }
        parsed.unshift({ ...payload, timestamp_recorded: new Date().toISOString() });
        localStorage.setItem("ghpr_recorded_submissions", JSON.stringify(parsed));

        // Update totalRecorded if sheet config exists
        const sheetConfigStr = localStorage.getItem("ghpr_google_sheet_config_v1");
        if (sheetConfigStr && !isUpdateMode) {
          const cfg = JSON.parse(sheetConfigStr);
          cfg.totalRecorded = (cfg.totalRecorded || 0) + 1;
          localStorage.setItem("ghpr_google_sheet_config_v1", JSON.stringify(cfg));
        }
      } catch (e) {
        console.warn("Gagal simpan histori lokal:", e);
      }
    };

    const onlineNow = isAppOnline();

    // JIKA PERANGKAT OFFLINE: Simpan langsung ke antrean sinkronisasi & database lokal
    if (!onlineNow) {
      try {
        addToOfflineQueue({
          type: isUpdateMode ? "edit_case" : "new_case",
          caseId: payload.id_kasus,
          patientName: formData.namaKorban,
          kelurahan: formData.kelurahan,
          payload: payload
        });

        setSubmittedData({
          id: payload.id_kasus,
          time: new Date().toLocaleString("id-ID")
        });
        saveLocalHistory();

        syncPatientFromFormSubmission(formData, payload.id_kasus, isUpdateMode);
        handleRefreshPatients();

        setResetSuccessMessage(
          `Mode Offline: Laporan ${payload.id_kasus} (${formData.namaKorban}) berhasil disimpan ke memori perangkat dan masuk antrean sinkronisasi. Data akan otomatis dikirim ke Google Sheets saat Anda terhubung online kembali.`
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (errOffline) {
        console.error("Gagal simpan offline:", errOffline);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      // Untuk endpoint Google Apps Script, gunakan modul transmisi multi-kanal
      if (targetUrl.includes("script.google.com")) {
        await sendToAppsScript(targetUrl, payload, isUpdateMode ? "update" : "create");

        setSubmittedData({
          id: payload.id_kasus,
          time: new Date().toLocaleString("id-ID")
        });
        saveLocalHistory();

        // Otomatis sinkronkan data kasus ke sistem pemantauan pasien
        try {
          syncPatientFromFormSubmission(formData, payload.id_kasus, isUpdateMode);
          handleRefreshPatients();
        } catch (e) {
          console.warn("Gagal sinkron pasien ke monitoring:", e);
        }

        if (isUpdateMode) {
          setEditingCaseId(null);
          try {
            localStorage.removeItem(STORAGE_KEY_EDITING_ID);
          } catch (e) {}
          setResetSuccessMessage(
            `Pembaruan Laporan ${payload.id_kasus} (${formData.namaKorban}) berhasil disimpan dan disinkronkan ke Google Spreadsheet!`
          );
        }

        // Langsung alihkan ke profil header daftar pasien dipantau
        setTimeout(() => {
          handleSwitchTab("monitoring");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 500);
      } else {
        // Untuk custom backend / API endpoint biasa
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        let resJson: { status?: string; id?: string; id_kasus?: string } = {};
        try {
          const text = await response.text();
          resJson = JSON.parse(text);
        } catch {
          resJson = { status: "ok", id: payload.id_kasus };
        }

        const finalId = resJson.id || resJson.id_kasus || payload.id_kasus;
        setSubmittedData({
          id: finalId,
          time: new Date().toLocaleString("id-ID")
        });
        saveLocalHistory();

        // Otomatis sinkronkan data kasus ke sistem pemantauan pasien
        try {
          syncPatientFromFormSubmission(formData, finalId, isUpdateMode);
          handleRefreshPatients();
        } catch (e) {
          console.warn("Gagal sinkron pasien ke monitoring:", e);
        }

        if (isUpdateMode) {
          setEditingCaseId(null);
          try {
            localStorage.removeItem(STORAGE_KEY_EDITING_ID);
          } catch (e) {}
          setResetSuccessMessage(
            `Pembaruan Laporan ${finalId} (${formData.namaKorban}) berhasil diperbarui!`
          );
        }

        // Langsung alihkan ke profil header daftar pasien dipantau
        setTimeout(() => {
          handleSwitchTab("monitoring");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 500);
      }
    } catch (err: any) {
      console.warn("Koneksi gagal saat kirim data, mengamankan ke antrean offline:", err);
      // Fallback otomatis ke antrean offline jika koneksi mendadak terputus saat submit
      addToOfflineQueue({
        type: isUpdateMode ? "edit_case" : "new_case",
        caseId: payload.id_kasus,
        patientName: formData.namaKorban,
        kelurahan: formData.kelurahan,
        payload: payload
      });
      setSubmittedData({
        id: payload.id_kasus,
        time: new Date().toLocaleString("id-ID")
      });
      saveLocalHistory();
      syncPatientFromFormSubmission(formData, payload.id_kasus, isUpdateMode);
      handleRefreshPatients();

      if (isUpdateMode) {
        setEditingCaseId(null);
        try {
          localStorage.removeItem(STORAGE_KEY_EDITING_ID);
        } catch (e) {}
      }

      setResetSuccessMessage(
        `Koneksi terputus: Data laporan (${payload.id_kasus}) telah diamankan ke Antrean Offline Lokal dan akan otomatis disinkronkan ke Google Sheets ketika jaringan kembali online.`
      );
      
      // Langsung alihkan ke profil header daftar pasien dipantau
      setTimeout(() => {
        handleSwitchTab("monitoring");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStepItem = stepsList[step - 1] || stepsList[0];

  // JIKA PENGGUNA BELUM LOGIN: Halaman Pertama yang Ditampilkan adalah Form Login (2 Kolom: Username & Password)
  if (!currentUser) {
    return (
      <UserLoginView
        onLoginSuccess={handleLoginSuccess}
        sessionExpiredNotice={sessionExpiredNotice}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 font-sans antialiased flex flex-col print:bg-white">
      {/* Header */}
      <Header
        webAppUrl={webAppUrl}
        defaultUrl={DEFAULT_WEB_APP_URL}
        showConfig={showConfig}
        setShowConfig={setShowConfig}
        setShowJsonModal={setShowJsonModal}
        setShowPdfModal={setShowPdfModal}
        setWebAppUrl={setWebAppUrl}
        lastSavedTime={lastSavedTime}
        handleResetForm={handleResetForm}
        onOpenSearchModal={() => setShowSearchModal(true)}
        editingCaseId={editingCaseId}
        onCancelEdit={handleCancelEdit}
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
        currentUser={currentUser}
        onOpenLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        onOpenSettingsTab={(targetSubTab) => {
          if (targetSubTab) {
            setAdminSettingsSubTab(targetSubTab);
          }
          handleSwitchTab("settings");
        }}
        notifications={monitoringNotifications}
        onSelectNotificationAction={handleSelectNotificationAction}
        isOnline={isOnline}
        pendingOfflineCount={pendingOfflineCount}
        onOpenOfflineSync={() => setShowOfflineModal(true)}
      />

      {/* Global Sync Error Banner if Sheet is unshared */}
      <GvizSyncErrorBanner
        onRetry={() =>
          pullAllCloudData(webAppUrl).then(() => {
            handleRefreshPatients();
            const refreshed = getActiveUserProfile();
            if (refreshed) setCurrentUser(refreshed);
          })
        }
      />

      {/* Navigation Tabs: Form Input vs Daftar Pasien Dipantau vs Setting Login & Akun */}
      <NavigationTabs
        activeTab={activeTab}
        setActiveTab={handleSwitchTab}
        activePatientCount={
          patientsList.filter((p) =>
            currentUser.isKoordinator
              ? p.statusPemantauan === "Dalam Pemantauan (Aktif)"
              : p.kelurahan.toLowerCase() === currentUser.kelurahan.toLowerCase() &&
                p.statusPemantauan === "Dalam Pemantauan (Aktif)"
          ).length
        }
        userProfile={currentUser}
        editingCaseId={editingCaseId}
        onNewInputClick={handleStartNewPatientInput}
        isAdminMode={isAdminMode}
        dueCount={dueNotificationCount}
        newPatientCount={newPatientNotificationCount}
        onLogout={handleLogout}
      />

      {/* Success Notification Banner */}
      {submittedData && (
        <div className="mx-auto max-w-[1200px] w-full px-6 pt-6 print:hidden">
          <div className={`rounded-xl text-white p-5 flex items-start gap-4 shadow-md border ${
            editingCaseId
              ? "bg-amber-600 border-amber-500"
              : "bg-emerald-600 border-emerald-500"
          }`}>
            <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <CircleCheck size={22} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-base">
                {editingCaseId ? "Laporan Berhasil Diperbarui di Spreadsheet & Monitoring!" : "Laporan Berhasil Disimpan & Masuk ke Pemantauan Pasien!"}
              </h3>
              <p className="text-sm text-white/90 mt-0.5">
                 ID Kasus:{" "}
                <b className="font-mono tracking-wider bg-white text-slate-900 px-2 py-0.5 rounded ml-1">
                  {submittedData.id}
                </b>
              </p>
              <p className="text-xs text-white/90 mt-1">
                {editingCaseId
                  ? `Baris laporan telah berhasil diperbarui di Google Sheets & data pemantauan pada ${submittedData.time}.`
                  : `Tersimpan ke Google Sheets pada ${submittedData.time}. Pasien otomatis masuk ke daftar pemantauan wilayah Kel. ${formData.kelurahan || "Sananwetan"}.`}
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleSwitchTab("monitoring")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white text-blue-900 px-3.5 py-1.5 text-xs font-bold shadow-sm hover:bg-slate-100 transition cursor-pointer"
                >
                  <Users size={14} /> Lihat Daftar Pasien Dipantau
                </button>
                {isAdminMode && (
                  <a
                    href="https://docs.google.com/spreadsheets/d/1jRDFTZWEFTlNSVSP73LI_JGRrRlWyWsXeKrgEiAsBrg/edit"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-black/30 hover:bg-black/40 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition border border-white/30"
                  >
                    <FileSpreadsheet size={14} /> Buka Google Sheets <ExternalLink size={12} />
                  </a>
                )}
                <button
                  onClick={() => setShowPdfModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 text-xs font-bold transition border border-white/30 cursor-pointer"
                >
                  <Printer size={14} /> Cetak Form PDF
                </button>
                <button
                  onClick={handleNewReport}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 text-xs font-bold transition cursor-pointer"
                >
                  <PlusCircle size={14} /> Buat Laporan Baru
                </button>
              </div>
            </div>
            <button
              onClick={() => setSubmittedData(null)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* RENDER TAB KONTEN */}
      {activeTab === "monitoring" ? (
        <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-5 sm:py-6 flex-1 print:hidden">
          <PatientMonitoringDashboard
            patientsList={patientsList}
            currentUser={currentUser}
            onRefreshPatients={handleRefreshPatients}
            onNewInputCase={handleStartNewPatientInput}
            onEditFullFormCase={handleOpenPatientFullFormEdit}
            onOpenLoginModal={currentUser.username.toLowerCase() === "admin" || currentUser.role === "admin" ? () => setShowLoginModal(true) : undefined}
            onLogout={handleLogout}
            onOpenSettings={isAdminMode ? () => {
              setAdminSettingsSubTab("accounts");
              handleSwitchTab("settings");
            } : undefined}
            onOpenGitHubSync={isAdminMode ? () => {
              setAdminSettingsSubTab("github");
              handleSwitchTab("settings");
            } : undefined}
            onOpenOfflineSync={() => setShowOfflineModal(true)}
            webAppUrl={webAppUrl}
            initialTargetPatientId={targetNotificationPatientId}
            initialTargetAction={targetNotificationAction}
            onClearTargetPatient={() => {
              setTargetNotificationPatientId(null);
              setTargetNotificationAction(null);
            }}
          />
        </main>
      ) : (activeTab === "settings" && isAdminMode) ? (
        <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 py-5 sm:py-6 flex-1 print:hidden space-y-5 animate-in fade-in">
          {/* Header Panel Pengaturan */}
          <div className="rounded-2xl border border-indigo-200 bg-linear-to-r from-indigo-900 via-blue-900 to-slate-900 p-5 sm:p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
                <KeyRound size={26} className="text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    Pusat Pengaturan Login & Integrasi Admin
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                    Enkripsi SHA-256 Aktif
                  </span>
                </div>
                <p className="text-xs text-indigo-100/90 mt-1 max-w-2xl leading-relaxed">
                  Halaman khusus pengembang dan admin untuk mengedit username, password petugas, penugasan wilayah kelurahan, konfigurasi Google Sheets Apps Script, dan sinkronisasi repositori GitHub.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => handleSwitchTab("form")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition border border-white/20 shadow-2xs cursor-pointer"
              >
                <FileText size={14} /> Ke Formulir PE
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab("monitoring")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition shadow-md cursor-pointer"
              >
                <Users size={14} /> Ke Monitoring Pasien
              </button>
            </div>
          </div>

          {/* Pengelola Akun & Google Sheets Manager Component */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6">
            <GoogleSheetsManager
              sheetConfig={sheetConfig}
              setSheetConfig={setSheetConfig}
              webAppUrl={webAppUrl}
              setWebAppUrl={(newUrl) => {
                setWebAppUrl(newUrl);
                try {
                  localStorage.setItem("ghpr_google_sheets_url_v1", newUrl);
                } catch (e) {}
              }}
              initialTab={adminSettingsSubTab}
              onAccountsUpdated={() => {
                const refreshed = getActiveUserProfile();
                setCurrentUser(refreshed);
              }}
              onSwitchToMonitoring={() => handleSwitchTab("monitoring")}
            />
          </div>
        </main>
      ) : (
        <>
          {/* Step Tracker */}
          <div className="print:hidden">
            <StepTracker
              step={step}
              setStep={setStep}
              feedbackCount={feedbackCount}
              setFeedbackCount={setFeedbackCount}
            />
          </div>

          {/* Main Grid Formulir */}
          <main className={`mx-auto w-full px-4 sm:px-6 py-4 sm:py-5 items-start flex-1 print:hidden ${
            isAdminMode
              ? "max-w-[1200px] grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8"
              : "max-w-3xl flex justify-center"
          }`}>
            {/* Main Form Card */}
            <div className={`${
              isAdminMode ? "lg:col-span-8" : "w-full"
            } flex flex-col space-y-4`}>
              {/* Banner Mode Form Input Pasien Baru (Revisi Bebas Bintang) untuk Akses Admin / Publik */}
              {!editingCaseId && (
                <div className="rounded-2xl border border-emerald-300/80 bg-linear-to-r from-emerald-900 via-teal-900 to-slate-900 p-4 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Sparkles size={20} className="text-emerald-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">
                          Salinan Formulir PE GHPR (Input Pasien Baru)
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                          {currentUser ? "Akses " + (currentUser.nama || currentUser.username) : "Akses Form Publik"}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isFlexibleMode
                            ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/40"
                            : "bg-slate-700 text-slate-300"
                        }`}>
                          {isFlexibleMode ? "Boleh Dikosongi di Seluruh Pertanyaan" : "Mode Standar (Wajib Lengkap)"}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-100/90 mt-1 leading-relaxed">
                        {isFlexibleMode
                          ? "Tanda bintang (*) telah dinonaktifkan di seluruh isian. Anda dapat langsung melompat antar-langkah atau menyimpan pasien baru tanpa hambatan validasi."
                          : "Formulir saat ini menerapkan tanda bintang merah (*) sebagai isian wajib."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => toggleFlexibleMode()}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isFlexibleMode
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-white/20 hover:bg-white/30 text-white"
                      }`}
                    >
                      <ShieldCheck size={14} />
                      {isFlexibleMode ? "Bebas Bintang: Aktif" : "Aktifkan Bebas Bintang"}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      {React.createElement(currentStepItem.icon, { size: 18, className: "text-blue-600 shrink-0" })}
                      Langkah {step}: {currentStepItem.title}
                    </h2>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-500 tracking-wide mt-0.5">
                      {editingCaseId
                        ? "Mode Edit Kasus — Lengkapi seluruh isian bertanda bintang (*) sebelum menyimpan pembaruan."
                        : isFlexibleMode
                        ? "Salinan Formulir Fleksibel — Seluruh pertanyaan boleh dikosongi untuk perekaman cepat pasien baru."
                        : "Formulir Surveilans PE GHPR — Lengkapi isian bertanda bintang (*)."}
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1">
                    {step}/4
                  </span>
                </div>

                <div className="p-5 sm:p-6 md:p-7 flex-1">
                  <FormSteps
                    step={step}
                    formData={formData}
                    errors={errors}
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
                    isAdminMode={isAdminMode}
                    isEditing={Boolean(editingCaseId)}
                    editingCaseId={editingCaseId}
                    showAsterisk={editingCaseId ? true : !isFlexibleMode}
                  />

                {/* Form Footer Action Buttons */}
                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={prevStep}
                      disabled={step === 1}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider disabled:opacity-40 hover:bg-slate-50 transition"
                    >
                      <ChevronLeft size={16} /> Kembali
                    </button>

                    <button
                      onClick={handleResetForm}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3.5 py-2.5 text-xs font-bold text-rose-700 transition"
                      title="Kosongkan seluruh isian formulir"
                    >
                      <RotateCcw size={15} /> Reset Form
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPdfModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider transition cursor-pointer"
                    >
                      <Printer size={16} /> Cetak PDF
                    </button>

                    {step < 4 ? (
                      <button
                        id="btn-next-step"
                        type="button"
                        onClick={nextStep}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-bold text-white uppercase tracking-wider shadow-sm hover:bg-blue-700 active:scale-[0.98] transition cursor-pointer"
                      >
                        Lanjut <ChevronRight size={16} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {editingCaseId && (
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 px-4 py-3 text-xs font-bold text-amber-900 uppercase tracking-wider transition cursor-pointer"
                          >
                            Batal Edit
                          </button>
                        )}
                        <button
                          id="btn-submit-form"
                          type="button"
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className={`inline-flex items-center gap-2 rounded-lg active:scale-[0.98] px-7 py-3 text-xs font-bold text-white uppercase tracking-wider shadow-md transition disabled:opacity-60 cursor-pointer ${
                            editingCaseId
                              ? "bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400/30"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                        >
                          {isSubmitting ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              {editingCaseId ? "Menyimpan Perbaikan..." : "Menyimpan ke Sheets..."}
                            </>
                          ) : editingCaseId ? (
                            <>
                              <RefreshCw size={16} /> Perbarui Data di Google Sheets
                            </>
                          ) : (
                            <>
                              <Send size={16} /> Simpan ke Google Sheets
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Indikator Perekaman Langkah 4 */}
                {step === 4 && (
                  <div className={`mt-4 rounded-xl border p-3.5 flex items-center justify-between gap-3 text-xs flex-wrap ${
                    editingCaseId ? "border-amber-300 bg-amber-50/80" : "border-emerald-200 bg-emerald-50/70"
                  }`}>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={16} className={editingCaseId ? "text-amber-700 shrink-0" : "text-emerald-700 shrink-0"} />
                      <span className={editingCaseId ? "text-amber-900 font-medium" : "text-emerald-900 font-medium"}>
                        {editingCaseId ? (
                          <>Mode Perbaikan: Menyimpan akan <b>memperbarui baris data ({editingCaseId})</b> di Google Spreadsheet tanpa membuat duplikasi baris.</>
                        ) : isAdminMode ? (
                          <>Rekam ke Spreadsheet: <b>1jRDFTZWEFTlNSVSP73LI_JGRrRlWyWsXeKrgEiAsBrg</b></>
                        ) : (
                          <>Data laporan akan langsung tersimpan ke <b>Database Spreadsheet Resmi GHPR</b> & sinkron ke pemantauan.</>
                        )}
                      </span>
                    </div>
                    {isAdminMode && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSearchModal(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-white border border-blue-300 hover:bg-blue-100 px-2.5 py-1 rounded transition cursor-pointer"
                        >
                          <Search size={12} /> Cari Laporan Lain
                        </button>
                        <a
                          href="https://docs.google.com/spreadsheets/d/1jRDFTZWEFTlNSVSP73LI_JGRrRlWyWsXeKrgEiAsBrg/edit"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline"
                        >
                          Buka Spreadsheet <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {resetSuccessMessage && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 flex items-center justify-between gap-2 font-medium animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CircleCheck size={16} className="shrink-0 text-emerald-600" />
                      <span>{resetSuccessMessage}</span>
                    </div>
                    <button
                      onClick={() => setResetSuccessMessage("")}
                      className="text-emerald-600 hover:text-emerald-800"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {submitError && (
                  <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-center gap-2 font-medium">
                    <TriangleAlert size={16} className="shrink-0 text-rose-600" />
                    <span>{submitError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Sidebar Card (4 cols) - Khusus Admin Mode */}
            {isAdminMode && (
              <div className="lg:col-span-4 w-full">
                <SidebarSummary
                  formData={formData}
                  previewJsonPayload={previewJsonPayload}
                  step={step}
                  getFinalKelurahan={getFinalKelurahan}
                  getFinalKecamatan={getFinalKecamatan}
                  getFinalKabKota={getFinalKabKota}
                  setShowJsonModal={setShowJsonModal}
                  setShowPdfModal={setShowPdfModal}
                  setShowConfig={setShowConfig}
                  lastSavedTime={lastSavedTime}
                  handleResetForm={handleResetForm}
                  isAdminMode={isAdminMode}
                />
              </div>
            )}
          </main>
        </>
      )}

      {/* Admin Case Search & Edit Modal */}
      <AdminCaseSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        webAppUrl={webAppUrl}
        onSelectCaseForEdit={handleSelectCaseForEdit}
        activeEditingId={editingCaseId}
      />

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={confirmResetForm}
      />

      {/* Json Preview Modal */}
      <JsonModal
        showJsonModal={showJsonModal}
        setShowJsonModal={setShowJsonModal}
        previewJsonPayload={previewJsonPayload}
      />

      {/* Printable PDF Modal */}
      <PrintPDFModal
        showPdfModal={showPdfModal}
        setShowPdfModal={setShowPdfModal}
        formData={formData}
        setFormData={setFormData}
        getFinalKelurahan={getFinalKelurahan}
        getFinalKecamatan={getFinalKecamatan}
        getFinalKabKota={getFinalKabKota}
      />

      {/* Login Petugas Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        currentActiveUser={currentUser}
      />

      {/* Offline Sync Manager Modal */}
      <OfflineSyncModal
        isOpen={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
        webAppUrl={webAppUrl}
        onSyncComplete={handleRefreshPatients}
      />

      {/* Professional Footer with View Mode Switcher and GitHub Integration */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 print:hidden">
        <div className="mx-auto max-w-[1200px] flex flex-col md:flex-row items-center justify-between gap-3.5 text-xs text-slate-500">
          <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
            <div id="app-footer-copyright" className="font-semibold text-slate-700">
              @2026_WidodoSuprianto A.Md.Kep FORM PE GHPR UPT PUSKESMAS SANANWETAN
            </div>
            {isAdminMode && (currentUser?.username?.toLowerCase() === "admin" || currentUser?.role === "admin") && (
              <>
                <span className="hidden md:inline text-slate-300">|</span>
                <a
                  id="footer-github-link"
                  href="https://github.com/ahmaddodo/form-ghpr-sananwetan"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition border border-slate-200 shadow-2xs"
                  title="Lihat Repositori Kode Sumber di GitHub"
                >
                  <Github size={13} className="text-slate-900" />
                  <span>ahmaddodo/form-ghpr-sananwetan</span>
                  <ExternalLink size={11} className="text-slate-400" />
                </a>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end">
            {currentUser?.username?.toLowerCase() === "admin" ? (
              isAdminMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    Tampilan: <strong className="text-slate-700">Mode Admin / Pengembang</strong>
                  </span>
                  <button
                    id="btn-footer-switch-to-public"
                    type="button"
                    onClick={() => {
                      setIsAdminMode(false);
                      try {
                        localStorage.setItem("ghpr_app_view_mode", "public");
                      } catch (e) {}
                      setShowConfig(false);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    Ganti ke Tampilan Formulir Publik
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">
                    Tampilan: <strong className="text-slate-700">Formulir Publik (Admin)</strong>
                  </span>
                  <button
                    id="btn-footer-switch-to-admin"
                    type="button"
                    onClick={() => {
                      setIsAdminMode(true);
                      try {
                        localStorage.setItem("ghpr_app_view_mode", "admin");
                      } catch (e) {}
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                  >
                    Beralih ke Tampilan Admin
                  </button>
                </div>
              )
            ) : null}
          </div>
        </div>
      </footer>
      <PWAInstallBanner />
    </div>
  );
}

