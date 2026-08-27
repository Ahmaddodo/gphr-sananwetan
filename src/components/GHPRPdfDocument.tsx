import React, { useEffect, useState, useRef } from "react";
import { FormGHPRData } from "../types";
import { OFFICIAL_SIGNATURE_STAMP_URL, PUSKESMAS_LOGO_URL, DEFAULT_PELAKSANA_NAMA, DEFAULT_PELAKSANA_NIP, getOfficialSignatureUrl } from "./SignatureData";
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
        {/* Document Header Title with Puskesmas Logo */}
        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
          <div className="w-14 h-14 flex items-center justify-center shrink-0">
            <img
              src={PUSKESMAS_LOGO_URL}
              alt="Logo Puskesmas Sananwetan"
              className="max-h-14 max-w-14 object-contain"
            />
          </div>
          <div className="text-center font-bold uppercase tracking-wide flex-1 px-2">
            <div className="text-[10.5px] text-slate-800 tracking-wider">UPT PUSKESMAS SANANWETAN KOTA BLITAR</div>
            <div className="text-xs sm:text-sm font-black">FORM PENYELIDIKAN EPIDEMIOLOGI</div>
            <div className="text-xs sm:text-sm font-black text-emerald-800">GIGITAN HEWAN PENULAR RABIES (GHPR)</div>
          </div>
          <div className="w-14 h-14 flex items-center justify-center shrink-0">
            <img
              src={PUSKESMAS_LOGO_URL}
              alt="Logo Puskesmas"
              className="max-h-14 max-w-14 object-contain opacity-0"
            />
          </div>
        </div>

        <div className="flex justify-between items-center mb-1.5 font-semibold text-[11px]">
          <div>
            Nama kasus: <span className="font-bold underline uppercase">{formData.namaKorban || "-"}</span>
          </div>
        </div>

        {/* SECTION I: Waktu & Tempat Kejadian */}
        <div id="ghpr-step-wrapper-1" className="ghpr-step-wrapper mb-0">
          <table className="w-full border-collapse border border-black text-[10.5px] sm:text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "76%" }} />
            </colgroup>
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top">
                  I. Waktu dan Tempat Kejadian
                </td>
                <td className="p-0 align-top">
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px] table-fixed">
                    <colgroup>
                      <col style={{ width: "28%" }} />
                      <col style={{ width: "72%" }} />
                    </colgroup>
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top">a. Waktu Kejadian</td>
                        <td className="p-1 align-top">{formatDateIndonesian(formData.waktuKejadian)}</td>
                      </tr>
                      <tr>
                        <td className="p-1 align-top">b. Tempat Kejadian</td>
                        <td className="p-0 align-top">
                          <table className="w-full border-collapse table-fixed">
                            <colgroup>
                              <col style={{ width: "36%" }} />
                              <col style={{ width: "64%" }} />
                            </colgroup>
                            <tbody>
                              <tr className="border-b border-black">
                                <td className="p-1">Alamat lokasi kejadian</td>
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
                                <td className="p-1">{formData.provinsi || "-"}</td>
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
          <table className="w-full border-collapse border border-black text-[10.5px] sm:text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "76%" }} />
            </colgroup>
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top">
                  II. Ringkasan Kejadian
                </td>
                <td className="p-0 align-top">
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px] table-fixed">
                    <colgroup>
                      <col style={{ width: "28%" }} />
                      <col style={{ width: "72%" }} />
                    </colgroup>
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top">a. Sumber Informasi</td>
                        <td className="p-1 align-top">{formData.sumberInfo || "-"}</td>
                      </tr>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top">b. Kronologi Kejadian</td>
                        <td className="p-1 align-top whitespace-pre-wrap">{formData.kronologi || "-"}</td>
                      </tr>
                      <tr>
                        <td className="p-1 align-top">c. Hewan Penular Rabies</td>
                        <td className="p-0 align-top">
                          <table className="w-full border-collapse table-fixed">
                            <colgroup>
                              <col style={{ width: "36%" }} />
                              <col style={{ width: "64%" }} />
                            </colgroup>
                            <tbody>
                              <tr className="border-b border-black">
                                <td className="p-1">Spesies</td>
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

        {/* SECTION II.d & SECTION VIII: Kasus Gigitan Korban & Tindakan Penanganan */}
        <div id="ghpr-step-wrapper-3" className="ghpr-step-wrapper -mt-[1px]">
          <table className="w-full border-collapse border border-black text-[10.5px] sm:text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "76%" }} />
            </colgroup>
            <tbody>
              {/* SECTION II.d - Kasus Gigitan Korban */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top">
                  II. Ringkasan Kejadian (d. Kasus Gigitan)
                </td>
                <td className="p-0 align-top">
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px] table-fixed">
                    <colgroup>
                      <col style={{ width: "28%" }} />
                      <col style={{ width: "72%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="p-1 align-top">d. Kasus Gigitan</td>
                        <td className="p-0 align-top">
                          <table className="w-full border-collapse table-fixed">
                            <colgroup>
                              <col style={{ width: "36%" }} />
                              <col style={{ width: "64%" }} />
                            </colgroup>
                            <tbody>
                              <tr className="border-b border-black">
                                <td className="p-1">Nama Korban</td>
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
                                <td className="p-1">{formData.kondisiKorban || "-"}</td>
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
                <td className="border-r border-black p-1 font-bold align-top">
                  VIII. Tindakan yang telah dilakukan
                </td>
                <td className="p-0 align-top">
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px] table-fixed">
                    <colgroup>
                      <col style={{ width: "28%" }} />
                      <col style={{ width: "72%" }} />
                    </colgroup>
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top">a. Hewan Penular Rabies</td>
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

        {/* Footer Lembar 1 (Tinggi 2.5 cm) */}
        <div
          className="ghpr-footer mt-4 pt-1.5 border-t border-slate-300 text-[10px] text-slate-600 flex justify-between items-center print:text-black"
          style={{ height: "2.5cm", minHeight: "2.5cm", maxHeight: "2.5cm", boxSizing: "border-box" }}
        >
          <span>UPT Puskesmas Sananwetan Kota Blitar — Formulir Resmi Surveilans Epidemiologi GHPR</span>
          <span className="font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300 print:border-black print:bg-transparent">
            Halaman 1 dari 2
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LEMBAR 2: REKOMENDASI, TIM, DOKUMENTASI (TINGGI 500PX), & TANDA TANGAN     */}
      {/* Memuat class & style page-break-before: always untuk cetak & unduh PDF    */}
      {/* ========================================================================= */}
      <div
        id="ghpr-sheet-2"
        className="ghpr-page-sheet ghpr-sheet-2 html2pdf__page-break page-break-before: always page-break-before-always page-break-before bg-white p-4 sm:p-6 md:p-8 rounded-sm shadow-xl print:shadow-none print:p-0"
        style={{ pageBreakBefore: "always", breakBefore: "page" }}
      >
        {/* Header Lembar 2 Lanjutan */}
        <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2">
          <div className="flex items-center gap-2">
            <img src={PUSKESMAS_LOGO_URL} alt="Logo" className="w-8 h-8 object-contain" />
            <div>
              <div className="font-bold text-[10px] sm:text-[10.5px] uppercase tracking-wide">UPT PUSKESMAS SANANWETAN KOTA BLITAR</div>
              <div className="text-[9px] sm:text-[9.5px] text-slate-700 font-medium">Form Penyelidikan Epidemiologi GHPR — Lembar 2 (Lanjutan)</div>
            </div>
          </div>
          <div className="text-right text-[10px] sm:text-[10.5px]">
            Nama Kasus: <span className="font-bold underline uppercase">{formData.namaKorban || "-"}</span>
          </div>
        </div>

        {/* SECTION X, XI, XII, XIII: Rekomendasi, Tim, Dokumentasi & Tanda Tangan */}
        <div id="ghpr-step-wrapper-4" className="ghpr-step-wrapper mb-0">
          <table className="w-full border-collapse border border-black text-[10.5px] sm:text-[11px] table-fixed">
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "76%" }} />
            </colgroup>
            <tbody>
              {/* SECTION X - Rekomendasi */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top">
                  X. Rekomendasi Tindak Lanjut
                </td>
                <td className="p-1 align-top">
                  {formData.rekomendasi || "-"}
                </td>
              </tr>

              {/* SECTION XI - Keterangan Lain */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top">
                  XI. Keterangan Lain
                </td>
                <td className="p-1 align-top">
                  {formData.sumberLaporan || "-"}
                </td>
              </tr>

              {/* SECTION XII - Tim Pelaksana */}
              <tr className="border-b border-black">
                <td className="border-r border-black p-1 font-bold align-top">
                  XII. Tim Pelaksana
                </td>
                <td className="p-0 align-top">
                  <table className="w-full border-collapse text-[10.5px] sm:text-[11px] table-fixed">
                    <colgroup>
                      <col style={{ width: "28%" }} />
                      <col style={{ width: "72%" }} />
                    </colgroup>
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="p-1 align-top">a. Ketua</td>
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

              {/* SECTION XIII - Dokumentasi Foto (Tinggi 500px, Lebar Proporsional) */}
              <tr>
                <td className="border-r border-black p-1 font-bold align-top">
                  XIII. Dokumentasi
                </td>
                <td className="p-2 align-top">
                  {formData.fotoDokumentasi ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                      <img
                        src={formData.fotoDokumentasi}
                        alt="Foto Dokumentasi Lapangan"
                        crossOrigin="anonymous"
                        className="h-[500px] max-h-[500px] w-auto max-w-full object-contain border border-black p-1 bg-white shadow-sm"
                        style={{ height: "500px", maxHeight: "500px", width: "auto", objectFit: "contain" }}
                      />
                      <div className="text-[10px] text-slate-700 italic font-medium">
                        Foto Dokumentasi Lapangan (Lampiran Kasus GHPR)
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-[10px] italic h-16 flex items-center justify-center border border-dashed border-slate-300 rounded p-2">
                      (Lampirkan foto lokasi / hewan / luka bila ada)
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signature Section */}
          <div
            className="mt-4 flex justify-end text-[11px] avoid-break page-break-inside-avoid"
            style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
          >
            <div className="text-center w-[240px]">
              <div>Blitar, {formatDateIndonesian(formData.tanggalPelaksanaan)}</div>
              <div className="mt-0.5 font-semibold">Pelaksana,</div>

              {/* Dynamic Signature Area - Pure White Background */}
              <div className="h-24 flex items-center justify-center my-1 bg-white">
                <img
                  src={getOfficialSignatureUrl(formData.tandaTanganUrl)}
                  alt="Tanda Tangan & Stempel Resmi Pelaksana"
                  className="max-h-24 max-w-[220px] object-contain bg-white"
                />
              </div>

              <div>
                ( <b className="uppercase">{formData.pelaksanaNama || "-"}</b> )
              </div>
              <div>NIP. {formData.pelaksanaNIP || "-"}</div>
            </div>
          </div>

          {/* Footer Lembar 2 (Tinggi 2.5 cm) */}
          <div
            className="ghpr-footer mt-4 pt-1.5 border-t border-slate-300 text-[10px] text-slate-600 flex justify-between items-center print:text-black"
            style={{ height: "2.5cm", minHeight: "2.5cm", maxHeight: "2.5cm", boxSizing: "border-box" }}
          >
            <span>UPT Puskesmas Sananwetan Kota Blitar — Formulir Resmi Surveilans Epidemiologi GHPR</span>
            <span className="font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300 print:border-black print:bg-transparent">
              Halaman 2 dari 2
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
