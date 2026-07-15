# E2E Tests — Playwright (Vihara Finance)

Suite e2e untuk modul keuangan vihara multi-tenant. Spec aktif ada di
`e2e/scenarios/` (prefiks `vNN-*`). Spec era sebelumnya diarsipkan di
`e2e/_legacy/` dan **tidak** dijalankan (testDir di `playwright.config.ts`
menunjuk ke `e2e/scenarios`).

## Prerequisites

```bash
# Backend (Laravel) di :8500
cd ~/Projects/vihara-finance-api && php artisan serve --port=8500

# Frontend (Next.js) di :3500
cd ~/Projects/vihara-finance-web && npm run dev

# DB sudah ter-seed (viharas, rekening bank, PIC kas kecil, RBAC users).
# JANGAN migrate:fresh di tengah pemakaian — data test akumulatif & idempotent.
```

## Run

```bash
npx playwright test --reporter=line          # seluruh suite (headless)
npx playwright test e2e/scenarios/v21*       # satu file
npm run test:e2e:ui                          # interactive UI
```

Konfigurasi: `workers: 1` (sequential, shared DB), baseURL `http://localhost:3500`
(override via `E2E_BASE_URL`).

## Suite map

| File | Cakupan |
|------|---------|
| `v00-auth.spec.ts` | Login sukses/gagal, logout, redirect halaman terproteksi → /login |
| `v01-nav-smoke.spec.ts` | Semua halaman render judul topbar benar (admin); placeholder "Modul belum aktif" (/cetak, /konsolidasi) |
| `v02-vihara-selector.spec.ts` | Select "Pilih vihara" (Semua Vihara + 3 vihara), persist antar halaman; bendahara: chip statis, form tidak terblokir |
| `v10-penerimaan.spec.ts` | Hint blokir saat "Semua Vihara", cascade kategori→nama, Transfer Bank → Rekening Tujuan, submit tunai → toast + "Penerimaan Hari Ini" |
| `v11-pengeluaran.spec.ts` | Cascade kategori biaya→nama, submit via rekening BCA → toast + "Pengeluaran Hari Ini" + tag dana |
| `v12-riwayat.spec.ts` | Pencarian transaksi baru, filter tipe Pengeluaran (nominal minus), Export CSV `transaksi_vihara.csv`, footer Masuk/Keluar |
| `v13-dana-umat.spec.ts` | 4 tab dana render; penerimaan Dana Paramita menambah total tab (assert delta) |
| `v20-kas-bank.spec.ts` | Kartu rekening BCA+Mandiri, kas kecil Lili/Epi, tombol → /petty-cash, filter mutasi per rekening |
| `v21-petty-cash.spec.ts` | Ringkasan per PIC; pengisian menaikkan saldo (delta), penggunaan menurunkan; filter PIC riwayat |
| `v30-rbac.spec.ts` | Viewer tanpa menu Users/Roles; bendahara: menu Input Penerimaan, chip vihara, form aktif |
| `v31-admin-vihara.spec.ts` | 3 vihara; Kelola VVG → seksi Rekening Bank + PIC Kas Kecil; tambah/nonaktif/hapus PIC |
| `v40-rekonsiliasi.spec.ts` | 3 kartu + 3 tab; alur suspense (seed → identifikasi → reklas); run bank (koran → match → apply) |
| `v50-laporan.spec.ts` | 4 tab laporan ISAK 35 render; Export Excel `LaporanISAK35_*.xlsx` |
| `v51-anggaran.spec.ts` | Set target anggaran → simpan → persist; progress bar + % |
| `v60-konsolidasi.spec.ts` | 6 tab konsolidasi yayasan; chip vihara + Total Yayasan; Perbandingan |
| `v61-cetak.spec.ts` | Preview Laporan Penerimaan Dana + Export `Laporan_*.xlsx` |
| `v70-km-integration.spec.ts` | Phase 7: kotak settled riil + Riwayat Settlement KM; lifecycle webhook paid→settle (butuh `KM_WEBHOOK_TOKEN`, lihat di bawah) |

## Test users (password `password`)

| Email | Role | Vihara |
|-------|------|--------|
| admin@vihara.test | superadmin | — (pilih via selector topbar) |
| bendahara@vvg.test | bendahara | VVG (terkunci, chip statis) |
| approver@vvg.test | approver | VVG |
| viewer@vvg.test | viewer (read-only) | VVG |

Fixtures: `e2e/fixtures/auth.ts` (login/logout, `parseRp`, `pickViharaVVG`),
`e2e/fixtures/uniq.ts` (identifier unik per run), `e2e/fixtures/select.ts`
(`selectByLabelRegex` untuk dropdown async).

## v70 — KM Integration (webhook lifecycle)

Test lifecycle v70 memanggil webhook M2M `POST /api/webhooks/km/*` langsung
dari spec (via `page.request`) memakai shared secret `KM_WEBHOOK_TOKEN` dari
`.env` backend — token ini **tidak** tersedia di browser, jadi harus di-inject
sebagai env saat menjalankan Playwright:

```bash
KM_WEBHOOK_TOKEN=$(grep KM_WEBHOOK_TOKEN ../vihara-finance-api/.env | cut -d= -f2) npx playwright test v70
```

Tanpa env tsb, test lifecycle **skip** dengan rapi (test render tab PG tetap
jalan). Drill-down "KM ↗" butuh `NEXT_PUBLIC_KM_WEB_URL` di `.env.local`
frontend (default `http://localhost:3400`).

## Notes

- Test **idempotent**: nominal di-assert sebagai **delta** (sebelum vs sesudah),
  identifier memakai `uniq()`, jadi aman dijalankan berulang tanpa reset DB.
- Form transaksi butuh vihara terpilih; test superadmin selalu memanggil
  `pickViharaVVG()` dulu. Bendahara tidak perlu (vihara tetap).
- Nominal negatif di riwayat memakai Unicode minus `−` (U+2212), bukan `-`.
- Endpoint master PIC kas kecil hanya mengembalikan PIC **aktif** — PIC yang
  dinonaktifkan hilang dari daftar UI (bukan diberi tag).
- Laporan Excel: `npm run test:e2e:report` (dari `test-results/results.json`).
