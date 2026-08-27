import croppedWhiteStampImg from "../assets/images/official_stamp_cropped_white.png";
import puskesmasLogoImg from "../assets/images/puskesmas_logo_1786842695806.jpg";

export const DEFAULT_PELAKSANA_NAMA = "Widodo Suprianto A.Md.Kep";
export const DEFAULT_PELAKSANA_NIP = "197606252009011007";

// Stempel & Tanda Tangan Resmi UPT Puskesmas Sananwetan (Dipangkas presisi, objek lebih besar & background putih murni)
export const OFFICIAL_SIGNATURE_STAMP_URL = croppedWhiteStampImg;

// Logo resmi UPT Puskesmas Sananwetan
export const PUSKESMAS_LOGO_URL = puskesmasLogoImg;

/**
 * Helper untuk memastikan URL stempel & tanda tangan resmi selalu mengarah ke gambar stempel resmi terpotong proporsional & berlatar putih bersih
 */
export function getOfficialSignatureUrl(url?: string | null): string {
  if (
    !url ||
    typeof url !== "string" ||
    url.trim() === "" ||
    url.startsWith("data:image/svg+xml") ||
    url.includes("<svg") ||
    url.includes("regenerated_image") ||
    url.includes("clean_white") ||
    url.includes("widodo_stamp") ||
    url.includes("official_stamp_signature") ||
    url.includes("official-signature-stamp") ||
    url.includes("official_user_uploaded_stamp.jpg")
  ) {
    return OFFICIAL_SIGNATURE_STAMP_URL;
  }
  return url;
}
