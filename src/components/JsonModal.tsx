import React, { useState } from "react";
import { Eye, X, Copy, Check, Download, FileCode, CheckCircle2, AlertCircle } from "lucide-react";
import { SubmissionPayload } from "../types";

interface JsonModalProps {
  showJsonModal: boolean;
  setShowJsonModal: (val: boolean) => void;
  previewJsonPayload: SubmissionPayload;
}

export const JsonModal: React.FC<JsonModalProps> = ({
  showJsonModal,
  setShowJsonModal,
  previewJsonPayload,
}) => {
  const [copied, setCopied] = useState(false);

  if (!showJsonModal) return null;

  const jsonString = JSON.stringify(previewJsonPayload, null, 2);
  const totalKeys = Object.keys(previewJsonPayload || {}).length;
  const payloadSizeKb = (new Blob([jsonString]).size / 1024).toFixed(2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${previewJsonPayload.id_kasus || "laporan-ghpr"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => setShowJsonModal(false)}
      />
      <div className="relative w-full md:max-w-[840px] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
              <FileCode size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 tracking-wide uppercase">
                Preview JSON Payload
              </h3>
              <p className="text-[11px] text-slate-400">
                Struktur data yang dikirim ke Google Apps Script & Google Sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer border border-white/10"
              title="Salin JSON ke Clipboard"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-300">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer shadow-sm"
              title="Unduh file .json"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span> .json
            </button>
            <button
              onClick={() => setShowJsonModal(false)}
              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Info Meta Bar */}
        <div className="px-5 py-2.5 bg-slate-800 text-slate-300 border-b border-slate-700 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap font-mono text-[11px]">
            <span>
              ID: <b className="text-emerald-400">{previewJsonPayload.id_kasus}</b>
            </span>
            <span>
              Total Field: <b className="text-blue-300">{totalKeys} parameter</b>
            </span>
            <span>
              Ukuran: <b className="text-purple-300">{payloadSizeKb} KB</b>
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-sans font-medium">
            <CheckCircle2 size={13} /> Format Valid JSON
          </span>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto bg-[#0B1120] p-5">
          <pre className="text-xs leading-relaxed text-emerald-300 font-mono whitespace-pre-wrap break-all select-all font-medium">
            {jsonString}
          </pre>
        </div>

        {/* Footer Modal */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <AlertCircle size={14} className="text-blue-600 shrink-0" />
            <span>
              Data ini dipetakan otomatis ke 43 kolom spreadsheet Google Drive Puskesmas Sananwetan.
            </span>
          </div>
          <button
            onClick={() => setShowJsonModal(false)}
            className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

