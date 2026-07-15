"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

// ============================================================================
// Vihara selector (multi-tenant) — module store + hook.
//
// - User dengan vihara_id tetap → selalu terkunci ke vihara itu (fixed).
// - Superadmin (vihara_id null) → pilihan disimpan di localStorage `vf_vihara`;
//   null berarti "Semua Vihara". Semua subscriber (halaman) refetch saat
//   pilihan berubah karena state module-level di-broadcast ke listener.
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

/** Set pilihan vihara global (superadmin). null = Semua Vihara. */
export function setSelectedVihara(id: number | null) {
  selected = id;
  if (typeof window !== "undefined") {
    if (id == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(id));
  }
  listeners.forEach((cb) => cb(id));
}

export type UseVihara = {
  /** Vihara aktif untuk fetch (`vihara_id` param). null = semua vihara. */
  viharaId: number | null;
  /** true bila user terkunci ke satu vihara (tidak bisa ganti). */
  fixed: boolean;
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

  const fixedId = user?.vihara_id ?? null;
  const fixed = fixedId != null;

  return {
    viharaId: fixed ? fixedId : sel,
    fixed,
    ready: !loading,
    setViharaId: setSelectedVihara,
  };
}
