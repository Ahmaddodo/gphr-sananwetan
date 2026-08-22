import React, { useState } from "react";
import {
  Users,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Edit2,
  Check,
  X,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Building2,
  Lock,
  User,
  AlertCircle,
  Save,
  Sparkles,
  ShieldAlert,
  RefreshCw,
  CloudUpload
} from "lucide-react";
import { UserAccessProfile, KelurahanWilayah } from "../types";
import {
  getOfficerProfiles,
  saveOfficerProfiles,
  resetOfficerProfilesToDefault,
  syncOfficerProfilesFromGoogleSheets,
  pushOfficerProfilesToGoogleSheets,
  KELURAHAN_LIST
} from "../lib/patientMonitoring";
import { hashPassword } from "../lib/cryptoAuth";

interface OfficerAccountManagerProps {
  onAccountsUpdated?: () => void;
}

export const OfficerAccountManager: React.FC<OfficerAccountManagerProps> = ({
  onAccountsUpdated
}) => {
  const [profiles, setProfiles] = useState<UserAccessProfile[]>(() => getOfficerProfiles());
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  React.useEffect(() => {
    const handleSync = () => {
      setProfiles(getOfficerProfiles());
    };
    window.addEventListener("ghpr_officers_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("ghpr_officers_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserAccessProfile> & { newPasswordInput?: string }>({});
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string>("");
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newAccountForm, setNewAccountForm] = useState<Partial<UserAccessProfile> & { rawPassword?: string }>({
    nama: "",
    nip: "",
    jabatan: "Perawat Pelaksana Surveilans",
    kelurahan: "Sananwetan",
    role: "Petugas Wilayah",
    username: "",
    rawPassword: "",
    canCreate: true,
    canUpdate: true,
    canDelete: false,
    isKoordinator: false
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleStartEdit = (profile: UserAccessProfile) => {
    setEditingId(profile.id);
    setEditError("");
    setShowEditPassword(false);
    setEditForm({
      nama: profile.nama,
      nip: profile.nip,
      jabatan: profile.jabatan,
      kelurahan: profile.kelurahan,
      role: profile.role,
      username: profile.username || "",
      newPasswordInput: "",
      isKoordinator: profile.isKoordinator
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setEditError("");
    setShowEditPassword(false);
  };

  const handleSaveEdit = (id: string) => {
    setEditError("");
    const cleanUsername = (editForm.username || "").trim().toLowerCase();
    const cleanNama = (editForm.nama || "").trim();

    if (!cleanUsername) {
      setEditError("Username login tidak boleh kosong.");
      return;
    }

    if (!cleanNama) {
      setEditError("Nama lengkap petugas tidak boleh kosong.");
      return;
    }

    // Check duplicate username with other accounts
    const isDuplicate = profiles.some(
      (p) => p.id !== id && p.username?.toLowerCase() === cleanUsername
    );
    if (isDuplicate) {
      setEditError(`Username '${cleanUsername}' sudah digunakan oleh petugas lain. Gunakan username unik.`);
      return;
    }

    const updatedList = profiles.map((p) => {
      if (p.id === id) {
        let finalPasswordHash = p.password;
        // Jika ada input password baru, hash menggunakan SHA-256 + Salt
        if (editForm.newPasswordInput && editForm.newPasswordInput.trim().length > 0) {
          finalPasswordHash = hashPassword(editForm.newPasswordInput.trim(), cleanUsername);
        } else if (cleanUsername !== p.username?.toLowerCase()) {
          // Jika username berubah tanpa password baru, perbarui hash dengan salt baru
          finalPasswordHash = hashPassword("password123", cleanUsername);
        }

        const isKoord = editForm.isKoordinator !== undefined ? editForm.isKoordinator : p.isKoordinator;
        const kel = (editForm.kelurahan as KelurahanWilayah) || p.kelurahan || "Sananwetan";
        const updatedRole = isKoord
          ? "Koordinator Surveilans Rabies Puskesmas"
          : (kel === "Semua" ? "Koordinator Surveilans Rabies Puskesmas" : `Petugas Wilayah Kel. ${kel}`);

        return {
          ...p,
          nama: cleanNama,
          nip: (editForm.nip || p.nip || "").trim() || "-",
          jabatan: (editForm.jabatan || p.jabatan || "").trim() || "Petugas Surveilans",
          kelurahan: isKoord ? "Semua" : kel,
          role: updatedRole,
          username: cleanUsername,
          password: finalPasswordHash,
          isKoordinator: isKoord || kel === "Semua"
        };
      }
      return p;
    });

    setProfiles(updatedList);
    saveOfficerProfiles(updatedList);
    setEditingId(null);
    setEditForm({});
    setEditError("");
    showToast(`Akun '${cleanUsername}' (${cleanNama}) berhasil disimpan dan diperbarui!`);
    if (onAccountsUpdated) onAccountsUpdated();
  };

  const handleQuickResetPassword = (id: string, defaultPw: string = "password123") => {
    const target = profiles.find((p) => p.id === id);
    if (!target) return;

    const cleanUsername = target.username || target.nip || "petugas";
    const hashed = hashPassword(defaultPw, cleanUsername);

    const updatedList = profiles.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          password: hashed
        };
      }
      return p;
    });
    setProfiles(updatedList);
    saveOfficerProfiles(updatedList);
    showToast(`Password akun '${cleanUsername}' telah disetel ulang secara terenkripsi ke '${defaultPw}'.`);
    if (onAccountsUpdated) onAccountsUpdated();
  };

  const handleResetAllToDefault = () => {
    if (
      confirm(
        "Apakah Anda yakin ingin mengembalikan seluruh akun petugas & kata sandi ke pengaturan bawaan terenkripsi?"
      )
    ) {
      const def = resetOfficerProfilesToDefault();
      setProfiles(def);
      setEditingId(null);
      showToast("Semua akun petugas & password berhasil dikembalikan ke standar awal terenkripsi.");
      if (onAccountsUpdated) onAccountsUpdated();
    }
  };

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      // 1. Ambil dari cloud (Pull)
      const pullRes = await syncOfficerProfilesFromGoogleSheets();
      if (pullRes.success) {
        setProfiles(pullRes.profiles);
        // 2. Kirim balik (Push) untuk memastikan cloud sinkron 100%
        await pushOfficerProfilesToGoogleSheets(pullRes.profiles);
        showToast(pullRes.message || "Akun petugas berhasil disinkronkan dengan Google Spreadsheet & Cloud.");
      } else {
        // Jika gagal pull, coba push profil lokal saat ini ke cloud
        const pushRes = await pushOfficerProfilesToGoogleSheets(profiles);
        showToast(pushRes.message || "Data akun lokal berhasil dikirim ke Google Sheets.");
      }
      if (onAccountsUpdated) onAccountsUpdated();
    } catch (err: any) {
      showToast(`Gagal sinkron cloud: ${err.message || String(err)}`);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleCreateNewAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = (newAccountForm.username || "").trim().toLowerCase();
    const cleanPass = (newAccountForm.rawPassword || "").trim();
    const cleanName = (newAccountForm.nama || "").trim();

    if (!cleanUser || !cleanPass || !cleanName) {
      alert("Nama, Username, dan Password wajib diisi.");
      return;
    }

    if (cleanPass.length < 6) {
      alert("Password minimal 6 karakter demi keamanan akun.");
      return;
    }

    const isDuplicate = profiles.some((p) => p.username?.toLowerCase() === cleanUser);
    if (isDuplicate) {
      alert(`Username '${cleanUser}' sudah digunakan. Silakan pilih username lain.`);
      return;
    }

    // Hash password dengan SHA-256 + Salt
    const hashedPassword = hashPassword(cleanPass, cleanUser);

    const newProfile: UserAccessProfile = {
      id: "user-" + Math.random().toString(36).slice(2, 9),
      nama: cleanName,
      nip: (newAccountForm.nip || "").trim() || "198000000000000000",
      jabatan: newAccountForm.jabatan || "Petugas Surveilans",
      kelurahan: (newAccountForm.kelurahan as KelurahanWilayah) || "Sananwetan",
      role: newAccountForm.isKoordinator
        ? "Koordinator Surveilans Rabies Puskesmas"
        : `Petugas Wilayah Kel. ${newAccountForm.kelurahan || "Sananwetan"}`,
      username: cleanUser,
      password: hashedPassword,
      email: `${cleanUser}@puskesmas.sananwetan.go.id`,
      canCreate: true,
      canUpdate: true,
      canDelete: cleanUser === "admin" || cleanUser === "widodo",
      isKoordinator: !!newAccountForm.isKoordinator
    };

    const updated = [...profiles, newProfile];
    setProfiles(updated);
    saveOfficerProfiles(updated);
    setIsAddingNew(false);
    setNewAccountForm({
      nama: "",
      nip: "",
      jabatan: "Perawat Pelaksana Surveilans",
      kelurahan: "Sananwetan",
      role: "Petugas Wilayah",
      username: "",
      rawPassword: "",
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      isKoordinator: false
    });
    showToast(`Akun baru '${newProfile.nama}' (${cleanUser}) berhasil disimpan secara terenkripsi!`);
    if (onAccountsUpdated) onAccountsUpdated();
  };

  const handleDeleteAccount = (id: string, name: string) => {
    if (profiles.length <= 1) {
      alert("Tidak dapat menghapus semua akun. Minimal harus ada 1 akun aktif.");
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus akun petugas '${name}'?`)) {
      const filtered = profiles.filter((p) => p.id !== id);
      setProfiles(filtered);
      saveOfficerProfiles(filtered);
      showToast(`Akun '${name}' telah dihapus.`);
      if (onAccountsUpdated) onAccountsUpdated();
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.nama.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q) ||
      p.nip.toLowerCase().includes(q) ||
      p.kelurahan.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="rounded-xl bg-emerald-600 text-white p-3 text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <Check size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Info Banner Keamanan & Enkripsi Kriptografi */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-200 p-4 space-y-2">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <span>Keamanan Kredensial Terenkripsi Kriptografi SHA-256 + Salt</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full border border-emerald-300">
                Aman & Tanpa Jejak
              </span>
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
              Seluruh kata sandi petugas disimpan dalam bentuk <b>One-Way Hash SHA-256</b>. Orang yang tidak memiliki password tidak dapat mencari atau melihat kata sandi asli melalui inspect element atau histori peramban.
            </p>
          </div>
        </div>
      </div>

      {/* Header Actions & Search Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama petugas, username, NIP, atau kelurahan..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleManualCloudSync}
            disabled={isSyncingCloud}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            title="Sinkronkan data petugas dengan Google Sheets & seluruh perangkat"
          >
            <RefreshCw size={13} className={isSyncingCloud ? "animate-spin" : ""} />
            <span>{isSyncingCloud ? "Menyinkronkan..." : "Sinkronkan Cloud"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddingNew((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah Akun Petugas</span>
          </button>

          <button
            type="button"
            onClick={handleResetAllToDefault}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
            title="Kembalikan semua akun ke data awal dinas"
          >
            <RotateCcw size={13} />
            <span>Reset Standar Awal</span>
          </button>
        </div>
      </div>

      {/* FORM TAMBAH AKUN PETUGAS BARU */}
      {isAddingNew && (
        <form
          onSubmit={handleCreateNewAccount}
          className="rounded-2xl border-2 border-blue-400 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 p-4 space-y-3.5 shadow-md"
        >
          <div className="flex items-center justify-between border-b border-blue-200 pb-2">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
              <Plus size={16} className="text-blue-600" />
              <span>Formulir Tambah Petugas & Kredensial Baru</span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nama Lengkap & Gelar <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newAccountForm.nama || ""}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, nama: e.target.value })}
                placeholder="Contoh: dr. Triana / Ahmad, A.Md.Kep"
                className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 outline-none bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">NIP Petugas</label>
              <input
                type="text"
                value={newAccountForm.nip || ""}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, nip: e.target.value })}
                placeholder="Contoh: 198501012010011001"
                className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 outline-none bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Jabatan Dinas</label>
              <input
                type="text"
                value={newAccountForm.jabatan || ""}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, jabatan: e.target.value })}
                placeholder="Contoh: Perawat PJ Wilayah"
                className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 outline-none bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Wilayah Kelurahan</label>
              <select
                value={newAccountForm.kelurahan || "Sananwetan"}
                onChange={(e) =>
                  setNewAccountForm({
                    ...newAccountForm,
                    kelurahan: e.target.value as KelurahanWilayah
                  })
                }
                className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 outline-none bg-white"
              >
                <option value="Semua">Semua Kelurahan (Koordinator)</option>
                {KELURAHAN_LIST.map((k) => (
                  <option key={k} value={k}>
                    Kelurahan {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Username Login <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newAccountForm.username || ""}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, username: e.target.value })}
                placeholder="Contoh: petugas_baru / ahmad"
                className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 outline-none font-mono bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Password Login Baru <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                required
                value={newAccountForm.rawPassword || ""}
                onChange={(e) => setNewAccountForm({ ...newAccountForm, rawPassword: e.target.value })}
                placeholder="Masukkan kata sandi (min. 6 karakter)..."
                className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 outline-none font-mono bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
            >
              Simpan Akun Terenkripsi
            </button>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 text-xs font-semibold transition cursor-pointer"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Account Cards / Table List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredProfiles.map((p) => {
          const isEditing = editingId === p.id;

          return (
            <div
              key={p.id}
              className={`rounded-2xl border transition-all p-4 space-y-3 ${
                isEditing
                  ? "border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-md"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
              }`}
            >
              {isEditing ? (
                /* Mode Edit Inline */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveEdit(p.id);
                  }}
                  className="space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                    <span className="font-bold text-blue-900 flex items-center gap-1.5">
                      <Edit2 size={13} className="text-blue-600" />
                      <span>Edit Profil & Kredensial Petugas</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {editError && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px] text-rose-700 font-semibold flex items-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0 text-rose-500" />
                      <span>{editError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">
                        Nama Lengkap <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.nama || ""}
                        onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">NIP Petugas</label>
                      <input
                        type="text"
                        value={editForm.nip || ""}
                        onChange={(e) => setEditForm({ ...editForm, nip: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">
                        Username Login <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.username || ""}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-mono font-bold text-blue-700"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block font-bold text-slate-700">
                          Password Baru (Opsional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          className="text-[10.5px] text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                          {showEditPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>{showEditPassword ? "Sembunyikan" : "Lihat"}</span>
                        </button>
                      </div>
                      <input
                        type={showEditPassword ? "text" : "password"}
                        placeholder="Ketik password baru jika ingin diganti..."
                        value={editForm.newPasswordInput || ""}
                        onChange={(e) => setEditForm({ ...editForm, newPasswordInput: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 font-mono text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">Wilayah Kelurahan</label>
                      <select
                        value={editForm.kelurahan || "Sananwetan"}
                        onChange={(e) => {
                          const val = e.target.value as KelurahanWilayah;
                          setEditForm({
                            ...editForm,
                            kelurahan: val,
                            isKoordinator: val === "Semua" ? true : editForm.isKoordinator
                          });
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs outline-none focus:border-blue-500"
                      >
                        <option value="Semua">Semua Kelurahan (Koordinator)</option>
                        {KELURAHAN_LIST.map((k) => (
                          <option key={k} value={k}>
                            Kelurahan {k}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-0.5">Jabatan Dinas</label>
                      <input
                        type="text"
                        value={editForm.jabatan || ""}
                        onChange={(e) => setEditForm({ ...editForm, jabatan: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Password Preset Helper Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-500 font-medium">Isi cepat password:</span>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, newPasswordInput: "password123" })}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 font-mono border border-slate-200 cursor-pointer"
                    >
                      password123
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, newPasswordInput: "admin123" })}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 font-mono border border-slate-200 cursor-pointer"
                    >
                      admin123
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, newPasswordInput: "123456" })}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 font-mono border border-slate-200 cursor-pointer"
                    >
                      123456
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-blue-200/60">
                    <button
                      id={`btn-save-officer-${p.id}`}
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white px-3.5 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      <Save size={13} />
                      <span>Simpan Perubahan</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 text-xs font-semibold transition cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : (
                /* Mode Display Normal */
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          {p.nama}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.isKoordinator
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {p.isKoordinator ? "Koordinator (Semua)" : `Kel. ${p.kelurahan}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        NIP. {p.nip} • {p.jabatan}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(p)}
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer"
                        title="Edit Username & Ganti Kata Sandi"
                      >
                        <Edit2 size={14} />
                      </button>
                      {!p.isKoordinator && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(p.id, p.nama)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                          title="Hapus Akun Petugas"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Kredensial Login Box */}
                  <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Username Login:</span>
                      <code className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {p.username || p.nip}
                      </code>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Status Kata Sandi:</span>
                      <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Lock size={11} className="text-emerald-600" />
                        <span>Terenkripsi SHA-256 (Aman)</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Reset */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Hak Akses: {p.role}</span>
                    <button
                      type="button"
                      onClick={() => handleQuickResetPassword(p.id)}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                    >
                      Reset Sandi: password123
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
