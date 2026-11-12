"use client";

import { useVihara } from "@/lib/useVihara";
import { useAuth } from "@/lib/useAuth";
import { useScopeNames } from "@/lib/useScopeNames";

// Pemilih vihara di topbar, mengikuti hirarki akses:
//   - mode yayasan tunggal      -> tidak tampil sama sekali;
//   - user terkunci 1 vihara    -> chip label statis nama viharanya;
//   - user >1 vihara / yayasan  -> <select> berisi HANYA vihara yang boleh
//                                  diakses (/api/my-scope sudah dibatasi ke
//                                  jangkauan akun, jadi tidak pernah bocor).

export function ViharaSelector() {
  const { viharaId, fixed, allowedIds, selectable, ready, setViharaId } = useVihara();
  const { user } = useAuth();
  // Nama diambil dari jangkauan akses akun, bukan dari katalog master:
  // /api/viharas butuh izin `masters.view` yang banyak role operasional
  // tidak punya, dan dulu itu membuat badge ini berbunyi "Vihara #1".
  const { viharas, viharaName } = useScopeNames();

  const singleEntityMode = user?.app?.single_entity_mode ?? false;

  if (!ready) return null;

  // Yayasan tunggal: konsep multi-vihara tidak relevan.
  if (singleEntityMode) return null;

  if (fixed) {
    // Selagi nama belum sampai, jangan tampilkan penanda darurat berisi id —
    // itu justru yang dikeluhkan. Chip menunggu sebentar.
    const name = viharaName(viharaId);
    if (!name) return null;
    return (
      <span
        data-testid="vihara-fixed"
        className="inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-lg border border-km-border bg-km-accent-soft px-2.5 py-1.5 text-[12px] font-medium text-km-accent-ink"
        title={name}
      >
        {name}
      </span>
    );
  }

  if (!selectable) return null;

  // Hanya tawarkan vihara yang benar-benar boleh diakses user.
  const options =
    allowedIds == null ? viharas : viharas.filter((v) => allowedIds.includes(v.id));

  return (
    <select
      data-testid="vihara-selector"
      value={viharaId ?? ""}
      onChange={(e) => setViharaId(e.target.value ? Number(e.target.value) : null)}
      className="max-w-[180px] rounded-lg border border-km-border-strong bg-km-panel px-2 py-1.5 text-[12px] text-km-ink"
      aria-label="Pilih vihara"
    >
      <option value="">Semua Vihara</option>
      {options.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
