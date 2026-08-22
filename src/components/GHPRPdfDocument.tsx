import React, { useEffect, useState, useRef } from "react";
import { FormGHPRData } from "../types";
import { OFFICIAL_SIGNATURE_STAMP_URL, DEFAULT_PELAKSANA_NAMA, DEFAULT_PELAKSANA_NIP } from "./SignatureData";
import { estimateFormContentHeight, measureFormElements, FormMeasurementResult } from "../lib/pdfMeasurement";

interface GHPRPdfDocumentProps {
  formData: FormGHPRData;
  getFinalKelurahan: () => string;
  getFinalKecamatan: () => string;
  getFinalKabKota: () => string;
  onMeasurementChange?: (measurement: FormMeasurementResult) => void;
}

export function formatDateIndonesian(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export const GHPRPdfDocument: React.FC<GHPRPdfDocumentProps> = ({
  formData,
  getFinalKelurahan,
  getFinalKecamatan,
  getFinalKabKota,
  onMeasurementChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measurement, setMeasurement] = useState<FormMeasurementResult>(() =>
    estimateFormContentHeight(formData)
  );

  const finalKel = getFinalKelurahan() || formData.kelurahan || "-";
  const finalKec = getFinalKecamatan() || formData.kecamatan || "-";
  const finalKab = getFinalKabKota() || formData.kabupatenKota || "-";
  const finalSpesies =
    formData.spesiesHPR === "Lainnya"
      ? formData.spesiesLain || "Lainnya"
      : formData.spesiesHPR || "-";

  // Split timAnggota if contains line breaks or commas
  const timAnggotaList = (formData.timAnggota || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Re-measure DOM elements when formData or props change
  useEffect(() => {
    const runMeasure = () => {
      if (containerRef.current) {
        const domResult = measureFormElements(containerRef.current);
        setMeasurement(domResult);
        if (onMeasurementChange) {
          onMeasurementChange(domResult);
        }
      } else {
        const estResult = estimateFormContentHeight(formData);
        setMeasurement(estResult);
        if (onMeasurementChange) {
          onMeasurementChange(estResult);
        }
      }
    };

    runMeasure();
    const timer = setTimeout(runMeasure, 150);
    return () => clearTimeout(timer);
  }, [formData, finalKel, finalKec, finalKab, onMeasurementChange]);

  // Tentukan apakah class 'page-break-before: always' perlu dimasukkan ke pembungkus Langkah 3 atau 4
  const isOver1000px = measurement.totalHeight > 1000;
  const shouldBreakStep3 = isOver1000px && (measurement.targetSplitStep === 3 || !measurement.targetSplitStep);
  const shouldBreakStep4 = isOver1000px && measurement.targetSplitStep === 4;

  return (
    <div
      ref={containerRef}
      id="ghpr-print-area"
      className="w-full max-w-[215.9mm] mx-auto text-[11px] leading-tight text-black font-sans print:p-0 print:m-0 print:max-w-none"
      style={{ fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif" }}
    >
      {/* ========================================================================= */}
      {/* LEMBAR 1: HEADER, WAKTU/TEMPAT, & HEWAN PENULAR RABIES (HPR)              */}
      {/* ========================================================================= */}
      <div
        id="ghpr-sheet-1"
        className="ghpr-page-sheet bg-white p-4 sm:p-6 md:p-8 rounded-sm shadow-xl print:shadow-none mb-6 print:mb-0 print:p-0"
      >
        {/* Document Header Title */}
        <div className="text-center font-bold mb-2 uppercase text-xs sm:text-sm tracking-wide">
          <div>FORM PENYELIDIKAN EPIDEMIOLOGI</div>
          <div>GIGITAN HEWAN PENULAR RABIES (GHPR)</div>
        </div>

        <div className="flex justify-between items-center mb-2 font-semibold text-[11px]">
          <div>
            Nama kasus: <span className="font-bold underline uppercase">{formData.namaKorban || "-"}</span>
          </div>
        </div>

        {/* SECTION I: Waktu & Tempat Kejadian */}
        <div id="ghpr-step-wrapper-1" className="ghpr-step-wrapper mb-0">
          <table className="w-full border-collapse border border-black text-[10.5px] sm:text-[11px]">
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top w-[170px]" colSpan={2}>
                  I. Waktu dan Tempat Kejadian
                </td>
                <td className="p-0 align-top" colSpan={3}>
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top w-[150px]">a. Waktu Kejadian</td>
                        <td className="p-1 align-top">{formatDateIndonesian(formData.waktuKejadian)}</td>
                      </tr>
                      <tr>
                        <td className="p-1 align-top">b. Tempat Kejadian</td>
                        <td className="p-0 align-top">
                          <table className="w-full border-collapse">
                            <tbody>
                              <tr className="border-b border-black">
                                <td className="p-1 w-[130px]">Alamat lokasi kejadian</td>
                                <td className="p-1">{formData.alamatKejadian || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Kelurahan</td>
                                <td className="p-1">{finalKel}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Kecamatan</td>
                                <td className="p-1">{finalKec}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Kabupaten / kota</td>
                                <td className="p-1">{finalKab}</td>
                              </tr>
                              <tr>
                                <td className="p-1">Provinsi</td>
                                <td className="p-1">{formData.provinsi || "Jawa Timur"}</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION II - a, b, c: Ringkasan & Hewan Penular Rabies */}
        <div id="ghpr-step-wrapper-2" className="ghpr-step-wrapper -mt-[1px]">
          <table className="w-full border-collapse border border-black text-[10.5px] sm:text-[11px]">
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top w-[170px]" colSpan={2}>
                  II. Ringkasan Kejadian
                </td>
                <td className="p-0 align-top" colSpan={3}>
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top w-[150px]">a. Sumber Informasi</td>
                        <td className="p-1 align-top">{formData.sumberInfo || "-"}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top">b. Kronologi Kejadian</td>
                        <td className="p-1 align-top whitespace-pre-wrap">{formData.kronologi || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-1 align-top">c. Hewan Penular Rabies</td>
                        <td className="p-0 align-top">
                          <table className="w-full border-collapse">
                            <tbody>
                              <tr className="border-b border-black">
                                <td className="p-1 w-[130px]">Spesies</td>
                                <td className="p-1" colSpan={3}>{finalSpesies}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Ras</td>
                                <td className="p-1" colSpan={3}>{formData.ras || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Jenis Kelamin</td>
                                <td className="p-1" colSpan={3}>{formData.jkHewan || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Umur</td>
                                <td className="p-1" colSpan={3}>
                                  {formData.umurHewan
                                    ? `${formData.umurHewan} ${formData.satuanUmur || "Bulan"}`
                                    : "-"}
                                </td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Metode Pemeliharaan</td>
                                <td className="p-1" colSpan={3}>{formData.metodePelihara || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Asal Hewan</td>
                                <td className="p-1" colSpan={3}>{formData.asalHewan || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Pakan</td>
                                <td className="p-1" colSpan={3}>{formData.pakan || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Biosekuriti</td>
                                <td className="p-1" colSpan={3}>{formData.biosekuriti || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Sumber Air</td>
                                <td className="p-1" colSpan={3}>{formData.sumberAir || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Kondisi Hewan</td>
                                <td className="p-1" colSpan={3}>{formData.kondisiHewan || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Pemilik Hewan</td>
                                <td className="p-1" colSpan={3}>{formData.pemilikHewan || "-"}</td>
                              </tr>
                              {/* Riwayat Vaksinasi Subtable */}
                              <tr className="border-b border-black">
                                <td className="p-1 align-top">Riwayat Vaksinasi</td>
                                <td className="p-0" colSpan={3}>
                                  <table className="w-full border-collapse text-center">
                                    <thead>
                                      <tr className="border-b border-black">
                                        <th className="border-r border-black p-0.5 w-[33%] font-normal">Ya</th>
                                        <th className="border-r border-black p-0.5 w-[33%] font-normal">Tidak</th>
                                        <th className="p-0.5 w-[34%] font-normal">Tanggal Vaksinasi</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="border-r border-black p-0.5 h-5">
                                          {formData.riwayatVaksin === "Ya" ? "V" : ""}
                                        </td>
                                        <td className="border-r border-black p-0.5 h-5">
                                          {formData.riwayatVaksin === "Tidak" ? "V" : ""}
                                        </td>
                                        <td className="p-0.5 h-5">
                                          {formData.riwayatVaksin === "Ya" && formData.tanggalVaksin
                                            ? formatDateIndonesian(formData.tanggalVaksin)
                                            : ""}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td className="p-1">Keterangan Lain</td>
                                <td className="p-1" colSpan={3}>-</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Lembar 1 */}
        <div className="mt-3 pt-1 border-t border-slate-300 text-[9.5px] text-slate-500 flex justify-between items-center print:text-black">
          <span>UPT Puskesmas Sananwetan Kota Blitar — Formulir Resmi Surveilans Epidemiologi GHPR</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEMBAR 2: KORBAN GIGITAN, TINDAKAN, REKOMENDASI, TIM, FOTO & TTD          */}
      {/* Memuat class & style page-break-before: always untuk cetak & unduh PDF    */}
      {/* ========================================================================= */}
      <div
        id="ghpr-sheet-2"
        className="ghpr-page-sheet ghpr-sheet-2 html2pdf__page-break page-break-before: always page-break-before-always page-break-before bg-white p-4 sm:p-6 md:p-8 rounded-sm shadow-xl print:shadow-none print:p-0"
        style={{ pageBreakBefore: "always", breakBefore: "page" }}
      >
        {/* SECTION II.d & SECTION VIII: Kasus Gigitan Korban & Tindakan Penanganan */}
        <div id="ghpr-step-wrapper-3" className="ghpr-step-wrapper mb-0">
          <table className="w-full border-collapse border border-black text-[10.5px] sm:text-[11px]">
            <tbody>
              {/* SECTION II.d - Kasus Gigitan Korban */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top w-[170px]" colSpan={2}>
                  II. Ringkasan Kejadian (d. Kasus Gigitan)
                </td>
                <td className="p-0 align-top" colSpan={3}>
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px]">
                    <tbody>
                      <tr>
                        <td className="p-1 align-top w-[150px]">d. Kasus Gigitan</td>
                        <td className="p-0 align-top">
                          <table className="w-full border-collapse">
                            <tbody>
                              <tr className="border-b border-black">
                                <td className="p-1 w-[130px]">Nama Korban</td>
                                <td className="p-1 font-semibold">{formData.namaKorban || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Umur</td>
                                <td className="p-1">
                                  {formData.umurKorban ? `${formData.umurKorban} Tahun` : "-"}
                                </td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Alamat Korban</td>
                                <td className="p-1">{formData.alamatKorban || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Jenis Kelamin</td>
                                <td className="p-1">{formData.jkKorban || "-"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Kondisi Korban</td>
                                <td className="p-1">{formData.kondisiKorban || "Sehat"}</td>
                              </tr>
                              <tr className="border-b border-black">
                                <td className="p-1">Pertolongan Pertama</td>
                                <td className="p-1">
                                  {formData.detailPertolongan || formData.pertolonganPertama || "-"}
                                </td>
                              </tr>
                              <tr>
                                <td className="p-1">Kondisi Luka Saat Ini</td>
                                <td className="p-1">{formData.kondisiLuka || "-"}</td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* SECTION VIII - Tindakan yang telah dilakukan */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top w-[170px]" colSpan={2}>
                  VIII. Tindakan yang telah dilakukan
                </td>
                <td className="p-0 align-top" colSpan={3}>
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top w-[150px]">a. Hewan Penular Rabies</td>
                        <td className="p-1 align-top">{formData.tindakanHPR || "-"}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top">b. Kasus Gigitan</td>
                        <td className="p-1 align-top">{formData.tindakanKasus || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-1 align-top">c. Masyarakat</td>
                        <td className="p-1 align-top">{formData.tindakanMasyarakat || "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION X, XI, XII, XIII: Rekomendasi, Tim, Dokumentasi & Tanda Tangan */}
        <div id="ghpr-step-wrapper-4" className="ghpr-step-wrapper -mt-[1px]">
          <table className="w-full border-collapse border border-black text-[10.5px] sm:text-[11px]">
            <tbody>
              {/* SECTION X - Rekomendasi */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top w-[170px]" colSpan={2}>
                  X. Rekomendasi Tindak Lanjut
                </td>
                <td className="p-1 align-top" colSpan={3}>
                  {formData.rekomendasi || "-"}
                </td>
              </tr>

              {/* SECTION XI - Keterangan Lain */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top w-[170px]" colSpan={2}>
                  XI. Keterangan Lain
                </td>
                <td className="p-1 align-top" colSpan={3}>
                  {formData.sumberLaporan || "-"}
                </td>
              </tr>

              {/* SECTION XII - Tim Pelaksana */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top w-[170px]" colSpan={2}>
                  XII. Tim Pelaksana
                </td>
                <td className="p-0 align-top" colSpan={3}>
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top w-[150px]">a. Ketua</td>
                        <td className="p-1 align-top font-medium">{formData.timKetua || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-1 align-top">b. Anggota</td>
                        <td className="p-1 align-top">
                          {timAnggotaList.length > 0 ? (
                            <div className="space-y-0.5">
                              {timAnggotaList.map((m, idx) => (
                                <div key={idx}>{m}</div>
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* SECTION XIII - Dokumentasi */}
              <tr>
                <td className="border-r border-black p-1 font-bold align-top w-[170px]" colSpan={2}>
                  XIII. Dokumentasi
                </td>
                <td className="p-1 align-top min-h-[45px]" colSpan={3}>
                  {formData.fotoDokumentasi ? (
                    <div className="flex items-center gap-3 py-1">
                      <img
                        src={formData.fotoDokumentasi}
                        alt="Foto Dokumentasi Lapangan"
                        crossOrigin="anonymous"
                        className="max-h-20 max-w-[180px] object-contain border border-black p-0.5 bg-white"
                      />
                      <div className="text-[10px] text-slate-700 italic">
                        Foto Dokumentasi Lapangan (Lampiran Kasus GHPR)
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-[10px] italic h-10 flex items-center">
                      (Lampirkan foto lokasi / hewan / luka bila ada)
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signature Section */}
          <div
            className="mt-3 flex justify-end text-[11px] avoid-break page-break-inside-avoid"
            style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
          >
            <div className="text-center w-[230px]">
              <div>Blitar, {formatDateIndonesian(formData.tanggalPelaksanaan)}</div>
              <div className="mt-0.5 font-semibold">Pelaksana,</div>

              {/* Dynamic Signature Area */}
              {(formData.tandaTanganUrl || OFFICIAL_SIGNATURE_STAMP_URL) ? (
                <div className="h-16 flex items-center justify-center my-0.5">
                  <img
                    src={formData.tandaTanganUrl || OFFICIAL_SIGNATURE_STAMP_URL}
                    alt="Tanda Tangan Pelaksana"
                    crossOrigin="anonymous"
                    className="max-h-16 max-w-[200px] object-contain"
                  />
                </div>
              ) : (formData.jenisTandaTangan === "otomatis" || formData.tandaTanganOtomatis !== false) ? (
                <div className="h-16 flex flex-col items-center justify-center my-0.5">
                  <div
                    className="text-xl text-slate-900 leading-none select-none font-normal py-1"
                    style={{ fontFamily: "'Caveat', 'Dancing Script', cursive" }}
                  >
                    {formData.pelaksanaNama || DEFAULT_PELAKSANA_NAMA}
                  </div>
                  <div className="text-[7.5px] text-blue-800 font-bold tracking-wider uppercase border border-blue-600/50 px-1.5 py-[1px] rounded bg-blue-50/60 leading-tight">
                    ✓ TTD Digital Terverifikasi
                  </div>
                </div>
              ) : (
                <div className="h-16" />
              )}

              <div>
                ( <b className="uppercase">{formData.pelaksanaNama || DEFAULT_PELAKSANA_NAMA}</b> )
              </div>
              <div>NIP. {formData.pelaksanaNIP || DEFAULT_PELAKSANA_NIP}</div>
            </div>
          </div>

          {/* Footer Lembar 2 */}
          <div className="mt-3 pt-1 border-t border-slate-300 text-[9.5px] text-slate-500 flex justify-between items-center print:text-black">
            <span>UPT Puskesmas Sananwetan Kota Blitar — Formulir Resmi Surveilans Epidemiologi GHPR</span>
          </div>
        </div>
      </div>
    </div>
  );
};
