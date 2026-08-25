import officialStampImg from "../assets/images/official_stamp_signature.webp";

export const DEFAULT_PELAKSANA_NAMA = "Widodo Suprianto A.Md.Kep";
export const DEFAULT_PELAKSANA_NIP = "197606252009011007";

// Stempel & Tanda Tangan Resmi UPT Puskesmas Sananwetan (Ungu Asli - Paten & Permanen)
export const OFFICIAL_SIGNATURE_STAMP_URL = officialStampImg;

/**
 * Helper untuk memastikan URL stempel & tanda tangan resmi selalu valid dan tidak berubah
 */
export function getOfficialSignatureUrl(url?: string | null): string {
  if (!url || typeof url !== "string" || url.trim() === "" || url.startsWith("data:image/svg+xml") || url.includes("<svg")) {
    return OFFICIAL_SIGNATURE_STAMP_URL;
  }
  return url;
}

// Logo resmi UPT Puskesmas Sananwetan Data URL
export const PUSKESMAS_LOGO_URL = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="%23059669" stroke="%23047857" stroke-width="4"/><circle cx="50" cy="50" r="38" fill="%23ffffff"/><path d="M42,24 H58 V42 H76 V58 H58 V76 H42 V58 H24 V42 H42 Z" fill="%23059669"/><circle cx="50" cy="50" r="8" fill="%23ffffff"/><path d="M50,45 L50,55 M45,50 L55,50" stroke="%23059669" stroke-width="2" stroke-linecap="round"/></svg>`;





