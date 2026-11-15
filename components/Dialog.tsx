"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { Modal } from "./Modal";

// ============================================================================
// Dialog konfirmasi & input alasan di dalam aplikasi (FV-70).
//
// Menggantikan window.prompt / window.confirm. Dialog bawaan peramban bisa
// diblokir (termasuk "jangan tampilkan dialog lagi" setelah muncul beberapa
// kali) atau dimatikan kebijakan perusahaan — akibatnya pengguna tidak bisa
// menolak, membatalkan, atau menghapus apa pun. Tampilannya juga tidak bisa
// memuat validasi.
//
// Dipanggil secara imperatif supaya alur pemanggil tetap lurus:
//
//   const alasan = await dialog.prompt({ title: "Tolak PAY-1", label: "Alasan penolakan",
//     confirmLabel: "Tolak", tone: "danger", action: (a) => rejectPembayaran(id, a) });
//   if (alasan == null) return;   // dibatalkan pengguna
//
// Bila `action` diisi, aksi dijalankan DI DALAM dialog: tombol terkunci selama
// berjalan, dan bila gagal pesan error tampil di dialog tanpa menutupnya —
// pengguna bisa memperbaiki alasannya atau membatalkan. Dialog baru tertutup
// (dan Promise selesai) setelah aksi berhasil.
//
// Tampilannya memakai komponen Modal bersama, dirender lewat portal di atas
// modal lain yang sedang terbuka (mis. Detail transaksi).
// ============================================================================

type Tone = "primary" | "danger" | "amber" | "success";

type Dasar = {
  title: string;
  /** Penjelasan dampak tindakan. String dengan "\n" ditampilkan sebagai baris baru. */
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Warna tombol aksi; merah ("danger") untuk tindakan yang menghapus/membatalkan. */
  tone?: Tone;
};

export type ConfirmOptions = Dasar & {
  action?: () => Promise<unknown>;
};

export type PromptOptions = Dasar & {
  /** Label kolom isian, mis. "Alasan penolakan". */
  label: string;
  placeholder?: string;
  /** Panjang minimum setelah di-trim. Default 3. */
  minLength?: number;
  action?: (value: string) => Promise<unknown>;
};

type Permintaan =
  | ({ id: number; kind: "confirm"; resolve: (v: boolean) => void } & ConfirmOptions)
  | ({ id: number; kind: "prompt"; resolve: (v: string | null) => void } & PromptOptions);

let nextId = 1;
let tampilkan: ((p: Permintaan) => void) | null = null;
const tertunda: Permintaan[] = [];

function kirim(p: Permintaan) {
  if (tampilkan) tampilkan(p);
  else tertunda.push(p);
}

export const dialog = {
  /** true bila pengguna menyetujui (dan `action`, bila ada, berhasil). */
  confirm(o: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => kirim({ ...o, id: nextId++, kind: "confirm", resolve }));
  },
  /** Isi yang sudah di-trim, atau null bila dibatalkan. */
  prompt(o: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => kirim({ ...o, id: nextId++, kind: "prompt", resolve }));
  },
};

/** Dipasang sekali di layout akar. */
export function DialogHost() {
  const [antrean, setAntrean] = useState<Permintaan[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    tampilkan = (p) => setAntrean((a) => [...a, p]);
    if (tertunda.length) setAntrean((a) => [...a, ...tertunda.splice(0)]);
    return () => {
      tampilkan = null;
    };
  }, []);

  if (!mounted || antrean.length === 0) return null;

  const selesai = (id: number) => setAntrean((a) => a.filter((p) => p.id !== id));

  return createPortal(
    <div className="relative z-[60]">
      {antrean.map((p) => (
        <DialogPanel key={p.id} p={p} onDone={() => selesai(p.id)} />
      ))}
    </div>,
    document.body,
  );
}

function DialogPanel({ p, onDone }: { p: Permintaan; onDone: () => void }) {
  const [nilai, setNilai] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const isianRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (p.kind === "prompt") isianRef.current?.focus();
    else tombolRef.current?.focus();
  }, [p.kind]);

  function batal() {
    if (busy) return;
    if (p.kind === "prompt") p.resolve(null);
    else p.resolve(false);
    onDone();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        batal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function kirimForm(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    let isi = "";
    if (p.kind === "prompt") {
      isi = nilai.trim();
      const min = p.minLength ?? 3;
      if (isi === "") {
        setError(`${p.label} wajib diisi.`);
        isianRef.current?.focus();
        return;
      }
      if (isi.length < min) {
        setError(`${p.label} minimal ${min} karakter.`);
        isianRef.current?.focus();
        return;
      }
    }

    if (p.action) {
      setBusy(true);
      try {
        if (p.kind === "prompt") await p.action(isi);
        else await p.action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tindakan gagal. Silakan coba lagi.");
        setBusy(false);
        return;
      }
    }

    if (p.kind === "prompt") p.resolve(isi);
    else p.resolve(true);
    onDone();
  }

  const pesan =
    typeof p.message === "string" ? (
      <p className="whitespace-pre-line text-[12px] leading-relaxed text-km-ink-soft">{p.message}</p>
    ) : (
      p.message
    );

  return (
    <Modal
      title={p.title}
      onClose={batal}
      onSubmit={kirimForm}
      testId="dialog-aplikasi"
      footer={
        <>
          <Button type="button" onClick={batal} disabled={busy}>
            {p.cancelLabel ?? "Batal"}
          </Button>
          <Button
            ref={tombolRef}
            type="submit"
            variant={p.tone ?? "primary"}
            disabled={busy}
            data-testid="dialog-konfirmasi"
          >
            {busy ? "Memproses…" : (p.confirmLabel ?? "Ya")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {pesan}
        {p.kind === "prompt" && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-km-ink">
              {p.label} <span className="text-km-red">*</span>
            </span>
            <textarea
              ref={isianRef}
              value={nilai}
              onChange={(e) => {
                setNilai(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              placeholder={p.placeholder}
              disabled={busy}
              data-testid="dialog-isian"
              className="w-full rounded-lg border border-km-border-strong bg-km-panel px-3 py-2 text-[12px] text-km-ink outline-none focus:border-km-accent"
            />
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
