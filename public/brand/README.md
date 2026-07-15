# Brand assets

Drop file ikon di sini. Komponen `BrandLogo` membacanya dari `/brand/...` dan
otomatis fallback (karakter ☸) bila file belum ada — jadi aman di-commit
walau aset menyusul.

| File | Dipakai oleh | Saran ukuran |
|---|---|---|
| `vihara-finance-logo.png` | `BrandLogo` — sidebar AppShell, login | ≥ 256×256, transparan (PNG/SVG) |

Format: PNG transparan (atau SVG untuk logo — lebih tajam). Kalau pakai SVG,
panggil `<BrandLogo src="/brand/vihara-finance-logo.svg" />`.

## Contoh pakai

```tsx
import { BrandLogo } from "@/components/BrandLogo";

<BrandLogo size={36} />
```
