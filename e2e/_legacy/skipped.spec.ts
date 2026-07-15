/**
 * Skipped scenarios — require Phase 2 modules (Inventory, OCR/STB, Multi-kategori Payment).
 * Each is documented with a clear TODO for when the dependency lands.
 */
import { test } from "@playwright/test";

test.describe("Phase 2 scenarios (currently skipped — feature gap)", () => {
  test.skip("S-01: Penerimaan barang & pembayaran invoice (normal)", () => {
    // Requires: PIC Gudang mobile UI, OCR upload, STB (Surat Tanda Barang) issuance,
    //           "Antrian OCR" invoice queue, PO matching. None implemented yet.
  });

  test.skip("S-02: Penerimaan barang sebagian — qty tidak sesuai SJ", () => {
    // Same dependencies as S-01 plus dispute/klaim supplier flow.
  });

  test.skip("S-03: Invoice gabungan multi-STB", () => {
    // Requires STB module + multi-STB invoice matching.
  });

  test.skip("S-06: Penerimaan konsinyasi FG terjual — PGS", () => {
    // Requires Inventory module (FG terjual recognition).
  });

  test.skip("S-07: Pelunasan piutang konsinyasi — PGS", () => {
    // Requires Inventory + AR pattern for konsinyasi (rekap bagi hasil).
  });

  test.skip("S-08: Konsinyasi + AR — GMP", () => {
    // Same dependency.
  });

  test.skip("S-09: Konsinyasi + AR — GFS", () => {
    // Same dependency.
  });

  test.skip("S-10: Penjualan toko & armada roti keliling — DS", () => {
    // Requires Inventory + POS data feed for DS entity.
  });

  test.skip("S-17: Pembayaran via 'Input Pembayaran Baru' multi-kategori", () => {
    // Requires the multi-kategori Pembayaran form from finance-rev.html mockup
    // (gaji/listrik/sewa/transport/PPh/etc.). Currently only AP invoice payments supported.
  });
});
