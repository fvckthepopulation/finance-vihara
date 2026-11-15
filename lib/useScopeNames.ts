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
  /** Nama & kode yayasan dalam jangkauan akun (judul laporan tingkat yayasan). */
  yayasan: { name: string; code: string };
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

  const entities = data?.entities ?? [];

  return {
    entities,
    viharas: data?.viharas ?? [],
    ready: data != null,
    viharaName: (id) =>
      id == null ? null : (data?.viharas.find((v) => v.id === id)?.name ?? null),
    yayasan: yayasanLabel(data == null, entities),
  };
}

/**
 * Nama & kode yayasan dalam jangkauan akun, untuk judul laporan tingkat
 * yayasan (FV-65). Dulu ditulis tetap "Yayasan Dhammavihara Indonesia".
 * Satu yayasan → namanya; beberapa (akun global) → digabung; belum termuat
 * → penanda netral, bukan nama yayasan tertentu.
 */
export function yayasanLabel(loading: boolean, entities: ScopeEntity[]): { name: string; code: string } {
  if (loading) return { name: "Memuat…", code: "" };
  if (entities.length === 0) return { name: "Yayasan", code: "" };
  if (entities.length === 1) return { name: entities[0].legal_name, code: entities[0].code };
  // Urut kode, sama dengan judul Konsolidasi (FV-63), supaya kedua laporan
  // menyebut gabungan yayasan dengan urutan yang sama.
  const urut = [...entities].sort((a, b) => a.code.localeCompare(b.code));
  return {
    name: urut.map((e) => e.legal_name).join(" + "),
    code: urut.map((e) => e.code).join("+"),
  };
}
