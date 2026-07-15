"use client";

type Props = {
  currentPage: number;
  lastPage: number;
  total: number;
  from: number | null;
  to: number | null;
  onChange: (page: number) => void;
};

export function Pagination({ currentPage, lastPage, total, from, to, onChange }: Props) {
  if (lastPage <= 1) {
    return (
      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-km-ink-muted">
        <span>{total} baris</span>
      </div>
    );
  }

  const goto = (p: number) => {
    const clamped = Math.max(1, Math.min(lastPage, p));
    if (clamped !== currentPage) onChange(clamped);
  };

  const pageButtons = buildPageList(currentPage, lastPage);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-km-ink-soft">
      <span>
        {from ?? 0}–{to ?? 0} dari {total}
      </span>
      <div className="flex items-center gap-1">
        <NavBtn label="‹" disabled={currentPage <= 1} onClick={() => goto(currentPage - 1)} />
        {pageButtons.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-km-ink-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goto(p)}
              className={`min-w-[28px] rounded-md border px-2 py-1 font-medium transition ${
                p === currentPage
                  ? "border-km-blue bg-km-blue text-km-blue-soft"
                  : "border-km-border bg-km-panel text-km-ink hover:bg-km-panel-soft"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <NavBtn label="›" disabled={currentPage >= lastPage} onClick={() => goto(currentPage + 1)} />
      </div>
    </div>
  );
}

function NavBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-w-[28px] rounded-md border border-km-border bg-km-panel px-2 py-1 font-medium text-km-ink transition hover:bg-km-panel-soft disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function buildPageList(current: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < last - 1) out.push("…");
  out.push(last);
  return out;
}
