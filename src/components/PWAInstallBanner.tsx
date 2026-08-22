import React, { useState, useEffect } from 'react';
import {
  Download,
  X,
  Smartphone,
  Check,
  Sparkles,
  HelpCircle,
  Share2,
  PlusSquare,
  Monitor,
  CheckCircle2,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Deklarasi global agar dapat dipicu dari komponen manapun di aplikasi
declare global {
  interface Window {
    ghprDeferredPrompt?: BeforeInstallPromptEvent | null;
    triggerPWAInstallPrompt?: () => void;
  }
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);
  const [activeTabGuide, setActiveTabGuide] = useState<'android' | 'ios' | 'desktop'>('android');

  useEffect(() => {
    // 1. Cek apakah sudah running dalam mode standalone / PWA terinstall
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(!!isDisplayStandalone);
    };

    checkStandalone();

    // 2. Tangkap event beforeinstallprompt resmi dari browser Chrome/Edge/Samsung
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      window.ghprDeferredPrompt = promptEvent;

      // Tampilkan floating banner jika belum pernah ditutup dalam sesi ini
      const isDismissed = sessionStorage.getItem('ghpr_pwa_prompt_dismissed_v4');
      if (!isDismissed && !isStandalone) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Listener saat aplikasi berhasil dipasang
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowBanner(false);
      setShowGuideModal(false);
      setDeferredPrompt(null);
      window.ghprDeferredPrompt = null;
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 6000);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Daftarkan fungsi pemicu global
    window.triggerPWAInstallPrompt = () => {
      if (window.ghprDeferredPrompt) {
        window.ghprDeferredPrompt.prompt().then(() => {
          window.ghprDeferredPrompt?.userChoice.then((choice) => {
            if (choice.outcome === 'accepted') {
              setShowBanner(false);
              setShowGuideModal(false);
            }
          });
        });
      } else {
        setShowGuideModal(true);
      }
    };

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setShowBanner(false);
        setDeferredPrompt(null);
        window.ghprDeferredPrompt = null;
      }
    } else {
      // Jika browser belum memicu event langsung, buka panduan visual lengkap
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('ghpr_pwa_prompt_dismissed_v4', 'true');
  };

  // Jika sudah terpasang di mode standalone dan tidak sedang menampilkan notifikasi sukses, jangan tampilkan banner
  if (isStandalone && !installSuccess && !showGuideModal) {
    return null;
  }

  return (
    <>
      {/* Toast notifikasi berhasil install */}
      {installSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce border border-emerald-500">
          <div className="p-1 bg-emerald-800 rounded-full">
            <Check size={18} />
          </div>
          <div className="text-sm font-semibold">
            Aplikasi Form GHPR Sananwetan Berhasil Terpasang di Layar Ponsel Anda!
          </div>
        </div>
      )}

      {/* Floating Bottom Banner / Install Prompt */}
      {showBanner && !isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-white border-2 border-sky-300 shadow-2xl rounded-2xl p-4 transition-all duration-300 animate-in slide-in-from-bottom-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-white shrink-0 shadow-md overflow-hidden p-1">
              <img
                src="./logo.png"
                alt="Logo GHPR"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = './icon-192.png';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-slate-900 truncate">Pasang Aplikasi Mandiri</h4>
                  <span className="bg-sky-100 text-sky-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">PWA</span>
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  title="Tutup"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Pasang ke Layar Utama agar tampil <strong>tanpa header/kolom alamat Chrome</strong> (layar penuh seperti aplikasi bawaan).
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex-1 bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Download size={14} />
                  <span>{deferredPrompt ? "Install Aplikasi Sekarang" : "Petunjuk Pasang Mandiri"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl transition cursor-pointer"
                >
                  Nanti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Petunjuk Lengkap Instalasi Standalone (Tanpa Header Chrome) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-sky-600 to-blue-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center p-1 border border-white/30">
                  <img src="./logo.png" alt="GHPR" className="w-full h-full object-contain rounded-lg" onError={(e) => { (e.target as HTMLImageElement).src = './icon-192.png'; }} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Panduan Pasang Aplikasi Mandiri</h3>
                  <p className="text-xs text-sky-100">Bebas Header Browser &amp; Layar Penuh Standalone</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6">
              {/* Tab Selector Perangkat */}
              <div className="flex items-center bg-slate-100 p-1 rounded-2xl mb-5">
                <button
                  type="button"
                  onClick={() => setActiveTabGuide('android')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTabGuide === 'android'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone size={14} />
                  <span>Android (Chrome)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabGuide('ios')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTabGuide === 'ios'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Share2 size={14} />
                  <span>iPhone / iPad (Safari)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabGuide('desktop')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    activeTabGuide === 'desktop'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Monitor size={14} />
                  <span>Laptop / PC</span>
                </button>
              </div>

              {/* Konten Panduan Android Chrome */}
              {activeTabGuide === 'android' && (
                <div className="space-y-3.5 text-xs text-slate-700">
                  <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 flex items-start gap-2.5">
                    <Sparkles size={16} className="text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sky-900">Penting: </span>
                      Pastikan memilih opsi <strong>"Install aplikasi"</strong> (bukan hanya pintasan situs biasa) agar aplikasi terpasang di HP tanpa address bar &amp; header Chrome.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                        1
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Buka Menu Chrome</p>
                        <p className="text-slate-600 mt-0.5">Ketuk tombol titik tiga (<strong>⋮</strong>) di pojok kanan atas browser Google Chrome Anda.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                        2
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Pilih "Install Aplikasi" atau "Pasang Aplikasi"</p>
                        <p className="text-slate-600 mt-0.5">Pilih menu yang bertuliskan <strong>"Install aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong> yang memiliki ikon aplikasi GHPR.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                        3
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Konfirmasi Install</p>
                        <p className="text-slate-600 mt-0.5">Ketuk tombol <strong>Install</strong> pada jendela konfirmasi. Aplikasi Form GHPR akan langsung terpasang di layar utama HP Anda dan siap digunakan seperti aplikasi mandiri.</p>
                      </div>
                    </div>
                  </div>

                  {deferredPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGuideModal(false);
                        deferredPrompt.prompt();
                      }}
                      className="w-full mt-4 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <Download size={16} />
                      <span>Munculkan Dialog Install Otomatis</span>
                    </button>
                  )}
                </div>
              )}

              {/* Konten Panduan iOS Safari */}
              {activeTabGuide === 'ios' && (
                <div className="space-y-3.5 text-xs text-slate-700">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2.5">
                    <Share2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900">Khusus iPhone / iPad (Safari): </span>
                      Fitur PWA di iOS diinstal melalui menu Bagikan (Share) di browser Safari resmi Apple.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                        1
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Ketuk Tombol Bagikan (Share)</p>
                        <p className="text-slate-600 mt-0.5">Ketuk ikon kotak berpanah ke atas (<strong>⎋ / Share</strong>) di bar navigasi bawah browser Safari.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                        2
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Pilih "Tambah ke Layar Utama"</p>
                        <p className="text-slate-600 mt-0.5">Gulir ke bawah dan ketuk opsi <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong> bertanda ikon tambah (<strong>+</strong>).</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                        3
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Ketuk "Tambah" di Kanan Atas</p>
                        <p className="text-slate-600 mt-0.5">Ketuk tombol <strong>Tambah</strong>. Ikon Form GHPR akan muncul di layar utama iPhone Anda dan berjalan layar penuh tanpa bilah URL Safari.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Konten Panduan Desktop PC/Laptop */}
              {activeTabGuide === 'desktop' && (
                <div className="space-y-3.5 text-xs text-slate-700">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-start gap-2.5">
                    <Monitor size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-indigo-900">Desktop / Laptop: </span>
                      Dapat dipasang di Windows / Mac / Linux dan berjalan di jendela aplikasi tersendiri tanpa tab browser.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                        1
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Klik Ikon Pasang di Kolom URL</p>
                        <p className="text-slate-600 mt-0.5">Lihat ke ujung kanan bilah alamat (URL bar) browser Chrome atau Edge Anda. Klik ikon <strong>Pasang / Install Aplikasi (⊞ / ↓)</strong>.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                        2
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Klik "Install"</p>
                        <p className="text-slate-600 mt-0.5">Aplikasi akan langsung terbuka di jendela mandiri dan dapat diakses melalui Menu Start atau Desktop shortcut.</p>
                      </div>
                    </div>
                  </div>

                  {deferredPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGuideModal(false);
                        deferredPrompt.prompt();
                      }}
                      className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <Download size={16} />
                      <span>Pasang Sekarang di Desktop</span>
                    </button>
                  )}
                </div>
              )}

              {/* Status Mode Mandiri */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className={isStandalone ? "text-emerald-600" : "text-slate-400"} />
                  <span>Status Aplikasi: <strong>{isStandalone ? "Aplikasi Mandiri Aktif" : "Browser Web"}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
