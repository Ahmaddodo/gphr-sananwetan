import React, { useState, useEffect } from "react";
import { Printer, X, Download, FileText, Sparkles, Loader2, Layers } from "lucide-react";
import { FormGHPRData } from "../types";
import { GHPRPdfDocument } from "./GHPRPdfDocument";
import { OFFICIAL_SIGNATURE_STAMP_URL, DEFAULT_PELAKSANA_NAMA, DEFAULT_PELAKSANA_NIP } from "./SignatureData";
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

  const handlePrint = () => {
    try {
      const sheet1 = document.getElementById("ghpr-sheet-1");
      const sheet2 = document.getElementById("ghpr-sheet-2");
      const rootArea = document.getElementById("ghpr-print-area");

      const elementToPrint = rootArea || sheet1;
      if (!elementToPrint) {
        window.print();
        return;
      }

      // Gunakan teknik hidden iframe untuk isolasi cetak yang bersih
      let printIframe = document.getElementById("ghpr-isolated-print-frame") as HTMLIFrameElement;
      if (printIframe) {
        printIframe.remove();
      }

      printIframe = document.createElement("iframe");
      printIframe.id = "ghpr-isolated-print-frame";
      printIframe.style.position = "fixed";
      printIframe.style.right = "0";
      printIframe.style.bottom = "0";
      printIframe.style.width = "0";
      printIframe.style.height = "0";
      printIframe.style.border = "none";
      document.body.appendChild(printIframe);

      const doc = printIframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      const pageSizeCss =
        paperSize === "a4"
          ? "A4 portrait"
          : paperSize === "f4"
          ? "215mm 330mm portrait"
          : "legal portrait";

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="id">
          <head>
            <meta charset="UTF-8">
            <title>Form PE GHPR - ${formData.namaKorban || "Dokumen"}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap" rel="stylesheet">
            <style>
              @page {
                size: ${pageSizeCss};
                margin: 6mm 8mm 6mm 8mm;
              }
              * {
                box-sizing: border-box;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
                margin: 0 !important;
                padding: 0 !important;
                font-size: 11px;
                line-height: 1.25;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #ghpr-print-area {
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .ghpr-page-sheet {
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
                width: 100% !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #ghpr-sheet-2, .ghpr-sheet-2 {
                page-break-before: always !important;
                break-before: page !important;
                padding-top: 4px !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                margin-bottom: 0 !important;
                font-size: 10.5px !important;
              }
              td, th {
                border: 1px solid #000000 !important;
                padding: 4px !important;
                vertical-align: top;
              }
              td table, th table {
                margin: 0 !important;
              }
              td table td {
                padding: 3px !important;
              }
              .avoid-break {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              img {
                max-width: 100%;
                height: auto;
              }
            </style>
          </head>
          <body>
            ${elementToPrint.outerHTML}
          </body>
        </html>
      `;

      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (printErr) {
          console.warn("Iframe print error, falling back to window.print():", printErr);
          window.print();
        }
      }, 500);
    } catch (e) {
      console.error("Window print error:", e);
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      const sheet1 = document.getElementById("ghpr-sheet-1");
      const sheet2 = document.getElementById("ghpr-sheet-2");
      const rootArea = document.getElementById("ghpr-print-area");

      if (!rootArea && !sheet1) {
        throw new Error("Elemen formulir tidak ditemukan");
      }

      // Tentukan ukuran kertas
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

      const canvasConfig = {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 10000,
        removeContainer: true,
      };

      const marginMm = 8;
      const printableWidthMm = pageWidthMm - marginMm * 2;

      if (sheet1 && sheet2) {
        // Halaman 1: Sheet 1
        const canvas1 = await html2canvas(sheet1, canvasConfig);
        const imgData1 = canvas1.toDataURL("image/jpeg", 0.95);
        const contentHeightMm1 = Math.min((canvas1.height * printableWidthMm) / canvas1.width, pageHeightMm - marginMm * 2);
        pdf.addImage(imgData1, "JPEG", marginMm, marginMm, printableWidthMm, contentHeightMm1);

        // Halaman 2: Sheet 2
        pdf.addPage(pdfFormat, "portrait");
        const canvas2 = await html2canvas(sheet2, canvasConfig);
        const imgData2 = canvas2.toDataURL("image/jpeg", 0.95);
        const contentHeightMm2 = Math.min((canvas2.height * printableWidthMm) / canvas2.width, pageHeightMm - marginMm * 2);
        pdf.addImage(imgData2, "JPEG", marginMm, marginMm, printableWidthMm, contentHeightMm2);
      } else if (rootArea) {
        // Fallback satu dokumen penuh
        const canvas = await html2canvas(rootArea, canvasConfig);
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const contentHeightMm = (canvas.height * printableWidthMm) / canvas.width;
        pdf.addImage(imgData, "JPEG", marginMm, marginMm, printableWidthMm, contentHeightMm);
      }

      const cleanName = formData.namaKorban
        ? formData.namaKorban.trim().replace(/[^a-zA-Z0-9]/g, "_")
        : "Laporan";

      pdf.save(`Form_PE_GHPR_${cleanName}.pdf`);
    } catch (err) {
      console.error("Gagal membuat PDF otomatis:", err);
      // Pemicu fallback ke dialog cetak jika html2canvas terhalang
      handlePrint();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadSample = () => {
    setFormData(samplePdfData);
  };

  return (
    <div
      id="ghpr-modal-overlay"
      className="fixed inset-0 z-[100] flex flex-col bg-slate-900/80 backdrop-blur-sm overflow-hidden print:bg-white print:p-0 print:m-0 print:static print:block"
    >
      {/* Modal Top Bar (Hidden on print) */}
      <div
        id="ghpr-modal-header"
        className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase">
              Pratinjau Cetak & Download PDF
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Dokumen Resmi Formulir Penyelidikan Epidemiologi GHPR
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
              title="Kertas Legal (8.5 x 14 in / 216 x 356 mm)"
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

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
            title="Unduh file PDF dengan pembagian halaman otomatis"
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Membuat PDF...
              </>
            ) : (
              <>
                <Download size={15} /> Download PDF
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer"
            title="Buka Dialog Cetak / Simpan PDF Browser"
          >
            <Printer size={15} /> Dialog Cetak
          </button>

          <button
            type="button"
            onClick={() => setShowPdfModal(false)}
            className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition ml-1 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

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
