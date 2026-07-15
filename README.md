# vihara-finance-web

Next.js 16 admin frontend for **Vihara Finance** — modul keuangan vihara
(temple treasury). Pairs with the `vihara-finance-api` backend.

Handles pencatatan penerimaan & pengeluaran, kas/bank, rekonsiliasi, kas
kecil, jurnal, dan laporan keuangan ISAK 35 (neraca, aktivitas, arus kas).
Penerimaan dana umat (donasi) akan tersinkron dari platform KalyanaMitta
pada fase berikutnya.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind v4 (palette: `--km-*`, font: DM Sans + DM Mono)
- TypeScript

## Build phases

Sidebar links to a module mean "planned", not "live". Placeholders are wired
so every nav link routes to a page (no 404s). Phase 2 lights up: Penerimaan
Dana Umat, Semua Transaksi, Laporan Penerimaan Dana, Konsolidasi Yayasan.

## Local development

```bash
cp .env.local.example .env.local       # set NEXT_PUBLIC_API_URL
yarn install
yarn dev                               # http://localhost:3500
```

Required env:

```env
NEXT_PUBLIC_API_URL=http://localhost:8500
```

## Mocks in development

- Bank rekonsiliasi: CSV import (simple format), no live BI/bank API.

Real integrations land later once flows are stable.

## Production deploy

VPS setup TBD. See the infra repo when bootstrapped.

The `NEXT_PUBLIC_API_URL` is **inlined at build time** — to point at a
different API, you must rebuild the container.

## Branches

- `main` — active development

## Related repos

- `vihara-finance-api` — Laravel backend (http://localhost:8500 in dev)

## License

See [NOTICE.md](NOTICE.md). All rights reserved.
