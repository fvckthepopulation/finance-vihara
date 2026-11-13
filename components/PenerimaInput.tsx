"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/Field";
import { SaranPenerima, suggestPenerima, tambahPenerimaCepat } from "@/lib/penerima";

// ============================================================================
// Isian "Dibayarkan kepada / PIC" dengan saran dari master (FV-31).
//
// Aturan yang membentuk komponen ini:
//   • teks bebas tetap sah — pengeluaran harus bisa disimpan untuk penerima
//     yang belum ada di master sama sekali;
//   • saran muncul saat mengetik, tanpa membedakan huruf besar/kecil;
//   • kalau yang diketik belum ada, ditawarkan "+ Tambahkan ke master";
//   • kalau yang diketik sama persis dengan master (tanpa membedakan besar
//     kecil), yang dipakai baris master itu — bukan baris kedua. Itu persis
//     keluhannya: "Fotocopy", "fotocopy", "Toko Fotocopy" jadi tiga vendor.
//
// Nilai yang keluar ada dua: nama (selalu) dan id master (kalau cocok), yang
// dikirim form sebagai payee_name + payee_id.
// ============================================================================

export function PenerimaInput({
  value,
  payeeId,
  onChange,
  disabled,
  onError,
}: {
  value: string;
  payeeId: number | null;
  onChange: (nama: string, payeeId: number | null) => void;
  disabled?: boolean;
  onError?: (pesan: string) => void;
}) {
  const [saran, setSaran] = useState<SaranPenerima[]>([]);
  const [buka, setBuka] = useState(false);
  const [pending, setPending] = useState(false);
  const wadah = useRef<HTMLDivElement | null>(null);

  // Tutup saat klik di luar — tanpa ini daftar saran menutupi field lain.
  useEffect(() => {
    function diLuar(e: MouseEvent) {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(false);
    }
    document.addEventListener("mousedown", diLuar);
    return () => document.removeEventListener("mousedown", diLuar);
  }, []);

  // Ambil saran dari server, dengan jeda supaya tiap ketikan tidak jadi satu
  // permintaan.
  useEffect(() => {
    const kata = value.trim();
    if (!buka) return;
    const timer = setTimeout(() => {
      suggestPenerima(kata)
        .then(setSaran)
        .catch(() => setSaran([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [value, buka]);

  const kataBersih = value.trim();
  const cocokPersis = saran.find((s) => s.name.toLowerCase() === kataBersih.toLowerCase());
  const bisaTambah = kataBersih.length >= 2 && !cocokPersis;

  // Nama diketik ulang sampai persis sama dengan satu baris master → pakai
  // baris itu, tanpa perlu diklik.
  useEffect(() => {
    if (cocokPersis && payeeId !== cocokPersis.id) {
      onChange(cocokPersis.name, cocokPersis.id);
    }
    // onChange sengaja tidak jadi dependensi: pemanggil membuat fungsi baru
    // tiap render, dan itu akan membuat efek ini berjalan tanpa henti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cocokPersis?.id, payeeId]);

  async function tambahKeMaster() {
    setPending(true);
    try {
      const p = await tambahPenerimaCepat(kataBersih);
      onChange(p.name, p.id);
      setSaran((s) => (s.some((x) => x.id === p.id) ? s : [p, ...s]));
      setBuka(false);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Gagal menambahkan penerima");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative" ref={wadah}>
      <Input
        data-testid="form-penerima"
        value={value}
        disabled={disabled}
        placeholder="Nama vendor / penerima"
        autoComplete="off"
        onFocus={() => setBuka(true)}
        onChange={(e) => {
          // Mengetik ulang memutus kaitan ke master sampai cocok lagi.
          onChange(e.target.value, null);
          setBuka(true);
        }}
      />
      {payeeId != null && (
        <span
          data-testid="penerima-terkait"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-km-green-soft px-1.5 py-0.5 text-[10px] font-medium text-km-green"
        >
          master
        </span>
      )}

      {buka && (saran.length > 0 || bisaTambah) && (
        <div
          data-testid="saran-penerima"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-km-border bg-km-panel shadow-lg"
        >
          {saran.map((s) => (
            <button
              key={s.id}
              type="button"
              data-testid={`saran-penerima-${s.id}`}
              className="block w-full px-3 py-2 text-left text-[12px] text-km-ink hover:bg-km-panel-soft"
              onClick={() => {
                onChange(s.name, s.id);
                setBuka(false);
              }}
            >
              {s.name}
              {s.bank_account_number && (
                <span className="ml-1.5 text-[10.5px] text-km-ink-muted">
                  {s.bank_name} {s.bank_account_number}
                </span>
              )}
            </button>
          ))}
          {bisaTambah && (
            <button
              type="button"
              data-testid="tambah-penerima-master"
              disabled={pending}
              onClick={tambahKeMaster}
              className="block w-full border-t border-km-border px-3 py-2 text-left text-[12px] font-medium text-km-blue hover:bg-km-panel-soft disabled:opacity-60"
            >
              {pending ? "Menambahkan…" : `+ Tambahkan "${kataBersih}" ke master`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
