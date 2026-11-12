"use client";

import { useEffect, useState } from "react";
import { getMyScope, ScopeEntity, ScopeVihara } from "./api";

// ============================================================================
// Nama yayasan & vihara dalam jangkauan akun, untuk DITAMPILKAN.
//
// Sengaja lewat /api/my-scope, bukan /api/viharas: endpoint master itu dijaga
// izin `masters.view`, dan role operasional buatan tangan sering tidak
// memilikinya. Dulu akibatnya badge di header jatuh ke penanda darurat
// "Vihara #1" — pengguna tidak tahu sedang bekerja di vihara mana.
//
// Cache di tingkat modul: dipakai beberapa komponen pada halaman yang sama,
// dan isinya tidak berubah selama sesi.
// ============================================================================

let cache: { entities: ScopeEntity[]; viharas: ScopeVihara[] } | null = null;
let pending: Promise<{ entities: ScopeEntity[]; viharas: ScopeVihara[] }> | null = null;

export function resetScopeNames() {
  cache = null;
  pending = null;
}

function load() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = getMyScope()
      .then((d) => {
        cache = d;
        return d;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

export function useScopeNames(): {
  entities: ScopeEntity[];
  viharas: ScopeVihara[];
  ready: boolean;
  /** Nama vihara, atau null bila belum/tidak diketahui. */
  viharaName: (id: number | null | undefined) => string | null;
} {
  const [data, setData] = useState(cache);

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && setData(d))
      .catch(() => {
        /* biarkan null — pemanggil menyiapkan tampilan tanpa nama */
      });
    return () => {
      alive = false;
    };
  }, []);

  return {
    entities: data?.entities ?? [],
    viharas: data?.viharas ?? [],
    ready: data != null,
    viharaName: (id) =>
      id == null ? null : (data?.viharas.find((v) => v.id === id)?.name ?? null),
  };
}
