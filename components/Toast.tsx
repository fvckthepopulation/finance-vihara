"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Tone = "success" | "error" | "info";

const TONE: Record<Tone, string> = {
  success: "bg-km-teal-soft text-km-teal-ink",
  error: "bg-km-red-soft text-km-red-ink",
  info: "bg-km-blue-soft text-km-blue-ink",
};

/**
 * Floating toast pinned to the bottom-right, rendered through a portal to
 * <body> so it's never clipped by an ancestor. Auto-dismiss is the caller's
 * job (e.g. a setTimeout that clears the message); pass onClose for the ✕.
 */
export function Toast({
  message,
  tone = "success",
  onClose,
}: {
  message: string;
  tone?: Tone;
  onClose?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-4 sm:inset-x-auto sm:right-4 sm:justify-end">
      <div
        role="status"
        className={`pointer-events-auto flex items-center gap-3 rounded-lg border border-km-border px-4 py-3 text-[12px] font-medium shadow-lg ${TONE[tone]}`}
        style={{ animation: "km-toast-in 160ms ease-out" }}
      >
        <span>{tone === "success" ? "✓ " : ""}{message}</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Tutup" className="opacity-60 hover:opacity-100">✕</button>
        )}
      </div>
      <style>{`@keyframes km-toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>,
    document.body,
  );
}
