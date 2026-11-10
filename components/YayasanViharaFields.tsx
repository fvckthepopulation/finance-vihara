"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Select } from "@/components/Field";
import { listEntities, MasterEntity } from "@/lib/masters";
import { listViharas, Vihara } from "@/lib/vihara";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Pasangan field Yayasan -> Vihara untuk form transaksi.
//
// Sengaja TIDAK memakai pilihan vihara di header: header itu alat baca
// (menyaring tampilan), sedangkan transaksi harus menyatakan tujuannya
// sendiri. Kalau transaksi ikut header, admin yang lupa mengganti header
// mencatat ke vihara yang salah tanpa pernah melihat kesalahannya.
//
// Penguncian mengikuti users.scope_type, dan hanya di tataran tampilan —
// penegakan sebenarnya tetap di API (ViharaScopeService). Yang dikunci di
// sini cuma supaya pengguna tidak disuguhi pilihan yang pasti ditolak:
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

  const [entities, setEntities] = useState<MasterEntity[]>([]);
  const [viharas, setViharas] = useState<Vihara[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [viharasLoading, setViharasLoading] = useState(false);

  // Yayasan hanya bebas dipilih oleh pemegang scope global. Yang lain
  // terikat ke yayasannya sendiri — API pun hanya mengembalikan satu.
  const entityLocked = !authLoading && user?.scope_type !== "global";
  const allowedViharaIds = user?.vihara_ids ?? null;
  const viharaLocked = allowedViharaIds != null && allowedViharaIds.length === 1;

  useEffect(() => {
    let alive = true;
    setEntitiesLoading(true);
    listEntities({ active: true })
      .then((list) => alive && setEntities(list))
      .catch(() => alive && setEntities([]))
      .finally(() => alive && setEntitiesLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Satu-satunya pilihan yang mungkin → pilih sendiri, jangan menyuruh
  // pengguna menekan dropdown berisi satu baris.
  useEffect(() => {
    if (entitiesLoading || value.entityId != null) return;
    if (entities.length === 1) {
      onChange({ entityId: entities[0].id, viharaId: null });
    }
  }, [entities, entitiesLoading, value.entityId, onChange]);

  useEffect(() => {
    if (value.entityId == null) {
      setViharas([]);
      return;
    }
    let alive = true;
    setViharasLoading(true);
    listViharas({ active_only: true, entity_id: value.entityId })
      .then((res) => alive && setViharas(res.data))
      .catch(() => alive && setViharas([]))
      .finally(() => alive && setViharasLoading(false));
    return () => {
      alive = false;
    };
  }, [value.entityId]);

  // API sudah menyaring per hirarki; saringan kedua ini untuk pemegang
  // beberapa vihara, yang daftarnya lebih sempit dari yayasannya.
  const selectableViharas = useMemo(
    () =>
      allowedViharaIds == null
        ? viharas
        : viharas.filter((v) => allowedViharaIds.includes(v.id)),
    [viharas, allowedViharaIds],
  );

  useEffect(() => {
    if (viharasLoading || value.viharaId != null || selectableViharas.length !== 1) return;
    onChange({ entityId: value.entityId, viharaId: selectableViharas[0].id });
  }, [selectableViharas, viharasLoading, value.entityId, value.viharaId, onChange]);

  // Mengganti yayasan membuang vihara yang sudah dipilih — vihara lama
  // hampir pasti bukan milik yayasan yang baru.
  function handleEntity(raw: string) {
    const next = raw ? Number(raw) : null;
    if (next === value.entityId) return;
    onChange({ entityId: next, viharaId: null });
  }

  return (
    <>
      <Field
        label="Yayasan *"
        hint={entityLocked ? "Mengikuti yayasan akun Anda." : undefined}
      >
        <Select
          required
          data-testid="form-yayasan"
          disabled={disabled || entityLocked || entitiesLoading}
          value={value.entityId ?? ""}
          onChange={(e) => handleEntity(e.target.value)}
        >
          <option value="">
            {entitiesLoading ? "Memuat…" : "— Pilih yayasan —"}
          </option>
          {entities.map((en) => (
            <option key={en.id} value={en.id}>
              {en.legal_name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Vihara *"
        hint={viharaLocked ? "Akun Anda terikat pada satu vihara." : undefined}
      >
        <Select
          required
          data-testid="form-vihara"
          disabled={disabled || viharaLocked || value.entityId == null || viharasLoading}
          value={value.viharaId ?? ""}
          onChange={(e) =>
            onChange({
              entityId: value.entityId,
              viharaId: e.target.value ? Number(e.target.value) : null,
            })
          }
        >
          <option value="">
            {value.entityId == null
              ? "— Pilih yayasan dulu —"
              : viharasLoading
                ? "Memuat…"
                : selectableViharas.length === 0
                  ? "— Tidak ada vihara —"
                  : "— Pilih vihara —"}
          </option>
          {selectableViharas.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
