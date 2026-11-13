// Pill tag kategori dana/biaya — warna persis mockup vihara-finance.html.

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  // Kategori dana (penerimaan)
  dana_perayaan: { bg: "#FFF0E6", color: "#B85C00" },
  dana_operasional: { bg: "#E8F4FD", color: "#1A5C8A" },
  dana_bhikkhu: { bg: "#F0EAF8", color: "#5B3E8C" },
  dana_paramita: { bg: "#E8F8F0", color: "#1A6B40" },
  // Kategori biaya (pengeluaran)
  biaya_operasional: { bg: "#E8F0F8", color: "#1A4A7A" }, // tag-blue
  biaya_bhikkhu: { bg: "#F0EAF8", color: "#5B3E8C" }, // tag-purple
  biaya_perayaan: { bg: "#FAEEDA", color: "#854F0B" }, // tag-amber
  biaya_paramita: { bg: "#E6F5EE", color: "#1A6B4A" }, // tag-green
};

export const DANA_CATEGORY_LABEL: Record<string, string> = {
  dana_bhikkhu: "Dana Bhikkhu",
  dana_operasional: "Dana Operasional",
  dana_paramita: "Dana Paramita",
  dana_perayaan: "Dana Perayaan",
  donasi_belum_teridentifikasi: "Donasi Belum Teridentifikasi",
  biaya_bhikkhu: "Biaya Bhikkhu",
  biaya_operasional: "Biaya Operasional",
  biaya_paramita: "Biaya Paramita",
  biaya_perayaan: "Biaya Perayaan",
  komisi_platform: "Komisi Platform",
  utang_lain: "Utang Lain",
  biaya_lainnya: "Biaya Lainnya",
};

export function danaCategoryLabel(category: string): string {
  return (
    DANA_CATEGORY_LABEL[category] ??
    category
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ")
  );
}

/** Kategori biaya → kategori dana yang didebet (biaya_bhikkhu → dana_bhikkhu). */
/**
 * Sejak draft boleh belum punya kategori (siklus draft → persetujuan),
 * nilainya bisa null. Satu draft setengah jadi tidak boleh membuat seluruh
 * tabel gagal dirender.
 */
export function debetDanaCategory(biayaCategory: string | null | undefined): string {
  if (!biayaCategory) return "";
  return biayaCategory.startsWith("biaya_")
    ? biayaCategory.replace(/^biaya_/, "dana_")
    : biayaCategory;
}

export function DanaTag({
  category,
  label,
}: {
  category: string | null | undefined;
  /** Teks tag; default dari kamus label kategori. */
  label?: string;
}) {
  // Kategori kosong (draft belum lengkap) ditampilkan sebagai strip, bukan
  // tag kosong tanpa makna.
  if (!category) {
    return <span className="text-[11px] text-km-ink-muted">—</span>;
  }
  const style = TAG_STYLE[category];
  const text = label ?? danaCategoryLabel(category);
  if (!style) {
    // Fallback abu-abu (mis. donasi_belum_teridentifikasi, komisi_platform).
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-km-border bg-km-bg px-2 py-0.5 text-[11px] font-medium text-km-ink-muted">
        {text}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {text}
    </span>
  );
}

/** Tag abu-abu netral (mis. metode Tunai/Transfer Bank). */
export function GrayTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-km-border bg-km-bg px-2 py-0.5 text-[11px] font-medium text-km-ink-muted">
      {children}
    </span>
  );
}
