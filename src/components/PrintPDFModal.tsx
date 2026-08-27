import React, { useState, useEffect } from "react";
import { Printer, X, Download, FileText, Sparkles, Loader2, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { FormGHPRData } from "../types";
import { GHPRPdfDocument } from "./GHPRPdfDocument";
import { OFFICIAL_SIGNATURE_STAMP_URL, DEFAULT_PELAKSANA_NAMA, DEFAULT_PELAKSANA_NIP, getOfficialSignatureUrl } from "./SignatureData";
import {
  measureFormElements,
  estimateFormContentHeight,
  FormMeasurementResult
} from "../lib/pdfMeasurement";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

interface PrintPDFModalProps {
  showPdfModal: boolean;
  setShowPdfModal: (val: boolean) => void;
  formData: FormGHPRData;
  setFormData: React.Dispatch<React.SetStateAction<FormGHPRData>>;
  getFinalKelurahan: () => string;
  getFinalKecamatan: () => string;
  getFinalKabKota: () => string;
}

export const samplePdfData: FormGHPRData = {
  waktuKejadian: "2026-06-20",
  alamatKejadian: "Desa Ponggok di rumah Nenek",
  kelurahan: "Ponggok",
  kelurahanCustom: "",
  kecamatan: "Ponggok",
  kecamatanCustom: "",
  kabupatenKota: "Kab Blitar",
  kabupatenKotaCustom: "",
  provinsi: "Jawa Timur",
  sumberInfo: "Orang tua Jerolin AW",
  kronologi: "Saat bermain Dengan kucing digigit",
  spesiesHPR: "Kucing",
  spesiesLain: "",
  ras: "Lokal",
  jkHewan: "Jantan",
  umurHewan: "9",
  satuanUmur: "Bulan",
  metodePelihara: "di lepas liar",
  asalHewan: "rumah nenek",
  pakan: "Nasi Pindang",
  biosekuriti: "-",
  sumberAir: "Sumur",
  kondisiHewan: "Sehat",
  pemilikHewan: "Nenek",
  alamatPemilik: "Desa Ponggok",
  kontakPemilik: "-",
  riwayatVaksin: "Ya",
  tanggalVaksin: "",
  namaKorban: "Jerolin Athariz Wija",
  umurKorban: "9",
  noHpKorban: "081234567890",
  alamatKorban: "Jl Pemuda Sumpono rt 3 rw 3 Gedog",
  jkKorban: "Laki Laki",
  kondisiKorban: "Sehat",
  pertolonganPertama: "cuci luka dan var",
  detailPertolongan: "cuci luka dan var",
  kondisiLuka: "Kategori 2",
  lokasiLuka: "Tangan",
  tindakanHPR: "Dikandangkan dan isolasi 14 hari untu k pemantauan kesehatn",
  tindakanKasus: "Cuci luka dan var 1 var 2",
  tindakanMasyarakat: "-",
  rekomendasi:
    "Selama pemantauan terhadap hpr kucing Tampak sehat, Kasus gigitan : tidak ada keluhan, sehingga untuk pemberian var 3 tidak diperlukan",
  sumberLaporan: "Sumber laporan dari rs mardi waluyo",
  timKetua: "",
  timAnggota: "Widodo Suprianto\nTitik Mustikasari\nIndhah Kusumastuti\nNunung Ambarwati",
  tanggalPelaksanaan: "2026-07-05",
  pelaksanaNama: DEFAULT_PELAKSANA_NAMA,
  pelaksanaNIP: DEFAULT_PELAKSANA_NIP,
  tandaTanganUrl: OFFICIAL_SIGNATURE_STAMP_URL,
  tandaTanganOtomatis: false,
  jenisTandaTangan: "gambar"
};

/**
 * Render elemen lembar dokumen ke dalam Canvas resolusi tinggi.
 * Mengambil tampilan asli dari DOM pratinjau yang sedang dilihat pengguna
 * sehingga hasil tangkapan 100% identik dan persis dengan yang direview.
 */
async function captureCleanDocumentSheet(sourceElement: HTMLElement, targetWidthPx: number = 816): Promise<HTMLCanvasElement> {
  // Pastikan seluruh gambar (stempel, tanda tangan, foto dokumentasi) telah termuat
  const imgs = Array.from(sourceElement.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalHeight !== 0) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 1500);
          }
        })
    )
  );

  // Capture canvas langsung dari elemen tampilan asli dengan kualitas tinggi (2.5x)
  const canvas = await html2canvas(sourceElement, {
    scale: 2.5,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    scrollX: 0,
    scrollY: 0,
  });

  return canvas;
}

export const PrintPDFModal: React.FC<PrintPDFModalProps> = ({
  showPdfModal,
  setShowPdfModal,
  formData,
  setFormData,
  getFinalKelurahan,
  getFinalKecamatan,
  getFinalKabKota,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [paperSize, setPaperSize] = useState<"legal" | "f4" | "a4">("legal");
  const [measurement, setMeasurement] = useState<FormMeasurementResult>(() =>
    estimateFormContentHeight(formData)
  );

  useEffect(() => {
    if (showPdfModal) {
      const timer = setTimeout(() => {
        const el = document.getElementById("ghpr-print-area");
        if (el) {
          const res = measureFormElements(el);
          setMeasurement(res);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showPdfModal, formData]);

  if (!showPdfModal) return null;

  /**
   * Pemicu Dialog Cetak & Pratinjau Cetak Browser Handal
   * Membuka dokumen dalam jendela / tab cetak mandiri dengan resolusi tinggi & CSS print presisi
   */
  const handlePrint = () => {
    try {
      const printArea = document.getElementById("ghpr-print-area");
      if (!printArea) {
        window.print();
        return;
      }

      const pageSizeCss =
        paperSize === "a4"
          ? "A4 portrait"
          : paperSize === "f4"
          ? "215mm 330mm portrait"
          : "215.9mm 355.6mm portrait";

      const victimName = formData.namaKorban ? formData.namaKorban.trim() : "Laporan";

      // Kumpulkan styles
      const styleNodes = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"));
      let stylesHtml = "";
      styleNodes.forEach((node) => {
        stylesHtml += node.outerHTML;
      });

      const printHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Form PE GHPR - ${victimName}</title>
  ${stylesHtml}
  <style>
    @page {
      size: ${pageSizeCss};
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box;
    }
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif !important;
    }
    .print-bar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 9999;
      font-family: system-ui, sans-serif;
    }
    .print-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: 0.2s;
    }
    .print-btn:hover {
      background: #1d4ed8;
    }
    .close-btn {
      background: #475569;
      color: #ffffff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      margin-left: 8px;
    }
    .ghpr-page-sheet {
      box-shadow: none !important;
      border: none !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      max-width: 215.9mm !important;
    }
    .ghpr-sheet-2, #ghpr-sheet-2 {
      page-break-before: always !important;
      break-before: page !important;
    }
    .ghpr-footer {
      height: 2.5cm !important;
      min-height: 2.5cm !important;
      max-height: 2.5cm !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      box-sizing: border-box !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    td, th {
      border: 1px solid #000000 !important;
    }
    @media print {
      .print-bar {
        display: none !important;
      }
      body {
        padding: 0 !important;
      }
      .ghpr-page-sheet {
        padding: 0 !important;
        max-width: none !important;
      }
      .ghpr-sheet-2, #ghpr-sheet-2 {
        page-break-before: always !important;
        break-before: page !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div>
      <strong>Mode Cetak: Formulir PE GHPR (${victimName})</strong>
      <span style="opacity: 0.8; font-size: 12px; margin-left: 10px;">Ukuran: ${paperSize.toUpperCase()}</span>
    </div>
    <div>
      <button class="print-btn" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
      <button class="close-btn" onclick="window.close()">✕ Tutup</button>
    </div>
  </div>
  <div style="padding: 20px 0; background: #f8fafc; min-height: 100vh;" class="print:p-0 print:bg-white">
    <div style="max-width: 215.9mm; margin: 0 auto; background: #ffffff; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);" class="print:p-0 print:shadow-none">
      ${printArea.innerHTML}
    </div>
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.print();
        } catch(e) {
          console.log(e);
        }
      }, 500);
    });
  </script>
</body>
</html>`;

      const blob = new Blob([printHtml], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, "_blank");

      if (!printWindow) {
        // Jika pop-up diblokir, buat iframe tersembunyi sebagai fallback otomatis
        const iframeId = "ghpr-print-iframe";
        let oldIframe = document.getElementById(iframeId);
        if (oldIframe) {
          document.body.removeChild(oldIframe);
        }
        const iframe = document.createElement("iframe");
        iframe.id = iframeId;
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            window.print();
          }
        }, 500);
      }
    } catch (e) {
      console.error("Window print error:", e);
      window.print();
    }
  };

  /**
   * Unduh Dokumen PDF Resmi Proporsional & Presisi
   */
  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    setDownloadSuccess(false);

    try {
      const rootArea = document.getElementById("ghpr-print-area");
      const sheet1 = document.getElementById("ghpr-sheet-1");
      const sheet2 = document.getElementById("ghpr-sheet-2");

      const targetElement = rootArea || sheet1;
      if (!targetElement) {
        throw new Error("Elemen formulir tidak ditemukan");
      }

      // Konfigurasi ukuran kertas jsPDF (dalam satuan mm)
      let pdfFormat: [number, number] | "a4" | "legal" = "legal";
      let pageWidthMm = 215.9;
      let pageHeightMm = 355.6;

      if (paperSize === "a4") {
        pdfFormat = "a4";
        pageWidthMm = 210;
        pageHeightMm = 297;
      } else if (paperSize === "f4") {
        pdfFormat = [215, 330];
        pageWidthMm = 215;
        pageHeightMm = 330;
      } else {
        pdfFormat = "legal";
        pageWidthMm = 215.9;
        pageHeightMm = 355.6;
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: pdfFormat,
        compress: true,
      });

      const marginMm = 8;
      const renderWidthMm = pageWidthMm - marginMm * 2;
      const maxPageContentHeightMm = pageHeightMm - marginMm * 2;

      if (sheet1 && sheet2) {
        // Render Lembar 1 pada Halaman 1
        const canvas1 = await captureCleanDocumentSheet(sheet1);
        const imgData1 = canvas1.toDataURL("image/jpeg", 0.98);
        const contentHeightMm1 = (canvas1.height * renderWidthMm) / canvas1.width;
        pdf.addImage(
          imgData1,
          "JPEG",
          marginMm,
          marginMm,
          renderWidthMm,
          Math.min(contentHeightMm1, maxPageContentHeightMm),
          undefined,
          "FAST"
        );

        // Render Lembar 2 pada Halaman 2 (dengan foto tinggi 500px dan ttd resmi)
        pdf.addPage(pdfFormat, "portrait");
        const canvas2 = await captureCleanDocumentSheet(sheet2);
        const imgData2 = canvas2.toDataURL("image/jpeg", 0.98);
        const contentHeightMm2 = (canvas2.height * renderWidthMm) / canvas2.width;
        pdf.addImage(
          imgData2,
          "JPEG",
          marginMm,
          marginMm,
          renderWidthMm,
          Math.min(contentHeightMm2, maxPageContentHeightMm),
          undefined,
          "FAST"
        );
      } else if (targetElement) {
        const canvas = await captureCleanDocumentSheet(targetElement);
        const totalContentHeightMm = (canvas.height * renderWidthMm) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 0.98);
        pdf.addImage(
          imgData,
          "JPEG",
          marginMm,
          marginMm,
          renderWidthMm,
          Math.min(totalContentHeightMm, maxPageContentHeightMm),
          undefined,
          "FAST"
        );
      }

      const cleanName = formData.namaKorban
        ? formData.namaKorban.trim().replace(/[^a-zA-Z0-9]/g, "_")
        : "Laporan";

      pdf.save(`Form_PE_GHPR_${cleanName}.pdf`);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error("Gagal membuat PDF otomatis:", err);
      handlePrint();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadSample = () => {
    setFormData({
      ...samplePdfData,
      tandaTanganUrl: getOfficialSignatureUrl(samplePdfData.tandaTanganUrl)
    });
  };

  return (
    <div
      id="ghpr-modal-overlay"
      className="fixed inset-0 z-[100] flex flex-col bg-slate-900/80 backdrop-blur-sm overflow-hidden print:bg-white print:p-0 print:m-0 print:static print:block"
    >
      {/* Modal Top Bar (Hidden on print) */}
      <div
        id="ghpr-modal-header"
        className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shrink-0 shadow-xs">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase">
              Pratinjau Cetak & Unduh PDF Resmi
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Dokumen Formulir Penyelidikan Epidemiologi GHPR (UPT Puskesmas Sananwetan)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Pilihan Ukuran Kertas */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
            <span className="text-slate-400 px-2 flex items-center gap-1 text-[11px] font-medium hidden md:inline-flex">
              <Layers size={12} /> Kertas:
            </span>
            <button
              type="button"
              onClick={() => setPaperSize("legal")}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                paperSize === "legal"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
              title="Kertas Legal (8.5 x 14 in / 215.9 x 355.6 mm)"
            >
              Legal
            </button>
            <button
              type="button"
              onClick={() => setPaperSize("f4")}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                paperSize === "f4"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
              title="Kertas F4 / Folio (215 x 330 mm)"
            >
              F4 / Folio
            </button>
            <button
              type="button"
              onClick={() => setPaperSize("a4")}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                paperSize === "a4"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
              title="Kertas A4 (210 x 297 mm)"
            >
              A4
            </button>
          </div>

          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 transition cursor-pointer"
            title="Isi form dengan contoh data Jerolin Athariz Wija"
          >
            <Sparkles size={13} /> Contoh Data
          </button>

          {/* Tombol Unduh PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
            title="Unduh file PDF resmi (100% sama dengan pratinjau)"
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Memproses PDF...
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-200" /> Berhasil Diunduh!
              </>
            ) : (
              <>
                <Download size={15} /> Download PDF
              </>
            )}
          </button>

          {/* Tombol Dialog Cetak Langsung */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
            title="Buka Dialog Cetak Browser / Simpan PDF"
          >
            <Printer size={15} /> Dialog Cetak
          </button>

          <button
            type="button"
            onClick={() => setShowPdfModal(false)}
            className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition ml-1 cursor-pointer"
            title="Tutup Modal"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Status Bar info jika berhasil unduh */}
      {downloadSuccess && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-2 flex items-center justify-between print:hidden animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>
              <strong>File PDF berhasil diunduh!</strong> Format dokumen telah diproses rapi 2 lembar sesuai pratinjau.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDownloadSuccess(false)}
            className="text-emerald-100 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Preview Container */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 bg-slate-800/90 flex flex-col items-center print:bg-white print:p-0 print:m-0 print:overflow-visible">
        {/* Paper Document Container */}
        <div className="w-full max-w-[215.9mm] h-auto min-h-0 print:p-0 print:m-0 print:max-w-none">
          <GHPRPdfDocument
            formData={formData}
            getFinalKelurahan={getFinalKelurahan}
            getFinalKecamatan={getFinalKecamatan}
            getFinalKabKota={getFinalKabKota}
            onMeasurementChange={setMeasurement}
          />
        </div>
      </div>
    </div>
  );
};

