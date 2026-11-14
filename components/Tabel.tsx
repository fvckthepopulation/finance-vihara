"use client";

import { MouseEvent, ReactNode } from "react";

// ============================================================================
// Sel tabel bersama — satu tempat untuk seluruh menu (FV-48).
//
// Sebelumnya tiap halaman mendefinisikan `Th` dan `Td` sendiri: 19 salinan,
// dua di antaranya sudah menyimpang ukurannya. Begitu ada keluhan tentang
// kolom tabel, perbaikannya harus disalin 19 kali — dan yang terlewat baru
// ketahuan dari laporan penguji berikutnya. Itu persis yang terjadi pada
// FV-47/FV-48.
//
// Kunci kolom Aksi: `w-px` + `whitespace-nowrap`. Pada tabel `w-full` dengan
// layout otomatis, kolom berlebar 1px yang isinya tidak boleh dibungkus akan
// melebar PERSIS selebar isinya — tidak lebih. Jadi lebarnya mengikuti baris
// dengan tombol terbanyak, tanpa ruang kosong di kanan, dan sisa ruangnya
// jatuh ke kolom lain sehingga nominal tidak lagi terpotong dua baris.
//
// Lebar tetap seperti `w-[13.5rem]` (yang saya pakai di FV-41) justru
// sebaliknya: kolomnya memaksa lebar sendiri dan merampok kolom lain.
// ============================================================================

const TH_DASAR =
  "px-3 py-2 text-left text-[10.5px] font-medium uppercase tracking-wide text-km-ink-muted";

export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <th className={`${TH_DASAR} ${className}`}>{children}</th>;
}

export function Td({
  children,
  className = "",
  onClick,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  colSpan?: number;
}) {
  return (
    <td className={`px-3 py-2.5 text-km-ink ${className}`} onClick={onClick} colSpan={colSpan}>
      {children}
    </td>
  );
}

/**
 * Judul kolom Aksi. Lebarnya mengikuti isi, bukan angka yang ditebak.
 * Dipakai berpasangan dengan TdAksi.
 */
export function ThAksi({
  children = "Aksi",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <th className={`${TH_DASAR} w-px whitespace-nowrap ${className}`}>{children}</th>;
}

/**
 * Sel aksi: tombol-tombol sebaris, sejajar antar baris (FV-41), dan kolomnya
 * tidak melebar melebihi isinya (FV-47/FV-48).
 */
export function TdAksi({
  children,
  className = "",
  onClick,
}: {
  children?: ReactNode;
  className?: string;
  /** Mis. stopPropagation di tabel yang barisnya sendiri bisa diklik. */
  onClick?: (e: MouseEvent) => void;
}) {
  return (
    <td
      className={`w-px whitespace-nowrap px-3 py-2.5 text-km-ink ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5">{children}</div>
    </td>
  );
}

/**
 * Sel nominal: rata kanan, angka berlebar sama, dan TIDAK boleh dibungkus —
 * "Rp 500.000" yang terpotong jadi dua baris adalah keluhan FV-47 poin 3.
 */
export function TdNominal({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-km-ink ${className}`}
    >
      {children}
    </td>
  );
}

/** Judul kolom nominal — rata kanan, tidak dibungkus. */
export function ThNominal({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th className={`${TH_DASAR} whitespace-nowrap text-right ${className}`}>{children}</th>
  );
}

/** Baris "Memuat…" / "Tidak ada data" yang membentang seluruh kolom. */
export function TrKosong({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-km-ink-muted">
        {children}
      </td>
    </tr>
  );
}
