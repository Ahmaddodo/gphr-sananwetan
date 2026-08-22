/**
 * Konfigurasi Web App URL dan Endpoint Eksternal
 * UPT Puskesmas Sananwetan - Kota Blitar
 */

export const VITE_WEB_APP_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_WEB_APP_URL) ||
  "https://script.google.com/macros/s/AKfycbwUedDGkOKzYhtO6aczofji7YE60GAMOlv-IOOdML0s9VkP6b4NS10QTTLbEbwgcH3S/exec";

export function getWebAppUrl(): string {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_WEB_APP_URL) {
      return import.meta.env.VITE_WEB_APP_URL;
    }
  } catch (e) {}
  return VITE_WEB_APP_URL;
}
