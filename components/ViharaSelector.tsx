"use client";

import { useEffect, useState } from "react";
import { listViharas, Vihara } from "@/lib/vihara";
import { useVihara } from "@/lib/useVihara";
import { useAuth } from "@/lib/useAuth";

// Pemilih vihara di topbar, mengikuti hirarki akses:
//   - mode yayasan tunggal      -> tidak tampil sama sekali;
//   - user terkunci 1 vihara    -> chip label statis nama viharanya;
//   - user >1 vihara / yayasan  -> <select> berisi HANYA vihara yang boleh
//                                  diakses (API /api/viharas sudah ter-scope,
//                                  jadi daftar ini tidak pernah bocor).

let viharaCache: Vihara[] | null = null;
let viharaPending: Promise<Vihara[]> | null = null;

export function resetViharaCache() {
  viharaCache = null;
  viharaPending = null;
}

async function loadAllViharas(): Promise<Vihara[]> {
  if (viharaCache) return viharaCache;
  if (!viharaPending) {
    viharaPending = (async () => {
      const all: Vihara[] = [];
      let page = 1;
      // Paginator Laravel — ambil semua halaman (dibatasi 10 utk jaga-jaga).
      for (;;) {
        const res = await listViharas({ page });
        all.push(...res.data);
        if (page >= res.last_page || page >= 10) break;
        page += 1;
      }
      viharaCache = all;
      return all;
    })().finally(() => {
      viharaPending = null;
    });
  }
  return viharaPending;
}

export function ViharaSelector() {
  const { viharaId, fixed, allowedIds, selectable, ready, setViharaId } = useVihara();
  const { user } = useAuth();
  const [viharas, setViharas] = useState<Vihara[]>(viharaCache ?? []);

  const singleEntityMode = user?.app?.single_entity_mode ?? false;

  useEffect(() => {
    if (!ready || singleEntityMode) return;
    let alive = true;
    loadAllViharas()
      .then((v) => {
        if (alive) setViharas(v);
      })
      .catch(() => {
        // Daftar bisa ditolak — chip tetap punya fallback di bawah.
      });
    return () => {
      alive = false;
    };
  }, [ready, singleEntityMode]);

  if (!ready) return null;

  // Yayasan tunggal: konsep multi-vihara tidak relevan.
  if (singleEntityMode) return null;

  if (fixed) {
    const name =
      viharas.find((v) => v.id === viharaId)?.name ?? `Vihara #${viharaId}`;
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
