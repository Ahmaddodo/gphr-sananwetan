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
        <input
          type={type}
          value={typeof formData[k] === "string" ? (formData[k] as string) : ""}
          onChange={(e) => updateField(k, e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
            errors[k] ? "border-rose-300 bg-rose-50/40" : "border-slate-200"
          }`}
        />
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
