"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AuthImage } from "./AuthImage";

/**
 * Full-screen image preview overlay. Click the backdrop, the ✕, or press Esc
 * to close. Set `auth` when the src is a protected endpoint that needs the
 * Bearer token (uses AuthImage); leave it off for local object URLs.
 *
 * Rendered through a portal to <body> so the fixed overlay can't be clipped by
 * an ancestor with overflow/transform (e.g. the sticky, scrollable photo column
 * on the lengkapi-data page).
 */
export function ImageLightbox({
  src,
  alt = "",
  auth = false,
  onClose,
}: {
  src: string;
  alt?: string;
  auth?: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  const imgClass = "max-h-[90vh] max-w-[92vw] object-contain rounded-lg";

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[16px] text-white hover:bg-white/30"
      >✕</button>
      <div onClick={(e) => e.stopPropagation()}>
        {auth
          ? <AuthImage src={src} alt={alt} className={imgClass} />
          : <img src={src} alt={alt} className={imgClass} />}
      </div>
    </div>,
    document.body,
  );
}
