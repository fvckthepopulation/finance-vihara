"use client";

import { useEffect, useState } from "react";
import { listViharas, Vihara } from "@/lib/vihara";
import { useVihara } from "@/lib/useVihara";

// Selector vihara di topbar (multi-tenant):
// - superadmin → <select> "Semua Vihara" + daftar vihara;
// - user vihara tetap → chip label statis nama viharanya.

let viharaCache: Vihara[] | null = null;
let viharaPending: Promise<Vihara[]> | null = null;

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
  const { viharaId, fixed, ready, setViharaId } = useVihara();
  const [viharas, setViharas] = useState<Vihara[]>(viharaCache ?? []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    loadAllViharas()
      .then((v) => {
        if (alive) setViharas(v);
      })
      .catch(() => {
        // User vihara tetap mungkin tak boleh melihat daftar — chip pakai fallback.
      });
    return () => {
      alive = false;
    };
  }, [ready]);

  if (!ready) return null;

  if (fixed) {
    const name =
      viharas.find((v) => v.id === viharaId)?.name ?? `Vihara #${viharaId}`;
    return (
      <span
        className="inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-lg border border-km-border bg-km-accent-soft px-2.5 py-1.5 text-[12px] font-medium text-km-accent-ink"
        title={name}
      >
        {name}
      </span>
    );
  }

  return (
    <select
      value={viharaId ?? ""}
      onChange={(e) => setViharaId(e.target.value ? Number(e.target.value) : null)}
      className="max-w-[180px] rounded-lg border border-km-border-strong bg-km-panel px-2 py-1.5 text-[12px] text-km-ink"
      aria-label="Pilih vihara"
    >
      <option value="">Semua Vihara</option>
      {viharas.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
