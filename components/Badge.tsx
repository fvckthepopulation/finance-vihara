import { HTMLAttributes } from "react";

type Tone = "success" | "warn" | "danger" | "info" | "purple" | "neutral";

const toneClass: Record<Tone, string> = {
  success: "bg-km-teal-soft text-km-teal-ink",
  warn: "bg-km-amber-soft text-km-amber-ink",
  danger: "bg-km-red-soft text-km-red-ink",
  info: "bg-km-blue-soft text-km-blue-ink",
  purple: "bg-km-purple-soft text-km-purple",
  neutral: "bg-km-panel-soft text-km-ink-soft",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${toneClass[tone]} ${className}`}
      {...rest}
    />
  );
}
