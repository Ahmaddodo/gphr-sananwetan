import React, { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, X, ShieldAlert } from "lucide-react";
import {
  getGvizSyncError,
  subscribeGvizSyncError,
  setGvizSyncError,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL
} from "../lib/googleSheets";
import { pullAllCloudData } from "../lib/patientMonitoring";

interface GvizSyncErrorBannerProps {
  onRetry?: () => void;
  className?: string;
}

export const GvizSyncErrorBanner: React.FC<GvizSyncErrorBannerProps> = ({
  onRetry,
  className = ""
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(getGvizSyncError());
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeGvizSyncError((err) => {
      setErrorMessage(err);
      if (err) {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  if (!errorMessage || isDismissed) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        await pullAllCloudData();
      }
    } catch (e) {
      console.warn("Retry failed:", e);
    } finally {
      setIsRetrying(false);
    }
  };

  const cleanShortId = DEFAULT_SPREADSHEET_ID.slice(0, 5);

  return (
    <div
      id="gviz-sync-error-banner"
      role="alert"
      className={`w-full bg-red-600 text-white px-4 py-3 shadow-md transition-all ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm">
        <div className="flex items-start gap-2.5 flex-1">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-white mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold tracking-wide text-white">
              {errorMessage}
            </p>
            <p className="text-xs text-red-100">
              Pastikan spreadsheet sudah diatur: <strong>Share &gt; General access &gt; Anyone with the link &gt; Viewer</strong> agar sistem dapat membaca data tanpa login.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
          <a
            href={DEFAULT_SPREADSHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-md font-medium text-xs shadow-sm transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka Google Sheet
          </a>

          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white border border-red-400 rounded-md font-medium text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Mencoba..." : "Coba Sinkron"}
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Tutup notifikasi"
            className="p-1 text-red-200 hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
