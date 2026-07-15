/**
 * Generator laporan hasil E2E (standar tim) → Excel.
 *
 * Membaca hasil Playwright JSON (test-results/results.json — ditulis otomatis
 * oleh reporter "json" di playwright.config.ts) lalu menghasilkan
 * test-results/test-results-report.xlsx dengan 3 sheet:
 *   1. Ringkasan        — metrik agregat, rincian per modul, legenda status
 *   2. Detail per Skenario — satu baris per test: modul, tujuan, hasil akhir
 *   3. Known Gap        — skenario test.fail() (fitur/validasi belum ada di app)
 *
 * Mencakup SELURUH suite e2e (apa pun yang ada di results.json).
 *
 * Pakai:  npm run test:e2e:report   (jalankan e2e lalu generate)
 *   atau:  npm run e2e:report        (generate dari results.json terakhir)
 */
import ExcelJS from "exceljs";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RESULTS_JSON = join(ROOT, "test-results", "results.json");
const OUT_XLSX = join(ROOT, "test-results", "test-results-report.xlsx");

if (!existsSync(RESULTS_JSON)) {
  console.error(`✗ ${RESULTS_JSON} tidak ada. Jalankan dulu: npm run test:e2e`);
  process.exit(1);
}

// ── Ambil docstring (tujuan) dari file spec (relatif ke e2e/) ────────────────
const docCache = new Map();
function docstringFor(relFile) {
  if (docCache.has(relFile)) return docCache.get(relFile);
  const path = join(ROOT, "e2e", relFile);
  let out = "";
  if (existsSync(path)) {
    const m = readFileSync(path, "utf8").match(/\/\*\*([\s\S]*?)\*\//);
    if (m) out = m[1].split("\n").map((l) => l.replace(/^\s*\*?\s?/, "").trimEnd())
      .filter((l) => l.trim()).join(" ").replace(/\s+/g, " ").trim();
  }
  docCache.set(relFile, out);
  return out;
}

// ── Modul & kode dari path/nama file ─────────────────────────────────────────
function moduleOf(relFile) {
  const f = basename(relFile);
  if (relFile.includes("penjualan-toko") || /^sc\d/i.test(f)) return "Penjualan Toko";
  if (/^m\d/i.test(f)) return "Master / CMS";
  if (/^s\d/i.test(f)) return "Akuntansi & Flow";
  return "Lainnya";
}
function codeOf(relFile, title) {
  const fm = basename(relFile).match(/^(sc\d+\w*|m\d+\w*|s\d+\w*)/i);
  if (fm) return fm[1].toUpperCase();
  const tm = title.match(/\b([A-Z]{1,3}-?\d+\w*)\b/);
  return tm ? tm[1] : "";
}

// ── Flatten hasil Playwright JSON ────────────────────────────────────────────
const data = JSON.parse(readFileSync(RESULTS_JSON, "utf8"));
const rows = [];
function walk(suites, parentFile = "") {
  for (const s of suites ?? []) {
    const file = s.file ?? parentFile;
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const res = (t.results ?? [{}]).at(-1) ?? {};
        const known = (t.annotations ?? []).some((a) => a.type === "fail");
        const ok = res.status === t.expectedStatus || t.ok === true;
        const verdict = known ? "KNOWN GAP" : ok ? "LULUS" : "GAGAL";
        let err = "";
        for (const e of res.errors ?? []) {
          if (e.message) { err = e.message.replace(/\x1b\[[0-9;]*m/g, "").split("\n")[0]; break; }
        }
        rows.push({
          module: moduleOf(file), code: codeOf(file, spec.title), title: spec.title,
          desc: docstringFor(file), verdict, dur: Math.round((res.duration ?? 0) / 10) / 100, err,
        });
      }
    }
    walk(s.suites, file);
  }
}
walk(data.suites);

const MOD_ORDER = ["Penjualan Toko", "Master / CMS", "Akuntansi & Flow", "Lainnya"];
const modRank = (m) => { const i = MOD_ORDER.indexOf(m); return i < 0 ? 99 : i; };
const codeNum = (c) => { const m = c.match(/(\d+)/); return m ? +m[1] : 999; };
rows.sort((a, b) => modRank(a.module) - modRank(b.module) || codeNum(a.code) - codeNum(b.code) || a.title.localeCompare(b.title));

const count = (rs, v) => rs.filter((r) => r.verdict === v).length;
const nPass = count(rows, "LULUS"), nKnown = count(rows, "KNOWN GAP"), nFail = count(rows, "GAGAL");

// ── Style helpers ────────────────────────────────────────────────────────────
const C = { head: "FF1F4E78", pass: "FFE2EFDA", fail: "FFFCE4E4", known: "FFFFF2CC",
  passInk: "FF375623", failInk: "FF9C0006", knownInk: "FF9C6500", grey: "FF808080" };
const thin = { style: "thin", color: { argb: "FFD9D9D9" } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const headFill = { type: "pattern", pattern: "solid", fgColor: { argb: C.head } };
const headFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fillOf = (v) => v === "LULUS" ? C.pass : v === "GAGAL" ? C.fail : C.known;
const inkOf = (v) => v === "LULUS" ? C.passInk : v === "GAGAL" ? C.failInk : C.knownInk;
function headerRow(ws, rowIdx, labels) {
  labels.forEach((h, i) => {
    const c = ws.getCell(rowIdx, i + 1);
    c.value = h; c.fill = headFill; c.font = headFont; c.border = BORDER;
    c.alignment = { horizontal: "center", vertical: "center", wrapText: true };
  });
}

const wb = new ExcelJS.Workbook();
wb.creator = "vihara-finance-web e2e";

// ── Sheet 1: Ringkasan ───────────────────────────────────────────────────────
const ws1 = wb.addWorksheet("Ringkasan");
ws1.columns = [{ width: 28 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 14 }];
ws1.mergeCells("A1:F1");
ws1.getCell("A1").value = "Laporan Hasil Test E2E — vihara-finance-web";
ws1.getCell("A1").font = { bold: true, size: 16, color: { argb: C.head } };
ws1.getCell("A2").value = "Seluruh modul · Playwright / Chromium";
ws1.getCell("A2").font = { italic: true, color: { argb: C.grey } };
ws1.getCell("A3").value = `Dijalankan: ${(data.stats?.startTime ?? "").slice(0, 19).replace("T", " ")} UTC · Durasi ${Math.round((data.stats?.duration ?? 0) / 100) / 10}s`;
ws1.getCell("A3").font = { italic: true, color: { argb: C.grey } };

const summary = [
  ["Total skenario", rows.length],
  ["Lulus", nPass],
  ["Gagal", nFail],
  ["Known gap (diharapkan gagal)", nKnown],
  ["Tingkat kelulusan (di luar known gap)", `${Math.round((nPass / Math.max(1, rows.length - nKnown)) * 100)}%`],
  ["Status keseluruhan", nFail === 0 ? "SEMUA LULUS" : "ADA KEGAGALAN"],
];
let R = 5;
headerRow(ws1, R, ["Metrik", "Nilai"]);
summary.forEach(([k, v], i) => {
  const kc = ws1.getCell(R + 1 + i, 1), vc = ws1.getCell(R + 1 + i, 2);
  kc.value = k; kc.border = BORDER;
  vc.value = v; vc.border = BORDER; vc.alignment = { horizontal: "center" };
  if (k === "Lulus") vc.font = { bold: true, color: { argb: C.passInk } };
  if (k === "Gagal") vc.font = { bold: true, color: { argb: nFail ? C.failInk : C.passInk } };
  if (k.startsWith("Known gap")) vc.font = { bold: true, color: { argb: C.knownInk } };
  if (k === "Status keseluruhan") vc.font = { bold: true, color: { argb: nFail ? C.failInk : C.passInk } };
});

// Rincian per modul
R = R + summary.length + 2;
ws1.getCell(R, 1).value = "Rincian per modul";
ws1.getCell(R, 1).font = { bold: true };
R += 1;
headerRow(ws1, R, ["Modul", "Total", "Lulus", "Gagal", "Known gap", "Kelulusan"]);
const modules = [...new Set(rows.map((r) => r.module))].sort((a, b) => modRank(a) - modRank(b));
modules.forEach((m, i) => {
  const rs = rows.filter((r) => r.module === m);
  const p = count(rs, "LULUS"), g = count(rs, "GAGAL"), kn = count(rs, "KNOWN GAP");
  const vals = [m, rs.length, p, g, kn, `${Math.round((p / Math.max(1, rs.length - kn)) * 100)}%`];
  vals.forEach((v, j) => {
    const c = ws1.getCell(R + 1 + i, j + 1);
    c.value = v; c.border = BORDER;
    if (j > 0) c.alignment = { horizontal: "center" };
  });
  if (g > 0) { const c = ws1.getCell(R + 1 + i, 4); c.fill = solid(C.fail); c.font = { bold: true, color: { argb: C.failInk } }; }
});

// Legenda
R = R + modules.length + 2;
ws1.getCell(R, 1).value = "Keterangan status:";
ws1.getCell(R, 1).font = { bold: true };
[["LULUS", "Skenario berjalan & semua assertion benar"],
 ["GAGAL", "Skenario gagal — perlu perbaikan"],
 ["KNOWN GAP", "Sengaja test.fail() — fitur/validasi belum ada di app"]].forEach(([lab, desc], i) => {
  const c = ws1.getCell(R + 1 + i, 1);
  c.value = lab; c.fill = solid(fillOf(lab)); c.font = { bold: true, color: { argb: inkOf(lab) } };
  c.alignment = { horizontal: "center" }; c.border = BORDER;
  ws1.mergeCells(R + 1 + i, 2, R + 1 + i, 6);
  ws1.getCell(R + 1 + i, 2).value = desc;
});
ws1.views = [{ state: "frozen", ySplit: 4 }];

// ── Sheet 2: Detail per Skenario ─────────────────────────────────────────────
const ws2 = wb.addWorksheet("Detail per Skenario");
ws2.columns = [{ width: 5 }, { width: 18 }, { width: 10 }, { width: 50 }, { width: 58 }, { width: 13 }, { width: 9 }, { width: 44 }];
headerRow(ws2, 1, ["No", "Modul", "Kode", "Skenario", "Yang Diuji (tujuan)", "Hasil Akhir", "Durasi (s)", "Keterangan Error"]);
rows.forEach((r, i) => {
  const vals = [i + 1, r.module, r.code, r.title, r.desc, r.verdict, r.dur, r.err];
  vals.forEach((v, j) => {
    const c = ws2.getCell(i + 2, j + 1);
    c.value = v; c.border = BORDER;
    c.alignment = [0, 2, 5, 6].includes(j) ? { horizontal: "center", vertical: "top", wrapText: true } : { wrapText: true, vertical: "top" };
  });
  const vc = ws2.getCell(i + 2, 6);
  vc.fill = solid(fillOf(r.verdict)); vc.font = { bold: true, color: { argb: inkOf(r.verdict) } };
});
ws2.views = [{ state: "frozen", ySplit: 1 }];
ws2.autoFilter = `A1:H${rows.length + 1}`;

// ── Sheet 3: Known Gap ───────────────────────────────────────────────────────
const ws3 = wb.addWorksheet("Known Gap");
ws3.columns = [{ width: 18 }, { width: 10 }, { width: 50 }, { width: 70 }];
headerRow(ws3, 1, ["Modul", "Kode", "Skenario", "Gap (tujuan skenario — belum dipenuhi app)"]);
const gaps = rows.filter((r) => r.verdict === "KNOWN GAP");
if (gaps.length === 0) {
  ws3.mergeCells("A2:D2");
  ws3.getCell("A2").value = "Tidak ada known gap. 🎉";
  ws3.getCell("A2").alignment = { horizontal: "center" };
} else {
  gaps.forEach((r, i) => {
    [r.module, r.code, r.title, r.desc].forEach((v, j) => {
      const c = ws3.getCell(i + 2, j + 1);
      c.value = v; c.border = BORDER;
      c.alignment = j === 1 ? { horizontal: "center", vertical: "top" } : { wrapText: true, vertical: "top" };
    });
    ws3.getCell(i + 2, 2).fill = solid(C.known);
    ws3.getCell(i + 2, 2).font = { bold: true, color: { argb: C.knownInk } };
  });
}
ws3.views = [{ state: "frozen", ySplit: 1 }];

await wb.xlsx.writeFile(OUT_XLSX);
console.log(`✓ Laporan: ${OUT_XLSX}`);
console.log(`  Total ${rows.length} · Lulus ${nPass} · Gagal ${nFail} · Known gap ${nKnown}`);
