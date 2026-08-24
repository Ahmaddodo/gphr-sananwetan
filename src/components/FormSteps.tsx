import React, { useState, useEffect } from "react";
import { Clock, Users, User, FileText, ChevronRight, TriangleAlert, Camera, Trash2, Upload, Lock, FileSpreadsheet, ExternalLink, Database, Send, Settings2, UserCheck } from "lucide-react";
import { FormGHPRData, FormErrors, UserAccessProfile } from "../types";
import { FormInput } from "./FormInput";
import { SignaturePad } from "./SignaturePad";
import { DEFAULT_PELAKSANA_NAMA, DEFAULT_PELAKSANA_NIP } from "./SignatureData";
import { getOfficerProfiles, getActiveUserProfile } from "../lib/patientMonitoring";

interface FormStepsProps {
  step: number;
  formData: FormGHPRData;
  errors: FormErrors;
  updateField: (field: keyof FormGHPRData, value: string) => void;
  listKelurahan: string[];
  listKecamatan: string[];
  listKabKota: string[];
  OTHER_VAL: string;
  OTHER_DATALIST: string;
  isOther: (val?: string) => boolean;
  isExactOther: (val?: string) => boolean;
  getFinalKelurahan: () => string;
  getFinalKecamatan: () => string;
  getFinalKabKota: () => string;
  isAdminMode?: boolean;
  isEditing?: boolean;
  editingCaseId?: string | null;
  showAsterisk?: boolean;
}

export const FormSteps: React.FC<FormStepsProps> = ({
  step,
  formData,
  errors,
  updateField,
  listKelurahan,
  listKecamatan,
  listKabKota,
  OTHER_VAL,
  OTHER_DATALIST,
  isOther,
  isExactOther,
  getFinalKelurahan,
  getFinalKecamatan,
  getFinalKabKota,
  isAdminMode = false,
  isEditing = false,
  editingCaseId = null,
  showAsterisk = true,
}) => {
  const [officerProfiles, setOfficerProfiles] = useState<UserAccessProfile[]>(() => getOfficerProfiles());
  const [activeUser, setActiveUser] = useState<UserAccessProfile | null>(() => getActiveUserProfile());

  useEffect(() => {
    const handleOfficerSync = () => {
      setOfficerProfiles(getOfficerProfiles());
      setActiveUser(getActiveUserProfile());
    };
    window.addEventListener("ghpr_officers_updated", handleOfficerSync);
    window.addEventListener("storage", handleOfficerSync);
    return () => {
      window.removeEventListener("ghpr_officers_updated", handleOfficerSync);
      window.removeEventListener("storage", handleOfficerSync);
    };
  }, []);

  useEffect(() => {
    if (!formData.pelaksanaNama) {
      updateField("pelaksanaNama", DEFAULT_PELAKSANA_NAMA);
    }
    if (!formData.pelaksanaNIP) {
      updateField("pelaksanaNIP", DEFAULT_PELAKSANA_NIP);
    }
  }, [formData.pelaksanaNama, formData.pelaksanaNIP, updateField]);

  const currentPelaksanaNama = formData.pelaksanaNama || DEFAULT_PELAKSANA_NAMA;
  const currentPelaksanaNIP = formData.pelaksanaNIP || DEFAULT_PELAKSANA_NIP;

  return (
    <div className="space-y-6">
      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormInput
              label="Waktu Kejadian"
              k="waktuKejadian"
              type="datetime-local"
              required
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1">
                <span>Sumber Informasi</span>
                {showAsterisk && (
                  <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none">*</span>
                )}
              </label>
              <div className="relative">
                <input
                  list="sumberinfo-datalist"
                  value={formData.sumberInfo}
                  onChange={(e) => updateField("sumberInfo", e.target.value)}
                  placeholder="Ketik sumber informasi (misal: Laporan Warga, Puskesmas...)"
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                    errors.sumberInfo ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
                  }`}
                />
                <datalist id="sumberinfo-datalist">
                  <option value="Laporan Warga" />
                  <option value="Puskesmas" />
                  <option value="Rumah Sakit" />
                  <option value="Perangkat Desa" />
                  <option value="Bhabinkamtibmas" />
                  <option value="Kader Kesehatan" />
                </datalist>
              </div>
              <p className="text-[11px] text-slate-500">
                Ketik langsung atau pilih dari rekomendasi.
              </p>
              {errors.sumberInfo && (
                <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
                  <TriangleAlert size={12} />
                  {errors.sumberInfo}
                </span>
              )}
            </div>
          </div>

          <FormInput
            label="Alamat Lengkap Kejadian"
            k="alamatKejadian"
            placeholder="Dusun, RT/RW, Jalan..."
            required
            formData={formData}
            errors={errors}
            updateField={updateField}
            showAsterisk={showAsterisk}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Kelurahan/Desa */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1">
                <span>Kelurahan/Desa</span>
                {showAsterisk && (
                  <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none">*</span>
                )}
              </label>
              <div className="relative">
                <input
                  list="kelurahan-datalist"
                  value={formData.kelurahan}
                  onChange={(e) => updateField("kelurahan", e.target.value)}
                  placeholder="Ketik atau pilih kelurahan..."
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-9 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                    errors.kelurahan ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
                  }`}
                />
                <datalist id="kelurahan-datalist">
                  {listKelurahan.map((kName) => (
                    <option key={kName} value={kName} />
                  ))}
                  <option value={OTHER_DATALIST} />
                </datalist>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronRight className="rotate-90" size={14} />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Pilihan: {listKelurahan.join(", ")}. Bisa ketik manual.
              </p>
              {errors.kelurahan && (
                <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
                  <TriangleAlert size={12} />
                  {errors.kelurahan}
                </span>
              )}

              {isOther(formData.kelurahan) && (
                <div className="mt-2 p-3 bg-amber-50/80 border border-amber-200 rounded-lg">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <span>Ketik Kelurahan/Desa Manual</span>
                    {showAsterisk && (
                      <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none">*</span>
                    )}
                  </label>
                  <input
                    value={formData.kelurahanCustom}
                    onChange={(e) => updateField("kelurahanCustom", e.target.value)}
                    placeholder="Contoh: Karangsari, Tanggung..."
                    className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${
                      errors.kelurahanCustom ? "border-rose-400" : "border-amber-200"
                    }`}
                    autoFocus
                  />
                  {errors.kelurahanCustom && (
                    <span className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <TriangleAlert size={12} />
                      {errors.kelurahanCustom}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Kecamatan */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1">
                <span>Kecamatan</span>
                {showAsterisk && (
                  <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none">*</span>
                )}
              </label>

              {/* Tombol Pilihan Cepat */}
              <div className="flex flex-wrap gap-1.5">
                {[...listKecamatan, "Lainnya"].map((opt) => {
                  const isSel =
                    opt === "Lainnya"
                      ? isOther(formData.kecamatan)
                      : formData.kecamatan === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        if (opt === "Lainnya") {
                          updateField("kecamatan", "Lainnya");
                        } else {
                          updateField("kecamatan", opt);
                          updateField("kecamatanCustom", "");
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition cursor-pointer ${
                        isSel
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Teks Input Langsung */}
              <div className="relative mt-1">
                <input
                  list="kecamatan-datalist"
                  value={formData.kecamatan}
                  onChange={(e) => updateField("kecamatan", e.target.value)}
                  placeholder="Atau ketik Kecamatan secara langsung..."
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                    errors.kecamatan ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
                  }`}
                />
                <datalist id="kecamatan-datalist">
                  {listKecamatan.map((kName) => (
                    <option key={kName} value={kName} />
                  ))}
                  <option value={OTHER_DATALIST} />
                </datalist>
              </div>

              {errors.kecamatan && !isOther(formData.kecamatan) && (
                <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
                  <TriangleAlert size={12} />
                  {errors.kecamatan}
                </span>
              )}

              {isOther(formData.kecamatan) && (
                <div className="mt-1 p-3 bg-amber-50/80 border border-amber-200 rounded-lg">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <span>Ketik Kecamatan Manual</span>
                    {showAsterisk && (
                      <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none">*</span>
                    )}
                  </label>
                  <input
                    value={formData.kecamatanCustom}
                    onChange={(e) => updateField("kecamatanCustom", e.target.value)}
                    placeholder="Contoh: Sanankulon, Nglegok..."
                    className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${
                      errors.kecamatanCustom ? "border-rose-400" : "border-amber-200"
                    }`}
                    autoFocus
                  />
                  {errors.kecamatanCustom && (
                    <span className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <TriangleAlert size={12} />
                      {errors.kecamatanCustom}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Kab/Kota */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1">
                <span>Kab/Kota</span>
                {showAsterisk && (
                  <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none">*</span>
                )}
              </label>

              {/* Tombol Pilihan Cepat */}
              <div className="flex flex-wrap gap-1.5">
                {["Kota Blitar", "Kab Blitar", "Lainnya"].map((opt) => {
                  const isSel =
                    opt === "Lainnya"
                      ? isOther(formData.kabupatenKota)
                      : formData.kabupatenKota === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        if (opt === "Lainnya") {
                          updateField("kabupatenKota", "Lainnya");
                        } else {
                          updateField("kabupatenKota", opt);
                          updateField("kabupatenKotaCustom", "");
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition cursor-pointer ${
                        isSel
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Teks Input Langsung */}
              <div className="relative mt-1">
                <input
                  list="kabkota-datalist"
                  value={formData.kabupatenKota}
                  onChange={(e) => updateField("kabupatenKota", e.target.value)}
                  placeholder="Atau ketik Kab/Kota secara langsung..."
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                    errors.kabupatenKota ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
                  }`}
                />
                <datalist id="kabkota-datalist">
                  {listKabKota.map((kab) => (
                    <option key={kab} value={kab} />
                  ))}
                  <option value={OTHER_DATALIST} />
                </datalist>
              </div>

              {errors.kabupatenKota && !isOther(formData.kabupatenKota) && (
                <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
                  <TriangleAlert size={12} />
                  {errors.kabupatenKota}
                </span>
              )}

              {isOther(formData.kabupatenKota) && (
                <div className="mt-1 p-3 bg-amber-50/80 border border-amber-200 rounded-lg">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <span>Ketik Kab/Kota Manual</span>
                    {showAsterisk && (
                      <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none">*</span>
                    )}
                  </label>
                  <input
                    value={formData.kabupatenKotaCustom}
                    onChange={(e) => updateField("kabupatenKotaCustom", e.target.value)}
                    placeholder="Contoh: Kabupaten Tulungagung..."
                    className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 ${
                      errors.kabupatenKotaCustom ? "border-rose-400" : "border-amber-200"
                    }`}
                    autoFocus
                  />
                  {errors.kabupatenKotaCustom && (
                    <span className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <TriangleAlert size={12} />
                      {errors.kabupatenKotaCustom}
                    </span>
                  )}
                </div>
              )}
            </div>

            <FormInput
              label="Provinsi"
              k="provinsi"
              required
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
          </div>

          <div className="rounded-lg bg-slate-100 border border-slate-200 p-3.5 flex flex-wrap gap-3 text-xs max-w-full overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Final Kelurahan:</span>
              <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded px-2 py-0.5">
                {getFinalKelurahan() || "-"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Kecamatan:</span>
              <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded px-2 py-0.5">
                {getFinalKecamatan() || "-"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Kab/Kota:</span>
              <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded px-2 py-0.5">
                {getFinalKabKota() || "-"}
              </span>
            </div>
          </div>

          <FormInput
            label="Kronologi Kejadian"
            k="kronologi"
            type="textarea"
            placeholder="Jelaskan urutan kejadian gigitan, perilaku hewan sebelum menggigit, kontak korban..."
            required
            formData={formData}
            errors={errors}
            updateField={updateField}
            showAsterisk={showAsterisk}
          />

          <div className="rounded-lg bg-blue-50/50 border border-blue-200 p-4 flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Clock size={16} />
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              <b className="text-blue-700 font-bold">Catatan Surveilans:</b> Waktu kejadian gunakan waktu perkiraan jika tidak pasti. Kronologi yang detail membantu penilaian risiko rabies secara objektif.
            </p>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <FormInput
                label="Spesies HPR"
                k="spesiesHPR"
                required
                options={["Anjing", "Kucing", "Kera/Monyet", "Musang", "Kelelawar", "Sapi", "Kambing", "Lainnya"]}
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
              {formData.spesiesHPR === "Lainnya" && (
                <div className="mt-3">
                  <FormInput
                    label="Sebutkan Spesies"
                    k="spesiesLain"
                    placeholder="Contoh: Berang-berang"
                    required
                    formData={formData}
                    errors={errors}
                    updateField={updateField}
                    showAsterisk={showAsterisk}
                  />
                </div>
              )}
            </div>
            <FormInput
              label="Ras / Jenis"
              k="ras"
              placeholder="Kampung / Persia / ..."
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <FormInput
              label="Jenis Kelamin Hewan"
              k="jkHewan"
              required
              options={["Jantan", "Betina", "Tidak Diketahui"]}
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex gap-2">
              <div className="flex-1">
                <FormInput
                  label="Umur"
                  k="umurHewan"
                  type="number"
                  placeholder="3"
                  formData={formData}
                  errors={errors}
                  updateField={updateField}
                  showAsterisk={showAsterisk}
                />
              </div>
              <div className="w-[110px]">
                <FormInput
                  label="Satuan"
                  k="satuanUmur"
                  options={["Bulan", "Tahun"]}
                  formData={formData}
                  errors={errors}
                  updateField={updateField}
                  showAsterisk={showAsterisk}
                />
              </div>
            </div>
            <FormInput
              label="Metode Pemeliharaan"
              k="metodePelihara"
              required
              options={["Liar", "Dilepas Liarkan", "Dikandang", "Semi Liar / Terikat", "Dipondokkan"]}
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <FormInput
              label="Kondisi Hewan Saat Ini"
              k="kondisiHewan"
              required
              options={["Sehat", "Sakit (Gelisah, Takut Air)", "Mati", "Hilang", "Dibunuh Warga", "Diamankan"]}
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormInput
              label="Asal Hewan"
              k="asalHewan"
              placeholder="Milik sendiri / tetangga / liar / pasar hewan"
              options={["Milik Sendiri", "Milik Tetangga", "Liar", "Pasar Hewan", "Hibah / Adopsi", "Tidak Diketahui"]}
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <FormInput
              label="Pakan"
              k="pakan"
              placeholder="Nasi sisa, daging, pelet..."
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormInput
              label="Biosekuriti Kandang"
              k="biosekuriti"
              options={["Baik", "Cukup", "Buruk", "Tidak Ada Kandang"]}
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <FormInput
              label="Sumber Air"
              k="sumberAir"
              placeholder="Sumur, PDAM, sungai..."
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-5 bg-slate-50/80">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
              <Users size={15} className="text-blue-600" /> Data Pemilik HPR
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormInput
                label="Nama Pemilik"
                k="pemilikHewan"
                placeholder="Jika ada pemilik"
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
              <FormInput
                label="Alamat Pemilik"
                k="alamatPemilik"
                placeholder="Desa/Kec"
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
              <FormInput
                label="Kontak Pemilik"
                k="kontakPemilik"
                placeholder="HP/WA"
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <FormInput
                label="Riwayat Vaksinasi Rabies"
                k="riwayatVaksin"
                required
                options={["Ya", "Tidak", "Tidak Tahu"]}
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
              {formData.riwayatVaksin === "Ya" && (
                <FormInput
                  label="Tanggal Vaksin Terakhir"
                  k="tanggalVaksin"
                  type="date"
                  required
                  formData={formData}
                  errors={errors}
                  updateField={updateField}
                  showAsterisk={showAsterisk}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
              <User size={15} className="text-blue-600" /> Identitas Korban Gigitan
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <FormInput
                  label="Nama Korban"
                  k="namaKorban"
                  placeholder="Nama lengkap korban"
                  required
                  formData={formData}
                  errors={errors}
                  updateField={updateField}
                  showAsterisk={showAsterisk}
                />
              </div>
              <FormInput
                label="Umur Korban"
                k="umurKorban"
                type="number"
                placeholder="Tahun"
                required
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-5">
              <div className="md:col-span-2">
                <FormInput
                  label="Alamat Korban"
                  k="alamatKorban"
                  placeholder="Dusun, RT/RW, Desa"
                  required
                  formData={formData}
                  errors={errors}
                  updateField={updateField}
                  showAsterisk={showAsterisk}
                />
              </div>
              <FormInput
                label="No. HP / WhatsApp Korban"
                k="noHpKorban"
                type="tel"
                placeholder="081234567890"
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
              <FormInput
                label="Jenis Kelamin Korban"
                k="jkKorban"
                required
                options={["Laki-laki", "Perempuan"]}
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <FormInput
                label="Kondisi Umum Korban"
                k="kondisiKorban"
                placeholder="Sehat, demam, lemah..."
                options={["Sehat", "Demam", "Lemas", "Gelisah", "Takut Air/Cahaya", "Lainnya"]}
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormInput
              label="Pertolongan Pertama Dilakukan?"
              k="pertolonganPertama"
              options={["Ya", "Tidak"]}
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <FormInput
              label="Kondisi Luka"
              k="kondisiLuka"
              required
              options={[
                "Kategori 1",
                "Kategori 2",
                "Kategori 3",
                "Kategori 4"
              ]}
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormInput
              label="Detail Pertolongan Pertama"
              k="detailPertolongan"
              placeholder="Cuci sabun 15 menit, povidone iodine..."
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <FormInput
              label="Lokasi Luka"
              k="lokasiLuka"
              placeholder="Tangan kanan, kaki kiri, wajah..."
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
          </div>

          <div className="grid grid-cols-1 gap-5">
            <FormInput
              label="Tindakan terhadap HPR"
              k="tindakanHPR"
              type="textarea"
              required
              placeholder="Observasi 14 hari, dikarantina, euthanasia, pengambilan sampel otak untuk lab..."
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <FormInput
              label="Tindakan terhadap Kasus (Korban)"
              k="tindakanKasus"
              type="textarea"
              required
              placeholder="Rujuk ke RS, pemberian VAR/SAR, cuci luka, edukasi..."
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
            <FormInput
              label="Tindakan terhadap Masyarakat Sekitar"
              k="tindakanMasyarakat"
              type="textarea"
              placeholder="Sosialisasi, vaksinasi massal, sweeping HPR liar..."
              formData={formData}
              errors={errors}
              updateField={updateField}
              showAsterisk={showAsterisk}
            />
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="space-y-6">
          {/* BANNER STATUS GOOGLE SHEETS & ENDPOINT (KHUSUS MODE ADMIN) */}
          {isAdminMode && (
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-teal-50/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                  <Database size={15} className="text-emerald-600" />
                  Target Spreadsheet Google Sheets (Surveilans PE GHPR)
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Siap Rekam Baris Baru
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap pt-1 text-xs">
                <div className="text-slate-700">
                  ID Dokumen: <b className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-800">1jRDFTZWEFTlNSVSP73LI_JGRrRlWyWsXeKrgEiAsBrg</b>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://docs.google.com/spreadsheets/d/1jRDFTZWEFTlNSVSP73LI_JGRrRlWyWsXeKrgEiAsBrg/edit"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition"
                  >
                    <FileSpreadsheet size={14} /> Buka Google Sheets <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          )}

          <FormInput
            label="Rekomendasi / Tindak Lanjut"
            k="rekomendasi"
            type="textarea"
            required
            placeholder="Rekomendasi vaksinasi massal, KIE, pemantauan, koordinasi lintas sektor..."
            formData={formData}
            errors={errors}
            updateField={updateField}
            showAsterisk={showAsterisk}
          />

          <FormInput
            label="Sumber Laporan"
            k="sumberLaporan"
            placeholder="Nama pelapor, instansi, RSUD Mardi Waluyo, kontak"
            options={[
              "RSUD Mardi Waluyo",
              "RSUD Ngudi Waluyo Wlingi",
              "Puskesmas Sananwetan",
              "Puskesmas",
              "Perangkat Desa",
              "RSUD",
              "Warga",
              "Bhabinsa/Bhabinkamtibmas",
              "Lainnya"
            ]}
            formData={formData}
            errors={errors}
            updateField={updateField}
            showAsterisk={showAsterisk}
          />

          {/* Foto Dokumentasi Lapangan (Opsional / Tidak Wajib) */}
          <div className="rounded-xl border border-slate-200 p-5 bg-white space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800 flex items-center gap-2">
                  <Camera size={16} className="text-blue-600" /> Foto Dokumentasi (Opsional / Tidak Wajib)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Lampirkan foto lokasi kejadian, hewan penular rabies, atau luka gigitan jika ada.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Tidak Wajib
              </span>
            </div>

            {formData.fotoDokumentasi ? (
              <div className="relative inline-block border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-2">
                <img
                  src={formData.fotoDokumentasi}
                  alt="Foto Dokumentasi Lapangan"
                  className="max-h-48 rounded object-contain border border-slate-200 bg-white"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateField("fotoDokumentasi", "")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-100 transition"
                  >
                    <Trash2 size={14} /> Hapus Foto
                  </button>
                  <span className="text-[11px] text-emerald-600 font-medium">✓ Foto terlampir</span>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-4 text-center transition bg-slate-50/50">
                <input
                  type="file"
                  accept="image/*"
                  id="foto-dokumentasi-input"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        if (evt.target?.result) {
                          updateField("fotoDokumentasi", evt.target.result as string);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <label
                  htmlFor="foto-dokumentasi-input"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-sm cursor-pointer transition"
                >
                  <Upload size={15} className="text-blue-600" /> Pilih / Ambil Foto Dokumentasi
                </label>
                <p className="text-[10.5px] text-slate-400 mt-2">
                  Format gambar PNG, JPG, JPEG (Opsional, tidak wajib diisi)
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-5 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-4">
              Tim Penyelidik
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormInput
                label="Ketua Tim"
                k="timKetua"
                required
                placeholder="Drh. Nama Ketua"
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
              <FormInput
                label="Tanggal Pelaksanaan Penyelidikan"
                k="tanggalPelaksanaan"
                type="date"
                required
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
            </div>
            <div className="mt-5">
              <FormInput
                label="Anggota Tim (pisahkan dengan koma atau baris baru)"
                k="timAnggota"
                type="textarea"
                placeholder="Drh. A - Petugas Paramedik, S. Farm - Puskesmas, Perangkat Desa..."
                formData={formData}
                errors={errors}
                updateField={updateField}
                showAsterisk={showAsterisk}
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#0F172A] text-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                <FileText size={15} className="text-blue-400" /> Pelaksana / Penanggung Jawab Form
              </h4>
              {activeUser && (
                <span className="text-[11px] font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <UserCheck size={12} className="text-emerald-400" /> Petugas Aktif: {activeUser.nama}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <span>Nama Pelaksana</span>
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 flex items-center gap-1">
                    <Lock size={10} /> Terverifikasi
                  </span>
                </div>
                <div className="relative">
                  <input
                    value={currentPelaksanaNama}
                    readOnly
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 pr-9 text-sm text-emerald-300 font-semibold cursor-not-allowed outline-none shadow-inner"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock size={14} />
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-400">Penanggung Jawab Form: {currentPelaksanaNama}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <span>NIP / NIK Pelaksana</span>
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 flex items-center gap-1">
                    <Lock size={10} /> Terverifikasi
                  </span>
                </div>
                <div className="relative">
                  <input
                    value={currentPelaksanaNIP}
                    readOnly
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 pr-9 text-sm text-emerald-300 font-semibold cursor-not-allowed outline-none shadow-inner"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock size={14} />
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-400">NIP Resmi: {currentPelaksanaNIP}</p>
              </div>
            </div>

            <SignaturePad formData={formData} updateField={updateField} />
          </div>
        </div>
      )}
    </div>
  );
};
