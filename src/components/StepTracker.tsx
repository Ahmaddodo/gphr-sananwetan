import React from "react";
import { CircleCheck, MapPin, PawPrint, Syringe, ClipboardList } from "lucide-react";

export const stepsList = [
  { id: 1, title: "Waktu & Tempat", desc: "Kejadian & Lokasi", icon: MapPin },
  { id: 2, title: "Hewan Penular", desc: "HPR Detail", icon: PawPrint },
  { id: 3, title: "Kasus & Tindakan", desc: "Korban & Penanganan", icon: Syringe },
  { id: 4, title: "Rekomendasi & Tim", desc: "Laporan & Petugas", icon: ClipboardList }
];

interface StepTrackerProps {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  feedbackCount: number;
  setFeedbackCount: React.Dispatch<React.SetStateAction<number>>;
}

export const StepTracker: React.FC<StepTrackerProps> = ({
  step,
  setStep,
  feedbackCount,
  setFeedbackCount,
}) => {
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 mt-3 sm:mt-4">
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex items-center gap-1.5 shadow-2xs overflow-x-auto max-w-full">
        {stepsList.map((sItem, idx) => {
          const active = step === sItem.id;
          const done = step > sItem.id;

          return (
            <React.Fragment key={sItem.id}>
              <button
                onClick={() => {
                  setFeedbackCount((c) => c + 1);
                  setStep(sItem.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                data-feedback={feedbackCount}
                className={`flex items-center gap-2 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 transition shrink-0 whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : done
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100/70"
                    : "text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-bold ${
                    active
                      ? "bg-blue-600 text-white"
                      : done
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {done ? <CircleCheck size={13} /> : sItem.id}
                </div>
                <div className="text-left hidden sm:block min-w-0">
                  <div className="text-[11px] font-bold leading-tight flex items-center gap-1 uppercase tracking-wider">
                    {React.createElement(sItem.icon, {
                      size: 12,
                      className: active ? "text-blue-400" : "text-slate-400"
                    })}
                    {sItem.title}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${active ? "text-slate-400" : "text-slate-500"}`}>
                    {sItem.desc}
                  </div>
                </div>
                <div className="sm:hidden text-[11px] font-bold uppercase tracking-wider">{sItem.title}</div>
              </button>
              {idx < stepsList.length - 1 && (
                <div className={`hidden sm:block mx-0.5 h-px w-4 shrink-0 ${step > sItem.id ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
