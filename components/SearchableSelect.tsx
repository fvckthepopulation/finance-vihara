"use client";

import { useEffect, useRef, useState } from "react";

export type SearchableOption = {
  value: string | number;
  label: string;
  sub?: string;
};

type Props = {
  options: SearchableOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  emptyLabel?: string;
};

/**
 * Combobox-style picker for long lists. Click → dropdown with inline search.
 * Matches the mockup LOV (List of Values) widget.
 */
export function SearchableSelect({ options, value, onChange, placeholder = "— Pilih —", disabled, required, emptyLabel = "Tidak ada hasil" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? null;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q))
    : options;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-[13px] transition ${
          disabled ? "cursor-not-allowed bg-km-bg text-km-ink-muted" : "bg-km-panel hover:border-km-blue"
        } ${open ? "border-km-blue ring-2 ring-km-blue/20" : "border-km-border-strong"}`}
      >
        {selected ? (
          <span className="flex-1 truncate text-km-ink">{selected.label}</span>
        ) : (
          <span className="flex-1 truncate text-km-ink-muted">{placeholder}{required ? " *" : ""}</span>
        )}
        <span className={`text-[10px] text-km-ink-muted transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 flex max-h-72 flex-col overflow-hidden rounded-lg border border-km-border-strong bg-km-panel shadow-xl">
          <div className="border-b border-km-border px-2 py-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama / kode…"
              className="w-full rounded-md border border-km-border px-2 py-1 text-[12px] outline-none focus:border-km-blue"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {value !== null && value !== undefined && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
                className="block w-full border-b border-km-border px-3 py-1.5 text-left text-[11px] text-km-ink-muted hover:bg-km-panel-soft"
              >
                ✕ Kosongkan pilihan
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-km-ink-muted">{emptyLabel}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                  className={`block w-full border-b border-km-border px-3 py-2 text-left hover:bg-km-panel-soft ${
                    o.value === value ? "bg-km-blue-soft" : ""
                  }`}
                >
                  <p className="text-[12px] font-medium text-km-ink">{o.label}</p>
                  {o.sub && <p className="text-[10px] text-km-ink-muted">{o.sub}</p>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
