"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  fallback?: React.ReactNode;
};

/**
 * Image that fetches via Authorization: Bearer header and renders the
 * resulting blob via an object URL. Use this for protected image endpoints
 * (e.g. tukar-faktur photo, penerimaan/pembayaran attachments) where the
 * browser can't attach the Sanctum token to a plain <img src>.
 */
export function AuthImage({ src, fallback, alt = "", ...rest }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    const token = getToken();
    fetch(src, {
      headers: {
        Accept: "image/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal muat gambar");
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  if (error) {
    return <>{fallback ?? <div className="flex h-full w-full items-center justify-center text-[11px] text-km-red-ink">{error}</div>}</>;
  }
  if (!objectUrl) {
    return <>{fallback ?? <div className="flex h-full w-full items-center justify-center text-[11px] text-km-ink-muted">Memuat…</div>}</>;
  }
  return <img src={objectUrl} alt={alt} {...rest} />;
}
