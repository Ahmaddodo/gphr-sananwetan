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
 * Render elemen dokumen ke dalam Canvas secara bersih di wadah off-screen berukuran standar.
 * Menghilangkan bayangan modal (shadow-xl), sudut melengkung, serta variasi lebar layar HP/desktop
 * sehingga hasil tangkapan 100% identik dan rapi seperti cetakan dokumen asli.
 */
async function captureCleanDocumentSheet(sourceElement: HTMLElement, targetWidthPx: number = 816): Promise<HTMLCanvasElement> {
  const clone = sourceElement.cloneNode(true) as HTMLElement;

  // Standarisasi ukuran dan hapus efek kartu layar
  clone.style.width = `${targetWidthPx}px`;
  clone.style.maxWidth = `${targetWidthPx}px`;
  clone.style.minWidth = `${targetWidthPx}px`;
  clone.style.boxSizing = "border-box";
  clone.style.margin = "0";
  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";
  clone.style.padding = "24px 28px 24px 28px";
  clone.style.backgroundColor = "#ffffff";
  clone.style.color = "#000000";
  clone.style.transform = "none";
  clone.style.pageBreakBefore = "auto";

  // Hapus class pembungkus yang hanya untuk tampilan modal layar
  clone.classList.remove(
    "shadow-xl",
    "shadow-2xl",
    "shadow-lg",
    "shadow-sm",
    "rounded-sm",
    "rounded-md",
    "rounded-lg",
    "mb-6",
    "p-4",
    "sm:p-6",
    "md:p-8"
  );

  // Buat wadah terisolasi di luar layar
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.top = "-12000px";
  host.style.left = "-12000px";
  host.style.width = `${targetWidthPx}px`;
  host.style.backgroundColor = "#ffffff";
  host.style.zIndex = "-99999";
  host.style.opacity = "1";
  host.style.pointerEvents = "none";
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    // Pastikan seluruh gambar (stempel, tanda tangan, foto) telah termuat sempurna
    const imgs = Array.from(clone.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalHeight !== 0) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(resolve, 2000);
            }
          })
      )
    );

    // Jeda sejenak untuk kalkulasi font & rendering DOM
    await new Promise((r) => setTimeout(r, 60));

    // Capture resolusi tinggi (2.5x = ~240 DPI tajam seperti vektor)
    const canvas = await html2canvas(clone, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: targetWidthPx,
      windowWidth: targetWidthPx,
    });

    return canvas;
  } finally {
    if (document.body.contains(host)) {
      document.body.removeChild(host);
    }
  }
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
   * Pemicu Dialog Cetak Browser Langsung
   */
  const handlePrint = () => {
    try {
      // Siapkan style ukuran kertas sementara jika diperlukan
      const styleId = "ghpr-dynamic-print-size";
      let styleTag = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }

      const pageSizeCss =
        paperSize === "a4"
          ? "A4 portrait"
          : paperSize === "f4"
          ? "215mm 330mm portrait"
          : "legal portrait";

      styleTag.innerHTML = `
        @media print {
          @page {
            size: ${pageSizeCss} !important;
            margin: 6mm 8mm 6mm 8mm !important;
          }
        }
      `;

      window.focus();
      window.print();
    } catch (e) {
      console.error("Window print error:", e);
      // Fallback unduh jika dialog cetak tidak diizinkan di container tertentu
      handleDownloadPdf();
    }
  };

  /**
   * Unduh Dokumen PDF Resmi 100% Identik dengan Review
   */
  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    setDownloadSuccess(false);

    try {
      const sheet1 = document.getElementById("ghpr-sheet-1");
      const sheet2 = document.getElementById("ghpr-sheet-2");
      const rootArea = document.getElementById("ghpr-print-area");

      if (!rootArea && !sheet1) {
        throw new Error("Elemen formulir tidak ditemukan");
      }

      // Konfigurasi ukuran kertas jsPDF
      let pdfFormat: [number, number] | "a4" | "legal" = "legal";
      let pageWidthMm = 215.9;
      let pageHeightMm = 355.6;
      let targetWidthPx = 816; // 215.9mm @ 96 DPI

      if (paperSize === "a4") {
        pdfFormat = "a4";
        pageWidthMm = 210;
        pageHeightMm = 297;
        targetWidthPx = 794;
      } else if (paperSize === "f4") {
        pdfFormat = [215, 330];
        pageWidthMm = 215;
        pageHeightMm = 330;
        targetWidthPx = 813;
      } else {
        pdfFormat = "legal";
        pageWidthMm = 215.9;
        pageHeightMm = 355.6;
        targetWidthPx = 816;
      }

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: pdfFormat,
        compress: true,
      });

      if (sheet1 && sheet2) {
        // Render Lembar 1 secara bersih
        const canvas1 = await captureCleanDocumentSheet(sheet1, targetWidthPx);
        const imgData1 = canvas1.toDataURL("image/png");
        const contentHeightMm1 = (canvas1.height * pageWidthMm) / canvas1.width;
        pdf.addImage(imgData1, "PNG", 0, 0, pageWidthMm, Math.min(contentHeightMm1, pageHeightMm), undefined, "FAST");

        // Render Lembar 2 secara bersih di Halaman 2
        pdf.addPage(pdfFormat, "portrait");
        const canvas2 = await captureCleanDocumentSheet(sheet2, targetWidthPx);
        const imgData2 = canvas2.toDataURL("image/png");
        const contentHeightMm2 = (canvas2.height * pageWidthMm) / canvas2.width;
        pdf.addImage(imgData2, "PNG", 0, 0, pageWidthMm, Math.min(contentHeightMm2, pageHeightMm), undefined, "FAST");
      } else if (rootArea) {
        const canvas = await captureCleanDocumentSheet(rootArea, targetWidthPx);
        const imgData = canvas.toDataURL("image/png");
        const contentHeightMm = (canvas.height * pageWidthMm) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pageWidthMm, Math.min(contentHeightMm, pageHeightMm), undefined, "FAST");
      }

      const cleanName = formData.namaKorban
        ? formData.namaKorban.trim().replace(/[^a-zA-Z0-9]/g, "_")
        : "Laporan";

      pdf.save(`Form_PE_GHPR_${cleanName}.pdf`);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error("Gagal membuat PDF otomatis:", err);
      // Pemicu fallback langsung ke window.print
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

