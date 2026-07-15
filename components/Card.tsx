import { HTMLAttributes, ReactNode } from "react";

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-km-border bg-km-panel ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  right,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-km-border px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-km-ink">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-km-ink-muted">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3 ${className}`}
    >
      {children}
    </div>
  );
}
