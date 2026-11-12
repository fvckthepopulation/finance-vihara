"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Select } from "@/components/Field";
import { getMyScope, ScopeEntity, ScopeVihara } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Pasangan field Yayasan -> Vihara untuk form transaksi.
//
// Sengaja TIDAK memakai pilihan vihara di header: header itu alat baca
// (menyaring tampilan), sedangkan transaksi harus menyatakan tujuannya
// sendiri. Kalau transaksi ikut header, admin yang lupa mengganti header
// mencatat ke vihara yang salah tanpa pernah melihat kesalahannya.
//
// Sumber datanya /api/my-scope, BUKAN /api/entities + /api/viharas. Kedua
// endpoint itu master data dan dijaga izin `entities.view` / `masters.view`;
// role operasional buatan sendiri sering tidak memilikinya, dan dulu itu
// membuat kedua dropdown ini terkunci DAN kosong tanpa penjelasan — akun
// yang jelas punya satu vihara jadi tidak bisa bertransaksi sama sekali.
//
// Penguncian mengikuti users.scope_type dan hanya di tataran tampilan;
// penegakan sebenarnya tetap di API (ViharaScopeService):
//
//   global -> dua-duanya bebas.
//   entity -> Yayasan terkunci ke yayasannya; Vihara bebas di dalamnya.
//   vihara -> Yayasan terkunci; Vihara terbatas pada vihara miliknya,
//             dan terkunci juga bila ia hanya memegang satu.
// ============================================================================

export type YayasanViharaValue = {
  entityId: number | null;
  viharaId: number | null;
};

export function YayasanViharaFields({
  value,
  onChange,
  disabled = false,
}: {
  value: YayasanViharaValue;
  onChange: (next: YayasanViharaValue) => void;
  disabled?: boolean;
}) {
  const { user, loading: authLoading } = useAuth();

  const [entities, setEntities] = useState<ScopeEntity[]>([]);
  const [viharas, setViharas] = useState<ScopeVihara[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const entityLocked = !authLoading && user?.scope_type !== "global";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getMyScope()
      .then((d) => {
        if (!alive) return;
        setEntities(d.entities);
        setViharas(d.viharas);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setEntities([]);
        setViharas([]);
        // Kegagalan dimunculkan, bukan ditelan: dropdown kosong tanpa sebab
        // justru yang membuat pengguna buntu di laporan sebelumnya.
        setError(e instanceof Error ? e.message : "Gagal memuat jangkauan akses");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const viharasOfEntity = useMemo(
    () =>
      value.entityId == null
        ? []
        : viharas.filter((v) => v.entity_id === value.entityId),
    [viharas, value.entityId],
  );

  // Field TIDAK dinonaktifkan hanya karena pilihannya satu. Pengguna tetap
  // boleh membukanya untuk melihat vihara mana yang dipakai — itu justru
  // yang hilang pada laporan sebelumnya: field terkunci dan kosong, sehingga
  // tidak jelas transaksi akan tercatat ke mana. Yang satu-satunya itu
  // dipilihkan otomatis, bukan dikunci.
  const satuYayasan = entities.length === 1;
  const satuVihara = viharasOfEntity.length === 1;

  // Satu-satunya pilihan yang mungkin → pilih sendiri. Pengguna dengan satu
  // vihara langsung bisa lanjut ke field berikutnya.
  useEffect(() => {
    if (loading) return;
    if (value.entityId == null && entities.length === 1) {
      onChange({ entityId: entities[0].id, viharaId: null });
    }
  }, [loading, entities, value.entityId, onChange]);

  useEffect(() => {
    if (loading || value.entityId == null || value.viharaId != null) return;
    if (viharasOfEntity.length === 1) {
      onChange({ entityId: value.entityId, viharaId: viharasOfEntity[0].id });
    }
  }, [loading, viharasOfEntity, value.entityId, value.viharaId, onChange]);

  // Mengganti yayasan membuang vihara yang sudah dipilih — vihara lama
  // hampir pasti bukan milik yayasan yang baru.
  function handleEntity(raw: string) {
    const next = raw ? Number(raw) : null;
    if (next === value.entityId) return;
    onChange({ entityId: next, viharaId: null });
  }

  const hintYayasan = error
    ? error
    : satuYayasan && entityLocked
      ? "Hanya yayasan ini yang ada dalam jangkauan akses Anda."
      : undefined;
  const hintVihara = error
    ? undefined
    : satuVihara
      ? "Hanya vihara ini yang ada dalam jangkauan akses Anda."
      : undefined;

  return (
    <>
      <Field label="Yayasan *" hint={hintYayasan}>
        <Select
          required
          data-testid="form-yayasan"
          disabled={disabled || loading || entities.length === 0}
          value={value.entityId ?? ""}
          onChange={(e) => handleEntity(e.target.value)}
        >
          {value.entityId == null && (
            <option value="">
              {loading
                ? "Memuat…"
                : entities.length === 0
                  ? "— Tidak ada yayasan —"
                  : "— Pilih yayasan —"}
            </option>
          )}
          {entities.map((en) => (
            <option key={en.id} value={en.id}>
              {en.legal_name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Vihara *" hint={hintVihara}>
        <Select
          required
          data-testid="form-vihara"
          disabled={disabled || loading || value.entityId == null || viharasOfEntity.length === 0}
          value={value.viharaId ?? ""}
          onChange={(e) =>
            onChange({
              entityId: value.entityId,
              viharaId: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          {value.viharaId == null && (
            <option value="">
              {loading
                ? "Memuat…"
                : value.entityId == null
                  ? "— Pilih yayasan dulu —"
                  : viharasOfEntity.length === 0
                    ? "— Tidak ada vihara —"
                    : "— Pilih vihara —"}
            </option>
          )}
          {viharasOfEntity.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
