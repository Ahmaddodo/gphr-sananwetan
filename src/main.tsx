import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initializeAppSyncAndBustStaleCache } from './lib/cacheSyncService';

// Tangani kemungkinan chunk loading error jika terjadi update versi di latar belakang
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e?.message && /loading chunk|failed to fetch dynamically imported module/i.test(e.message)) {
      console.warn('Chunk loading error terdeteksi, memuat ulang...', e);
      window.location.reload();
    }
  });
}

// Jalankan sinkronisasi awal data & pembersihan cache usang saat aplikasi dibuka secara aman
try {
  initializeAppSyncAndBustStaleCache();
} catch (err) {
  console.warn("Inisialisasi cache sync tertunda:", err);
}

// Registrasi Service Worker PWA otomatis dengan refresh instan saat versi baru terdeteksi
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('Update versi baru aplikasi GHPR terdeteksi, memuat versi terbaru secara otomatis...');
        try {
          updateSW(true);
        } catch (e) {}
      },
      onOfflineReady() {
        console.log('Aplikasi Form GHPR siap digunakan secara offline.');
      },
    });

    // Pengecekan versi baru secara berkala (tiap 30 menit) & saat tab kembali aktif
    setInterval(() => {
      if (navigator.onLine) {
        try {
          updateSW(false);
        } catch (e) {}
      }
    }, 30 * 60 * 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        try {
          updateSW(false);
        } catch (e) {}
      }
    });
  } catch (swErr) {
    console.warn("PWA Service Worker registration skipped:", swErr);
  }
}

interface ErrorBoundaryProps {

  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("ghpr_form_draft_data_v1");
      localStorage.removeItem("ghpr_form_draft_step_v1");
      localStorage.removeItem("ghpr_form_editing_case_id_v1");
      localStorage.removeItem("ghpr_last_user_activity_ts_v1");
    } catch (e) {}
    window.location.reload();
  };

  handleHardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/30">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Terjadi Kendala Memuat Tampilan</h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Aplikasi mendeteksi kendala pada cache browser lokal. Klik tombol di bawah untuk memuat ulang aplikasi.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReset}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition cursor-pointer shadow-md"
              >
                Muat Ulang Aplikasi
              </button>
              <button
                onClick={this.handleHardReset}
                className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                Bersihkan Cache & Reset Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);


