import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

const baseInputClass =
  "w-full rounded-lg border border-km-border-strong bg-km-panel px-2.5 py-1.5 text-[13px] text-km-ink placeholder:text-km-ink-muted";

export function Field({
  label,
  children,
  hint,
  span2 = false,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  span2?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 ${span2 ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-medium text-km-ink-soft">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-km-ink-muted">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`${baseInputClass} ${className}`} {...rest} />;
  },
);

/**
 * Input nominal rupiah — tampil dengan pemisah ribuan id-ID saat diketik
 * (ketik 100000 → terlihat 100.000), nilai keluar tetap number bulat.
 *
 * KONVENSI PROYEK: SEMUA input jumlah uang (Rp) di menu apa pun — termasuk
 * menu baru ke depannya — wajib pakai komponen ini, bukan <Input type="number">.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
    value: number | string | null | undefined;
    onChange: (value: number) => void;
  }
>(function MoneyInput({ value, onChange, className = "", placeholder = "0", ...rest }, ref) {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const display = n && !Number.isNaN(n) ? Math.round(n).toLocaleString("id-ID") : "";
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        // Dukung input desimal (id-ID): "." = pemisah ribuan, "," = desimal.
        // Nilai desimal DIBULATKAN ke rupiah terdekat (kebijakan: bulatkan dulu).
        if (raw.includes(",")) {
          const normalized = raw.replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "");
          const f = parseFloat(normalized);
          onChange(Number.isNaN(f) ? 0 : Math.round(f));
        } else {
          const digits = raw.replace(/\D/g, "");
          onChange(digits ? parseInt(digits, 10) : 0);
        }
      }}
      className={`${baseInputClass} tabular-nums ${className}`}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...rest }, ref) {
    return (
      <select ref={ref} className={`${baseInputClass} ${className}`} {...rest}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`${baseInputClass} min-h-[60px] resize-y ${className}`}
        {...rest}
      />
    );
  },
);

export function FormGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-2 ${className}`}>
      {children}
    </div>
  );
}
