import React from "react";
import { TriangleAlert } from "lucide-react";
import { FormGHPRData, FormErrors } from "../types";

interface FormInputProps {
  label: string;
  k: keyof FormGHPRData;
  formData: FormGHPRData;
  errors: FormErrors;
  updateField: (field: keyof FormGHPRData, value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
  showAsterisk?: boolean;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  k,
  formData,
  errors,
  updateField,
  placeholder,
  type = "text",
  required,
  options,
  helpText,
  showAsterisk = true,
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold tracking-wider text-slate-700 uppercase flex items-center gap-1">
        <span>{label}</span>
        {required && showAsterisk && (
          <span className="text-rose-500 font-bold ml-0.5 text-sm leading-none" title="Wajib diisi">*</span>
        )}
      </label>
      {options ? (
        <select
          value={typeof formData[k] === "string" ? (formData[k] as string) : ""}
          onChange={(e) => updateField(k, e.target.value)}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
            errors[k] ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
          }`}
        >
          <option value="">-- Pilih {label} --</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={typeof formData[k] === "string" ? (formData[k] as string) : ""}
          onChange={(e) => updateField(k, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`w-full resize-none rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
            errors[k] ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
          }`}
        />
      ) : (
        (() => {
          let inputValue = typeof formData[k] === "string" ? (formData[k] as string) : "";
          if (type === "datetime-local" && inputValue) {
            const trimmed = inputValue.trim();
            if (trimmed.includes(" ") && !trimmed.includes("T")) {
              const parts = trimmed.split(" ");
              const datePart = parts[0];
              const timePart = parts[1] || "10:00";
              const dmy = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
              if (dmy) {
                inputValue = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}T${timePart.slice(0, 5)}`;
              } else if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                inputValue = `${datePart}T${timePart.slice(0, 5)}`;
              }
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
              inputValue = `${trimmed}T10:00`;
            } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-](\d{4})/.test(trimmed)) {
              const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
              if (dmy) {
                inputValue = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}T10:00`;
              }
            } else if (trimmed.includes("T")) {
              const [d, t] = trimmed.split("T");
              inputValue = `${d}T${(t || "10:00").slice(0, 5)}`;
            }
          } else if (type === "date" && inputValue) {
            const trimmed = inputValue.trim();
            let dateOnly = trimmed;
            if (dateOnly.includes("T")) {
              dateOnly = dateOnly.split("T")[0];
            } else if (dateOnly.includes(" ")) {
              dateOnly = dateOnly.split(" ")[0];
            }
            const dmy = dateOnly.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (dmy) {
              inputValue = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
              inputValue = dateOnly;
            }
          }

          return (
            <input
              type={type}
              value={inputValue}
              onChange={(e) => updateField(k, e.target.value)}
              placeholder={placeholder}
              className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                errors[k] ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
              }`}
            />
          );
        })()
      )}
      {helpText && <p className="text-[11px] text-slate-500 mt-0.5">{helpText}</p>}
      {errors[k] && (
        <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-0.5">
          <TriangleAlert size={12} />
          {errors[k]}
        </span>
      )}
    </div>
  );
};
