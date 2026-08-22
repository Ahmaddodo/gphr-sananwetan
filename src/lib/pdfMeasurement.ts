import { FormGHPRData } from "../types";

export interface FormMeasurementResult {
  totalHeight: number;
  step1Height: number;
  step2Height: number;
  step3Height: number;
  step4Height: number;
  exceedsThreshold: boolean;
  targetSplitStep: 3 | 4 | null;
  measurementSource: "dom" | "estimated";
}

/**
 * Utilitas untuk mengestimasi tinggi konten formulir berdasarkan jumlah teks,
 * baris data, dan elemen media yang diisi pada form.
 */
export function estimateFormContentHeight(formData: FormGHPRData): FormMeasurementResult {
  // Base heights in approximate pixels for standard typography & table layout (11px font)
  let step1 = 170; // Header, waktu & tempat (alamat, kel, kec, kab, prov)
  
  // Step 2: Ringkasan & HPR (Sumber info, kronologi, spesifikasi hewan, tabel vaksin)
  let step2 = 360;
  if (formData.kronologi) {
    // Tambahan tinggi untuk kronologi panjang (~18px per ~60 karakter)
    const kronologiLines = Math.ceil(formData.kronologi.length / 55) || 1;
    step2 += Math.max(0, (kronologiLines - 1) * 16);
  }
  if (formData.sumberInfo && formData.sumberInfo.length > 50) {
    step2 += 18;
  }

  // Step 3: Kasus Korban & Tindakan (Nama, umur, luka, pertolongan, tindakan HPR/Kasus/Masyarakat)
  let step3 = 260;
  if (formData.detailPertolongan && formData.detailPertolongan.length > 50) {
    step3 += 18;
  }
  if (formData.kondisiLuka && formData.kondisiLuka.length > 50) {
    step3 += 18;
  }
  if (formData.tindakanKasus && formData.tindakanKasus.length > 60) {
    step3 += 18;
  }
  if (formData.tindakanMasyarakat && formData.tindakanMasyarakat.length > 60) {
    step3 += 18;
  }

  // Step 4: Rekomendasi, Tim, Dokumentasi & Tanda Tangan
  let step4 = 340;
  if (formData.rekomendasi && formData.rekomendasi.length > 70) {
    const rekLines = Math.ceil(formData.rekomendasi.length / 60) || 1;
    step4 += Math.max(0, (rekLines - 1) * 16);
  }
  if (formData.timAnggota) {
    const anggotaCount = formData.timAnggota.split(/[\n,]/).filter(Boolean).length;
    if (anggotaCount > 1) {
      step4 += (anggotaCount - 1) * 16;
    }
  }
  if (formData.fotoDokumentasi) {
    step4 += 90;
  }

  const totalHeight = step1 + step2 + step3 + step4;
  const exceedsThreshold = totalHeight > 1000;
  
  // Tentukan langkah pembagi: jika Langkah 1 + 2 sudah >= 500px atau total > 1000px, bagi di Langkah 3
  // Jika Langkah 1 + 2 + 3 muat di bawah 1000px namun Langkah 4 membuat overflow, bagi di Langkah 4
  let targetSplitStep: 3 | 4 | null = null;
  if (exceedsThreshold) {
    if (step1 + step2 > 480 || step1 + step2 + step3 > 850) {
      targetSplitStep = 3;
    } else {
      targetSplitStep = 4;
    }
  }

  return {
    totalHeight,
    step1Height: step1,
    step2Height: step2,
    step3Height: step3,
    step4Height: step4,
    exceedsThreshold,
    targetSplitStep,
    measurementSource: "estimated"
  };
}

/**
 * Utilitas untuk mengukur elemen DOM formulir secara langsung sebelum proses cetak/download.
 * Menginspeksi elemen container formulir dan pembungkus langkah 1, 2, 3, 4.
 */
export function measureFormElements(containerElement?: HTMLElement | null): FormMeasurementResult {
  const container = containerElement || document.getElementById("ghpr-print-area");
  
  if (!container) {
    // Fallback ke estimasi jika DOM belum siap
    return {
      totalHeight: 1100,
      step1Height: 200,
      step2Height: 400,
      step3Height: 250,
      step4Height: 350,
      exceedsThreshold: true,
      targetSplitStep: 3,
      measurementSource: "estimated"
    };
  }

  const step1El = container.querySelector("#ghpr-step-wrapper-1") as HTMLElement | null;
  const step2El = container.querySelector("#ghpr-step-wrapper-2") as HTMLElement | null;
  const step3El = container.querySelector("#ghpr-step-wrapper-3") as HTMLElement | null;
  const step4El = container.querySelector("#ghpr-step-wrapper-4") as HTMLElement | null;

  const step1Height = step1El ? step1El.getBoundingClientRect().height || step1El.offsetHeight : 180;
  const step2Height = step2El ? step2El.getBoundingClientRect().height || step2El.offsetHeight : 380;
  const step3Height = step3El ? step3El.getBoundingClientRect().height || step3El.offsetHeight : 260;
  const step4Height = step4El ? step4El.getBoundingClientRect().height || step4El.offsetHeight : 340;

  // Ukur total tinggi container sebenarnya
  const measuredTotal = container.scrollHeight || container.getBoundingClientRect().height || (step1Height + step2Height + step3Height + step4Height);
  const exceedsThreshold = measuredTotal > 1000;

  let targetSplitStep: 3 | 4 | null = null;
  if (exceedsThreshold) {
    if (step1Height + step2Height > 480 || step1Height + step2Height + step3Height > 850) {
      targetSplitStep = 3;
    } else {
      targetSplitStep = 4;
    }
  }

  return {
    totalHeight: Math.round(measuredTotal),
    step1Height: Math.round(step1Height),
    step2Height: Math.round(step2Height),
    step3Height: Math.round(step3Height),
    step4Height: Math.round(step4Height),
    exceedsThreshold,
    targetSplitStep,
    measurementSource: "dom"
  };
}

/**
 * Utilitas untuk menerapkan class dan atribut 'page-break-before: always'
 * pada elemen DOM pembungkus langkah 3 atau 4 sebelum proses print/html2pdf dijalankan.
 */
export function applyDynamicPageBreaksBeforePrint(
  containerElement?: HTMLElement | null,
  forceThreshold = 1000
): FormMeasurementResult {
  const result = measureFormElements(containerElement);
  const container = containerElement || document.getElementById("ghpr-print-area");
  if (!container) return result;

  const step3El = container.querySelector("#ghpr-step-wrapper-3") as HTMLElement | null;
  const step4El = container.querySelector("#ghpr-step-wrapper-4") as HTMLElement | null;

  // Reset existing breaks on step wrappers
  if (step3El) {
    step3El.classList.remove("page-break-before: always", "page-break-before-always", "page-break-before");
    step3El.style.removeProperty("page-break-before");
    step3El.style.removeProperty("break-before");
  }
  if (step4El) {
    step4El.classList.remove("page-break-before: always", "page-break-before-always", "page-break-before");
    step4El.style.removeProperty("page-break-before");
    step4El.style.removeProperty("break-before");
  }

  // Jika total tinggi melebihi threshold (default 1000px), terapkan page-break
  if (result.totalHeight > forceThreshold && result.targetSplitStep) {
    const targetEl = result.targetSplitStep === 3 ? step3El : step4El;
    if (targetEl) {
      // Masukkan class 'page-break-before: always' sesuai permintaan user
      targetEl.classList.add("page-break-before: always");
      targetEl.classList.add("page-break-before-always");
      targetEl.classList.add("page-break-before");
      targetEl.style.setProperty("page-break-before", "always");
      targetEl.style.setProperty("break-before", "page");
      targetEl.setAttribute("data-split-applied", "true");
    }
  }

  return result;
}
