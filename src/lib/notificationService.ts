import { PatientMonitoringItem, UserAccessProfile } from "../types";

export type NotificationType = "due_var" | "due_observation" | "new_patient" | "urgent_case";

export type NotificationUrgency = "urgent" | "today" | "upcoming" | "info";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  patientId: string;
  patientName: string;
  kelurahan: string;
  timestamp: string;
  isRead: boolean;
  dueDate?: string;
  urgency: NotificationUrgency;
  doseName?: string;
  actionType?: "update_var" | "open_detail" | "update_log";
}

const STORAGE_KEY_NOTIF_READ_IDS = "ghpr_notif_read_ids_v1";
const STORAGE_KEY_DISMISSED_BANNERS = "ghpr_notif_dismissed_banners_v1";

// Helper mengambil daftar ID notifikasi yang sudah dibaca
export function getReadNotificationIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIF_READ_IDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Gagal membaca read notification ids:", e);
  }
  return [];
}

// Simpan ID notifikasi yang sudah dibaca
export function markNotificationAsRead(notifId: string): void {
  try {
    const readIds = getReadNotificationIds();
    if (!readIds.includes(notifId)) {
      readIds.push(notifId);
      localStorage.setItem(STORAGE_KEY_NOTIF_READ_IDS, JSON.stringify(readIds));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ghpr_notifications_changed"));
      }
    }
  } catch (e) {
    console.warn("Gagal simpan read notification id:", e);
  }
}

// Tandai semua notifikasi sudah dibaca
export function markAllNotificationsAsRead(notifIds: string[]): void {
  try {
    const readIds = Array.from(new Set([...getReadNotificationIds(), ...notifIds]));
    localStorage.setItem(STORAGE_KEY_NOTIF_READ_IDS, JSON.stringify(readIds));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ghpr_notifications_changed"));
    }
  } catch (e) {
    console.warn("Gagal tandai semua notifikasi dibaca:", e);
  }
}

// Format tanggal lokal YYYY-MM-DD
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper hitung selisih hari antara dua tanggal (target - today)
function getDaysDiff(targetDateStr: string, todayStr: string): number | null {
  if (!targetDateStr) return null;
  try {
    const t = new Date(targetDateStr.slice(0, 10)).getTime();
    const now = new Date(todayStr.slice(0, 10)).getTime();
    if (isNaN(t) || isNaN(now)) return null;
    return Math.round((t - now) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

// Format label tanggal yang rapi
export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const parts = dateStr.slice(0, 10).split("-");
    if (parts.length === 3) {
      const day = parts[2];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      const months = [
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
      ];
      return `${day} ${months[monthIndex] || parts[1]} ${year}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Mesin kalkulasi notifikasi aktif berdasarkan daftar pasien dan profil hak akses pengguna.
 */
export function computeAppNotifications(
  patients: PatientMonitoringItem[],
  currentUser?: UserAccessProfile | null
): AppNotification[] {
  if (!patients || patients.length === 0) return [];

  const todayStr = getLocalDateString();
  const readIds = getReadNotificationIds();
  const notifications: AppNotification[] = [];

  // Filter pasien sesuai hak akses wilayah jika bukan koordinator/admin
  const scopedPatients = patients.filter((p) => {
    if (!currentUser) return true;
    if (!currentUser.isKoordinator && currentUser.kelurahan && currentUser.kelurahan !== "Semua") {
      return p.kelurahan.toLowerCase() === currentUser.kelurahan.toLowerCase();
    }
    return true;
  });

  scopedPatients.forEach((patient) => {
    // ----------------------------------------------------
    // 1. NOTIFIKASI PASIEN BARU DITAMBAHKAN
    // ----------------------------------------------------
    // Pasien baru dianggap baru jika disubmit dalam 3 hari terakhir atau memiliki flag khusus
    let isNewPatient = false;
    const submitTime = patient.timestamp_submit || patient.waktuKejadian;
    if (submitTime) {
      // Parse tanggal submit
      let submitDateStr = "";
      if (submitTime.includes("/")) {
        const parts = submitTime.split(" ")[0].split("/");
        if (parts.length === 3) {
          submitDateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      } else if (submitTime.includes("-")) {
        submitDateStr = submitTime.slice(0, 10);
      }

      if (submitDateStr) {
        const diff = getDaysDiff(submitDateStr, todayStr);
        // Jika disubmit dalam rentang 3 hari terakhir (diff >= -3 && diff <= 0)
        if (diff !== null && diff >= -3 && diff <= 0) {
          isNewPatient = true;
        }
      }
    }

    if (isNewPatient) {
      const notifId = `notif-new-${patient.id_kasus}`;
      notifications.push({
        id: notifId,
        type: "new_patient",
        title: `Pasien Baru Ditambahkan: ${patient.namaKorban}`,
        message: `Kasus baru di Kel. ${patient.kelurahan} (${patient.spesiesHPR}, luka di ${patient.lokasiLuka || "tubuh"}). Siap dilakukan pemantauan.`,
        patientId: patient.id_kasus,
        patientName: patient.namaKorban,
        kelurahan: patient.kelurahan,
        timestamp: patient.timestamp_submit || "Baru saja",
        isRead: readIds.includes(notifId),
        urgency: "info",
        actionType: "open_detail"
      });
    }

    // ----------------------------------------------------
    // 2. NOTIFIKASI JADWAL VAR JATUH TEMPO / TERLAMBAT
    // ----------------------------------------------------
    if (patient.jadwalVAR && patient.statusPemantauan !== "Selesai Observasi (14 Hari)") {
      const doses: Array<{
        key: "dosis0" | "dosis3" | "dosis7" | "dosis21";
        label: string;
        data?: { tanggal: string; status: string; keterangan?: string };
      }> = [
        { key: "dosis0", label: "Dosis 0 (Hari ke-0)", data: patient.jadwalVAR.dosis0 },
        { key: "dosis3", label: "Dosis 3 (Hari ke-3)", data: patient.jadwalVAR.dosis3 },
        { key: "dosis7", label: "Dosis 7 (Hari ke-7)", data: patient.jadwalVAR.dosis7 },
        { key: "dosis21", label: "Dosis 21 (Hari ke-21)", data: patient.jadwalVAR.dosis21 }
      ];

      doses.forEach((d) => {
        if (!d.data || !d.data.tanggal) return;
        const status = d.data.status || "Belum Diberikan";
        // Hanya cek yang belum berstatus 'Sudah Diberikan' atau 'Tidak Perlu'
        if (status === "Sudah Diberikan" || status === "Tidak Perlu") return;

        const diff = getDaysDiff(d.data.tanggal, todayStr);
        if (diff === null) return;

        const notifId = `notif-var-${patient.id_kasus}-${d.key}-${d.data.tanggal}`;

        if (diff < 0) {
          // Terlambat / Sudah Lewat Jatuh Tempo
          const lateDays = Math.abs(diff);
          notifications.push({
            id: notifId,
            type: "due_var",
            title: `⚠️ VAR Terlambat (${lateDays} hari): ${patient.namaKorban}`,
            message: `Jadwal ${d.label} jatuh tempo pada ${formatFriendlyDate(d.data.tanggal)} namun status masih '${status}'. Mohon segera lakukan verifikasi/pemberian vaksin.`,
            patientId: patient.id_kasus,
            patientName: patient.namaKorban,
            kelurahan: patient.kelurahan,
            timestamp: `Jatuh tempo: ${formatFriendlyDate(d.data.tanggal)}`,
            dueDate: d.data.tanggal,
            isRead: readIds.includes(notifId),
            urgency: "urgent",
            doseName: d.label,
            actionType: "update_var"
          });
        } else if (diff === 0) {
          // Jatuh Tempo Hari Ini
          notifications.push({
            id: notifId,
            type: "due_var",
            title: `🔔 Jadwal VAR Hari Ini: ${patient.namaKorban}`,
            message: `Hari ini adalah jadwal ${d.label} untuk pasien ${patient.namaKorban} di Kel. ${patient.kelurahan}. Pastikan pasien menerima suntikan.`,
            patientId: patient.id_kasus,
            patientName: patient.namaKorban,
            kelurahan: patient.kelurahan,
            timestamp: "Jatuh tempo: Hari Ini",
            dueDate: d.data.tanggal,
            isRead: readIds.includes(notifId),
            urgency: "today",
            doseName: d.label,
            actionType: "update_var"
          });
        } else if (diff === 1 || diff === 2) {
          // Jatuh Tempo Mendatang (Besok / Lusa)
          notifications.push({
            id: notifId,
            type: "due_var",
            title: `📅 Jadwal VAR Segera (${diff === 1 ? "Besok" : "2 hari lagi"}): ${patient.namaKorban}`,
            message: `Jadwal ${d.label} direncanakan pada ${formatFriendlyDate(d.data.tanggal)}. Siapkan logistik VAR di Puskesmas.`,
            patientId: patient.id_kasus,
            patientName: patient.namaKorban,
            kelurahan: patient.kelurahan,
            timestamp: `Jadwal: ${formatFriendlyDate(d.data.tanggal)}`,
            dueDate: d.data.tanggal,
            isRead: readIds.includes(notifId),
            urgency: "upcoming",
            doseName: d.label,
            actionType: "update_var"
          });
        }
      });
    }

    // ----------------------------------------------------
    // 3. NOTIFIKASI OBSERVASI 14 HARI JATUH TEMPO
    // ----------------------------------------------------
    if (patient.statusPemantauan === "Dalam Pemantauan (Aktif)") {
      if (patient.tglSelesaiObservasi) {
        const diffObs = getDaysDiff(patient.tglSelesaiObservasi, todayStr);
        if (diffObs !== null) {
          const notifId = `notif-obs-${patient.id_kasus}-${patient.tglSelesaiObservasi}`;

          if (diffObs <= 0) {
            // Hari ke-14 telah tiba atau lewat
            notifications.push({
              id: notifId,
              type: "due_observation",
              title: `🏁 Masa Observasi 14 Hari Tuntas: ${patient.namaKorban}`,
              message: `Masa 14 hari pemantauan hewan (${patient.spesiesHPR}) telah genap per ${formatFriendlyDate(patient.tglSelesaiObservasi)}. Silakan lakukan evaluasi pelepasan status pasien.`,
              patientId: patient.id_kasus,
              patientName: patient.namaKorban,
              kelurahan: patient.kelurahan,
              timestamp: `Batas: ${formatFriendlyDate(patient.tglSelesaiObservasi)}`,
              dueDate: patient.tglSelesaiObservasi,
              isRead: readIds.includes(notifId),
              urgency: diffObs < 0 ? "urgent" : "today",
              actionType: "update_log"
            });
          }
        }
      }

      // Kasus hewannya mati/positif tapi pemantauan belum di-update
      if (
        patient.statusHewanObservasi.includes("Mati") ||
        patient.statusHewanObservasi.includes("Positif") ||
        patient.statusHewanObservasi.includes("Kabur")
      ) {
        const notifId = `notif-urgent-hpr-${patient.id_kasus}`;
        notifications.push({
          id: notifId,
          type: "urgent_case",
          title: `🚨 Kasus Khusus HPR (${patient.statusHewanObservasi}): ${patient.namaKorban}`,
          message: `Hewan ${patient.spesiesHPR} berstatus '${patient.statusHewanObservasi}'. Pastikan pasien menerima VAR/SAR lengkap dan koordinasikan dengan Dinas Peternakan.`,
          patientId: patient.id_kasus,
          patientName: patient.namaKorban,
          kelurahan: patient.kelurahan,
          timestamp: patient.lastUpdated || "Perlu Tindakan",
          isRead: readIds.includes(notifId),
          urgency: "urgent",
          actionType: "update_var"
        });
      }
    }
  });

  // Urutkan notifikasi: Urgent (Merah) -> Today (Kuning) -> Info (Baru) -> Upcoming (Hijau)
  const urgencyWeight: Record<NotificationUrgency, number> = {
    urgent: 1,
    today: 2,
    info: 3,
    upcoming: 4
  };

  return notifications.sort((a, b) => {
    // Utamakan belum dibaca
    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }
    return urgencyWeight[a.urgency] - urgencyWeight[b.urgency];
  });
}

// Helper periksa apakah ada pasien yang jatuh tempo atau baru
export function checkPatientNotificationBadge(patient: PatientMonitoringItem): {
  isDue: boolean;
  isNew: boolean;
  dueLabel?: string;
} {
  const todayStr = getLocalDateString();
  let isDue = false;
  let isNew = false;
  let dueLabel = "";

  // Cek pasien baru
  const submitTime = patient.timestamp_submit || patient.waktuKejadian;
  if (submitTime) {
    let submitDateStr = "";
    if (submitTime.includes("/")) {
      const parts = submitTime.split(" ")[0].split("/");
      if (parts.length === 3) {
        submitDateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    } else if (submitTime.includes("-")) {
      submitDateStr = submitTime.slice(0, 10);
    }
    if (submitDateStr) {
      const diff = getDaysDiff(submitDateStr, todayStr);
      if (diff !== null && diff >= -2 && diff <= 0) {
        isNew = true;
      }
    }
  }

  // Cek VAR jatuh tempo
  if (patient.jadwalVAR && patient.statusPemantauan !== "Selesai Observasi (14 Hari)") {
    const doses = [
      { key: "Dosis 0", data: patient.jadwalVAR.dosis0 },
      { key: "Dosis 3", data: patient.jadwalVAR.dosis3 },
      { key: "Dosis 7", data: patient.jadwalVAR.dosis7 },
      { key: "Dosis 21", data: patient.jadwalVAR.dosis21 }
    ];

    for (const d of doses) {
      if (d.data?.tanggal && d.data.status !== "Sudah Diberikan" && d.data.status !== "Tidak Perlu") {
        const diff = getDaysDiff(d.data.tanggal, todayStr);
        if (diff !== null && diff <= 0) {
          isDue = true;
          dueLabel = diff === 0 ? `Jatuh Tempo Hari Ini (${d.key})` : `Terlambat ${Math.abs(diff)} hari (${d.key})`;
          break;
        }
      }
    }
  }

  // Cek Observasi 14 hari jatuh tempo
  if (!isDue && patient.statusPemantauan === "Dalam Pemantauan (Aktif)" && patient.tglSelesaiObservasi) {
    const diff = getDaysDiff(patient.tglSelesaiObservasi, todayStr);
    if (diff !== null && diff <= 0) {
      isDue = true;
      dueLabel = "Observasi 14 Hari Selesai";
    }
  }

  return { isDue, isNew, dueLabel };
}
