"use client";

import { FormEvent, ReactNode } from "react";

// ============================================================================
// Modal bersama.
//
// Sebelumnya tiap halaman menyalin sendiri markup overlay-nya, dan sebagian
// besar salinan itu tidak membatasi tinggi panel terhadap layar. Begitu isi
// form lebih tinggi dari viewport, baris tombol di bawah terdorong keluar
// layar dan tidak bisa dijangkau sama sekali — form jadi mustahil disimpan.
//
// Kuncinya tiga hal yang harus berjalan bersama:
//   1. panel dibatasi `max-h` terhadap tinggi layar (dvh, bukan vh, supaya
//      bilah alamat peramban seluler ikut diperhitungkan);
//   2. panel jadi kolom flex: header dan footer `shrink-0`, isi `flex-1`;
//   3. isi diberi `min-h-0` — tanpa itu anak flex menolak menyusut dan
//      `overflow-y-auto`-nya tidak pernah aktif.
//
// Jadi yang menggulir selalu isinya, sementara judul dan tombol tetap di
// tempat. Overlay-nya sendiri juga bisa digulir sebagai jaring pengaman untuk
// layar yang sangat pendek.
// ============================================================================

export function Modal({
  title,
  onClose,
  children,
  footer,
  onSubmit,
  width = "max-w-md",
  bodyClassName = "",
  testId,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Baris tombol. Selalu terlihat, tidak ikut menggulir. */
  footer?: ReactNode;
  /** Bila diisi, panel dirender sebagai <form> agar tombol submit bekerja. */
  onSubmit?: (e: FormEvent) => void;
  /** Lebar maksimum panel, mis. "max-w-2xl". */
  width?: string;
  bodyClassName?: string;
  testId?: string;
}) {
  const panelClass = `my-auto flex max-h-[calc(100dvh-2rem)] w-full ${width} flex-col overflow-hidden rounded-xl border border-km-border bg-km-panel shadow-xl`;

  const isi = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-km-border px-4 py-3">
        <h2 className="min-w-0 truncate text-[14px] font-medium text-km-ink">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="shrink-0 rounded-md p-1 text-km-ink-muted hover:bg-km-bg"
        >
          ✕
        </button>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>

      {footer && (
        <div className="shrink-0 border-t border-km-border bg-km-panel-soft px-4 py-3">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
      data-testid={testId}
    >
      {onSubmit ? (
        <form onSubmit={onSubmit} className={panelClass}>
          {isi}
        </form>
      ) : (
        <div className={panelClass}>{isi}</div>
      )}
    </div>
  );
}
