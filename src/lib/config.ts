/**
 * Konfigurasi Web App URL, Spreadsheet ID, dan Endpoint Eksternal
 * UPT Puskesmas Sananwetan - Kota Blitar
 */

export const DEFAULT_SPREADSHEET_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SHEET_ID) ||
  "1jRDFTZWEFTlNSVSP73LI_JGRrRlWyWsXeKrgEiAsBrg";

export const VITE_APPS_SCRIPT_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_APPS_SCRIPT_URL) ||
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_WEB_APP_URL) ||
  "https://script.google.com/macros/s/AKfycbwUedDGkOKzYhtO6aczofji7YE60GAMOlv-IOOdML0s9VkP6b4NS10QTTLbEbwgcH3S/exec";

export const VITE_WEB_APP_URL = VITE_APPS_SCRIPT_URL;

export function getSheetId(): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_SHEET_ID) {
      return import.meta.env.VITE_SHEET_ID.trim();
    }
  } catch (e) {}
  return DEFAULT_SPREADSHEET_ID;
}

export function getWebAppUrl(): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_APPS_SCRIPT_URL) {
      return import.meta.env.VITE_APPS_SCRIPT_URL.trim();
    }
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_WEB_APP_URL) {
      return import.meta.env.VITE_WEB_APP_URL.trim();
    }
  } catch (e) {}
  return VITE_APPS_SCRIPT_URL;
}
