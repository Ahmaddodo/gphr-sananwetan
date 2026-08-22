import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Bell,
  CheckCheck,
  Clock,
  Syringe,
  UserPlus,
  AlertTriangle,
  X,
  ChevronRight,
  Activity,
  CheckCircle2,
  Calendar,
  MapPin,
  ExternalLink
} from "lucide-react";
import { AppNotification, markNotificationAsRead, markAllNotificationsAsRead } from "../lib/notificationService";
import { PatientMonitoringItem, UserAccessProfile } from "../types";

interface NotificationBellProps {
  notifications: AppNotification[];
  onSelectNotificationAction: (
    patientId: string,
    actionType?: "update_var" | "open_detail" | "update_log"
  ) => void;
  onRefreshNotifications: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onSelectNotificationAction,
  onRefreshNotifications
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "due" | "new">("all");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Hitung jumlah notifikasi belum dibaca
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Hitung jumlah notifikasi urgent / jatuh tempo
  const dueCount = useMemo(() => {
    return notifications.filter((n) => n.type === "due_var" || n.type === "due_observation" || n.type === "urgent_case").length;
  }, [notifications]);

  const newPatientCount = useMemo(() => {
    return notifications.filter((n) => n.type === "new_patient").length;
  }, [notifications]);

  // Filter notifikasi sesuai tab yang dipilih
  const filteredNotifications = useMemo(() => {
    if (filterTab === "due") {
      return notifications.filter((n) => n.type === "due_var" || n.type === "due_observation" || n.type === "urgent_case");
    }
    if (filterTab === "new") {
      return notifications.filter((n) => n.type === "new_patient");
    }
    return notifications;
  }, [notifications, filterTab]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    markAllNotificationsAsRead(allIds);
    onRefreshNotifications();
  };

  const handleItemClick = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);
    onRefreshNotifications();
    setIsOpen(false);
    onSelectNotificationAction(notif.patientId, notif.actionType);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        id="btn-notification-bell"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
            : unreadCount > 0
            ? "bg-amber-50/80 border-amber-200 text-amber-700 hover:bg-amber-100/80 hover:text-amber-800"
            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
        title="Pemberitahuan Jadwal Jatuh Tempo & Pasien Baru"
      >
        <Bell size={18} className={unreadCount > 0 ? "animate-wiggle" : ""} />

        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          id="popover-notification-center"
          className="absolute right-0 mt-2 w-[340px] sm:w-[420px] max-w-[92vw] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600/80 flex items-center justify-center text-white">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold tracking-tight flex items-center gap-1.5">
                  Notifikasi & Pengingat
                  {unreadCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {unreadCount} Baru
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400">
                  Jatuh tempo VAR & penambahan pasien baru
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-blue-300 hover:text-white flex items-center gap-1 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-800"
                title="Tandai semua notifikasi sudah dibaca"
              >
                <CheckCheck size={13} />
                <span className="hidden sm:inline">Tandai Dibaca</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-2 bg-slate-50 border-b border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer text-[11px] ${
                filterTab === "all"
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua ({notifications.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterTab("due")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer text-[11px] flex items-center justify-center gap-1 ${
                filterTab === "due"
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              <Clock size={12} />
              <span>Jatuh Tempo ({dueCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab("new")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center transition cursor-pointer text-[11px] flex items-center justify-center gap-1 ${
                filterTab === "new"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-blue-700 hover:bg-blue-50"
              }`}
            >
              <UserPlus size={12} />
              <span>Pasien Baru ({newPatientCount})</span>
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                </div>
                <div className="text-xs font-bold text-slate-700">
                  Tidak ada notifikasi aktif
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Semua jadwal VAR dan masa observasi terpantau aman, serta tidak ada pasien baru yang belum diperiksa.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isUrgent = notif.urgency === "urgent";
                const isToday = notif.urgency === "today";
                const isNew = notif.type === "new_patient";

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3 rounded-xl transition cursor-pointer flex items-start gap-3 relative group ${
                      !notif.isRead
                        ? isUrgent
                          ? "bg-rose-50/60 hover:bg-rose-100/70 border border-rose-100"
                          : isToday
                          ? "bg-amber-50/60 hover:bg-amber-100/70 border border-amber-100"
                          : "bg-blue-50/60 hover:bg-blue-100/70 border border-blue-100"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {!notif.isRead && (
                      <span
                        className={`absolute left-1.5 top-3.5 h-2 w-2 rounded-full ${
                          isUrgent ? "bg-rose-600" : isToday ? "bg-amber-500" : "bg-blue-600"
                        }`}
                      />
                    )}

                    {/* Icon Type */}
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ml-1.5 ${
                        isUrgent
                          ? "bg-rose-100 text-rose-700"
                          : isToday
                          ? "bg-amber-100 text-amber-700"
                          : isNew
                          ? "bg-blue-100 text-blue-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {notif.type === "due_var" ? (
                        <Syringe size={16} />
                      ) : notif.type === "new_patient" ? (
                        <UserPlus size={16} />
                      ) : notif.type === "urgent_case" ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <Clock size={16} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            isUrgent
                              ? "bg-rose-200 text-rose-900"
                              : isToday
                              ? "bg-amber-200 text-amber-900"
                              : isNew
                              ? "bg-blue-200 text-blue-900"
                              : "bg-emerald-200 text-emerald-900"
                          }`}
                        >
                          {isUrgent
                            ? "Terlambat"
                            : isToday
                            ? "Hari Ini"
                            : isNew
                            ? "Pasien Baru"
                            : "Jadwal Dekat"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {notif.timestamp}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 mt-1 leading-snug group-hover:text-blue-700 transition">
                        {notif.title}
                      </h4>

                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-200/60 text-[10px]">
                        <span className="font-semibold text-slate-500 flex items-center gap-1">
                          <MapPin size={11} className="text-slate-400" />
                          Kel. {notif.kelurahan} • ID: {notif.patientId}
                        </span>

                        <span className="font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          <span>Buka Pasien</span>
                          <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-500">
            Klik notifikasi untuk langsung membuka rekam pemantauan pasien
          </div>
        </div>
      )}
    </div>
  );
};
