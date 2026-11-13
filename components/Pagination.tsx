"use client";

type Props = {
  currentPage: number;
  lastPage: number;
  total: number;
  from: number | null;
  to: number | null;
  onChange: (page: number) => void;
  /** Bila diisi, pemilih jumlah baris per halaman ikut ditampilkan. */
  perPage?: number;
  onPerPageChange?: (perPage: number) => void;
};

/** Pilihan jumlah baris per halaman (FV-26). */
export const PER_PAGE_PILIHAN = [10, 20, 50, 100];
export const PER_PAGE_DEFAULT = 20;

export function Pagination({
  currentPage,
  lastPage,
  total,
  from,
  to,
  onChange,
  perPage,
  onPerPageChange,
}: Props) {
  const goto = (p: number) => {
    const clamped = Math.max(1, Math.min(Math.max(lastPage, 1), p));
    if (clamped !== currentPage) onChange(clamped);
  };

  const pageButtons = buildPageList(currentPage, lastPage);

  // Navigasinya tetap dirender walau datanya cuma satu halaman atau kosong:
  // tombolnya nonaktif, bukan hilang, supaya tata letak tidak melompat.
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-km-ink-soft">
      <span data-testid="pagination-info">
        {total === 0
          ? "Tidak ada data"
          : `Menampilkan ${from ?? 0}–${to ?? 0} dari ${total} data`}
      </span>

      <div className="flex items-center gap-3">
        {perPage != null && onPerPageChange && (
          <label className="flex items-center gap-1.5">
            Baris
            <select
              data-testid="per-page"
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="rounded-md border border-km-border-strong bg-km-panel px-1.5 py-0.5 text-[11px] text-km-ink"
            >
              {PER_PAGE_PILIHAN.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <NavBtn label="‹" disabled={currentPage <= 1} onClick={() => goto(currentPage - 1)} />
          {pageButtons.map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-km-ink-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => goto(p)}
                className={`min-w-[24px] rounded-md px-1.5 py-0.5 ${
                  p === currentPage
                    ? "bg-km-accent-soft font-semibold text-km-accent-ink"
                    : "hover:bg-km-panel-soft"
                }`}
              >
                {p}
              </button>
            ),
          )}
          <NavBtn
            label="›"
            disabled={currentPage >= lastPage}
            onClick={() => goto(currentPage + 1)}
          />
        </div>
      </div>
    </div>
  );
}

function NavBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md px-1.5 py-0.5 hover:bg-km-panel-soft disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

/** 1 … 4 [5] 6 … 20 — selalu menyertakan halaman pertama dan terakhir. */
function buildPageList(current: number, last: number): Array<number | "…"> {
  if (last <= 1) return [1];
  const out: Array<number | "…"> = [];
  const push = (n: number) => {
    if (!out.includes(n)) out.push(n);
  };
  push(1);
  if (current - 2 > 2) out.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(last - 1, current + 1); p++) push(p);
  if (current + 2 < last - 1) out.push("…");
  if (last > 1) push(last);
  return out;
}

// ============================================================================
// Pagination sisi peramban.
//
// Dipakai HANYA untuk daftar yang datanya memang sudah dibatasi di server oleh
// hal lain — misalnya rincian rekonsiliasi (satu periode bulan) atau daftar
// role (jumlahnya tetap sedikit) — dan angka ringkasan di atas tabelnya harus
// dihitung dari seluruh baris periode itu, bukan per halaman. Daftar transaksi
// yang bisa tumbuh tanpa batas tetap dipotong di server.
// ============================================================================
import { useEffect, useMemo, useState } from "react";

export function usePaginasiLokal<T>(
  items: T[],
  opsi: { cari?: string; cocok?: (item: T, kata: string) => boolean } = {},
) {
  const { cari = "", cocok } = opsi;
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);

  const terfilter = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    if (!kata || !cocok) return items;
    return items.filter((i) => cocok(i, kata));
  }, [items, cari, cocok]);

  const total = terfilter.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  // Kata kunci/jumlah baris berubah → kembali ke halaman 1.
  useEffect(() => {
    setPage(1);
  }, [cari, perPage, items.length]);

  const halaman = Math.min(page, lastPage);
  const mulai = (halaman - 1) * perPage;
  const rows = terfilter.slice(mulai, mulai + perPage);

  return {
    rows,
    total,
    props: {
      currentPage: halaman,
      lastPage,
      total,
      from: total === 0 ? null : mulai + 1,
      to: total === 0 ? null : mulai + rows.length,
      onChange: setPage,
      perPage,
      onPerPageChange: setPerPage,
    },
  };
}
