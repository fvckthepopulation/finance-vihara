import { ReactNode } from "react";

type Tone = "default" | "danger" | "success" | "warn";

const toneValue: Record<Tone, string> = {
  default: "text-km-ink",
  danger: "text-km-red-ink",
  success: "text-km-teal-ink",
  warn: "text-km-amber-ink",
};

export function Metric({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl bg-km-panel px-3.5 py-3 border border-km-border">
      <p className="text-[11px] text-km-ink-muted">{label}</p>
      <p className={`mt-1 text-[20px] font-medium leading-tight ${toneValue[tone]}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-km-ink-muted">{sub}</p>}
    </div>
  );
}
