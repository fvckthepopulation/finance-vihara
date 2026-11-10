"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

// ============================================================================
// Pemilih vihara (hirarki Yayasan -> Vihara) — module store + hook.
//
// Tiga kemungkinan, mengikuti users.scope_type di API:
//
//   scope global  -> boleh semua vihara; pilihan null = "Semua Vihara".
//   scope entity  -> boleh semua vihara di yayasannya; null = "Semua Vihara"
//                    (sebatas yayasan itu — API yang membatasi, bukan UI).
//   scope vihara  -> hanya vihara di `vihara_ids`:
//                      1 vihara  -> terkunci (fixed), tidak bisa diganti.
//                      >1 vihara -> boleh berpindah, TAPI hanya di antara
//                                   vihara miliknya; null = semua miliknya.
//
// Pilihan disimpan di localStorage `vf_vihara`. Pilihan yang tidak lagi
// diizinkan (mis. user dipindah vihara) otomatis dibuang.
// ============================================================================

const STORAGE_KEY = "vf_vihara";

let selected: number | null = null;
let initialized = false;
const listeners = new Set<(v: number | null) => void>();

function initFromStorage() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  selected = Number.isFinite(n) && n > 0 ? n : null;
}

/** Set pilihan vihara global. null = semua vihara yang boleh diakses. */
export function setSelectedVihara(id: number | null) {
  selected = id;
  if (typeof window !== "undefined") {
    if (id == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(id));
  }
  listeners.forEach((cb) => cb(id));
}

export type UseVihara = {
  /** Vihara aktif untuk fetch (`vihara_id` param). null = semua yang boleh. */
  viharaId: number | null;
  /** true bila user terkunci ke tepat satu vihara (tidak bisa ganti). */
  fixed: boolean;
  /** Daftar id vihara yang boleh dipilih. null = tanpa batas. */
  allowedIds: number[] | null;
  /** true bila pemilih vihara layak ditampilkan sama sekali. */
  selectable: boolean;
  /** true setelah info auth selesai dimuat (fixed/viharaId sudah final). */
  ready: boolean;
  setViharaId: (id: number | null) => void;
};

export function useVihara(): UseVihara {
  initFromStorage();
  const { user, loading } = useAuth();
  const [sel, setSel] = useState<number | null>(selected);

  useEffect(() => {
    // Sinkronkan bila store berubah antara render pertama dan mount.
    setSel(selected);
    listeners.add(setSel);
    return () => {
      listeners.delete(setSel);
    };
  }, []);

  const allowedIds = user?.vihara_ids ?? null;
  const singleEntityMode = user?.app?.single_entity_mode ?? false;

  // Terkunci bila hanya punya tepat satu vihara, atau instance ini memang
  // yayasan tunggal tanpa cabang.
  const lockedId =
    allowedIds != null && allowedIds.length === 1 ? allowedIds[0] : null;
  const fixed = lockedId != null;

  // Buang pilihan tersimpan yang sudah tidak diizinkan.
  const effective =
    sel != null && allowedIds != null && !allowedIds.includes(sel) ? null : sel;

  useEffect(() => {
    if (!loading && sel != null && allowedIds != null && !allowedIds.includes(sel)) {
      setSelectedVihara(null);
    }
  }, [loading, sel, allowedIds]);

  const selectable =
    !singleEntityMode && !fixed && (allowedIds == null || allowedIds.length > 1);

  return {
    viharaId: fixed ? lockedId : effective,
    fixed,
    allowedIds,
    selectable,
    ready: !loading,
    setViharaId: setSelectedVihara,
  };
}
