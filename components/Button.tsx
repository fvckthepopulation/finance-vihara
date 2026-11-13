import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "default" | "primary" | "success" | "amber" | "danger" | "ghost";
type Size = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClass: Record<Variant, string> = {
  default:
    "bg-km-panel text-km-ink border-km-border-strong hover:bg-km-panel-soft",
  primary:
    "bg-km-accent text-km-accent-soft border-km-accent hover:bg-km-accent-deep",
  success:
    "bg-km-green text-km-green-soft border-km-green hover:bg-km-green-ink",
  amber:
    "bg-km-amber-soft text-[var(--km-amber-label)] border-km-amber hover:bg-[#FAC775]",
  danger:
    "bg-km-red text-km-red-soft border-km-red hover:bg-km-red-ink",
  ghost:
    "bg-transparent text-km-ink border-transparent hover:bg-km-panel-soft",
};

const sizeClass: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3.5 py-1.5 text-[12px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "default", size = "md", className = "", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition disabled:opacity-60 disabled:cursor-not-allowed ${variantClass[variant]} ${sizeClass[size]} ${className}`}
        {...rest}
      />
    );
  },
);
