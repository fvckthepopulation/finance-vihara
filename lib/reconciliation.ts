import { api, API_URL, getToken } from "./api";

// ============================================================================
// Rekonsiliasi — PG Clearing (1160), rekening bank, dan suspense (2310).
// Kontrak baru (Phase 6) — menggantikan kontrak lama berbasis account_code.
// ============================================================================

export type RunStatus = "in_progress" | "completed";

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  in_progress: "Sedang berjalan",
  completed: "Selesai",
};

export type ReconciliationRun = {
  id: number;
  code: string;
  bank_account_id: number;
  bank_label: string;
  period_month: string; // "2026-07"
  status: RunStatus;
  statement_count: number;
  matched_count: number;
  system_count: number;
  bank_closing_balance: string | number | null;
  completed_at: string | null;
  /** Saldo buku/sistem — opsional, tersedia di detail run. */
  system_balance?: string | number | null;
  notes?: string | null;
};

export type ReconciliationBankSummary = {
  bank_account_id: number;
  bank_label: string;
  saldo_buku: string | number;
  last_completed_month: string | null;
  last_run_id: number | null;
  /** null/"none" = belum pernah rekonsiliasi. */
  last_run_status: RunStatus | "none" | null;
};

export type ReconciliationSummary = {
  runs: ReconciliationRun[];
  banks: ReconciliationBankSummary[];
};

export const getReconciliationSummary = (viharaId?: number | null) => {
  const sp = new URLSearchParams();
  if (viharaId != null) sp.set("vihara_id", String(viharaId));
  return api<ReconciliationSummary>(
    `/api/reconciliation${sp.toString() ? `?${sp}` : ""}`,
  );
};

/**
 * Buat run baru. Duplikat (bank+periode) → 422 dengan payload {message, run_id};
 * gunakan `createOrOpenRun` untuk perilaku "buka run yang sudah ada".
 */
export const createRun = (payload: { bank_account_id: number; period_month: string }) =>
  api<ReconciliationRun>(`/api/reconciliation`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/** Periode bulan berjalan, format "YYYY-MM" (timezone lokal). */
export const currentPeriodMonth = () =>
  new Date().toLocaleDateString("en-CA").slice(0, 7);

/**
 * Buat run untuk bulan berjalan; bila sudah ada (422 + run_id) kembalikan id
 * run yang sudah ada agar UI langsung navigate ke sana.
 */
export async function createOrOpenRun(bankAccountId: number): Promise<number> {
  try {
    const run = await createRun({
      bank_account_id: bankAccountId,
      period_month: currentPeriodMonth(),
    });
    return run.id;
  } catch (e) {
    const err = e as Error & { status?: number; payload?: { run_id?: number } };
    if (err.status === 422 && err.payload?.run_id) return err.payload.run_id;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Detail run
// ---------------------------------------------------------------------------

export type StatementLine = {
  id: number;
  date: string;
  description: string;
  debit: string | number; // keluar
  credit: string | number; // masuk
  source: string; // "manual" | "import"
  status: string; // "unmatched" | "matched"
  matched_type: string | null;
  matched_id: number | null;
};

export type SystemRow = {
  type: string; // "penerimaan" | "pembayaran" | ...
  id: number;
  date: string;
  name: string;
  amount: string | number;
  direction: "masuk" | "keluar";
  matched: boolean;
  matched_line_id: number | null;
};

export type MatchedPair = {
  system: SystemRow;
  line: StatementLine;
  diff: string | number;
  status: "cocok" | "selisih";
};

export type RunDetail = {
  run: ReconciliationRun;
  statement_lines: StatementLine[];
  system_rows: SystemRow[];
  preview: {
    matched: MatchedPair[];
    only_system: SystemRow[];
    only_koran: StatementLine[];
  };
  totals: {
    koran_masuk: string | number;
    koran_keluar: string | number;
    sistem_masuk: string | number;
    sistem_keluar: string | number;
  };
};

export const getRun = (id: number) => api<RunDetail>(`/api/reconciliation/${id}`);

export const addStatementLine = (
  runId: number,
  payload: { date: string; description: string; direction: "masuk" | "keluar"; amount: number },
) =>
  api<StatementLine>(`/api/reconciliation/${runId}/lines`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteStatementLine = (runId: number, lineId: number) =>
  api<void>(`/api/reconciliation/${runId}/lines/${lineId}`, { method: "DELETE" });

export type ImportResult = {
  imported: number;
  skipped_duplicates: number;
  skipped_out_of_period: number;
};

/** Import CSV rekening koran (multipart, field `file`) — pakai fetch mentah
 *  agar boundary multipart di-set browser (bukan Content-Type JSON). */
export async function importStatementCsv(runId: number, file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  const headers = new Headers({ Accept: "application/json" });
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}/api/reconciliation/${runId}/import`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const payload = await res.json();
      if (payload && typeof payload === "object" && "message" in payload) {
        message = String((payload as { message?: unknown }).message);
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as ImportResult;
}

export const matchLine = (
  runId: number,
  payload: { line_id: number; matched_type: string; matched_id: number },
) =>
  api<{ message?: string }>(`/api/reconciliation/${runId}/match`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const unmatchLine = (runId: number, lineId: number) =>
  api<{ message?: string }>(`/api/reconciliation/${runId}/unmatch`, {
    method: "POST",
    body: JSON.stringify({ line_id: lineId }),
  });

export const applyMatches = (runId: number) =>
  api<{ applied: number }>(`/api/reconciliation/${runId}/apply-matches`, {
    method: "POST",
  });

export type SuggestionCandidate = {
  system: SystemRow;
  diff: string | number;
  days: number;
  /** "high" | "medium" | "low" (string) — atau angka bila backend kirim skor. */
  confidence: string | number;
  reasons: string[];
};

export const getSuggestions = (runId: number, lineId: number) =>
  api<{ candidates: SuggestionCandidate[] }>(
    `/api/reconciliation/${runId}/suggestions?line_id=${lineId}`,
  );

export const completeRun = (
  runId: number,
  payload: { bank_closing_balance?: number; notes?: string } = {},
) =>
  api<ReconciliationRun>(`/api/reconciliation/${runId}/complete`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteRun = (runId: number) =>
  api<void>(`/api/reconciliation/${runId}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// PG Clearing (1160 · KalyanaMitta)
// ---------------------------------------------------------------------------

export type PgClearingPendingStatus = "Escrow" | "Settled";

export type PgClearingPending = {
  id: number;
  date: string;
  reference: string;
  donor: string;
  name: string;
  category_label: string;
  amount: string | number;
  /** Phase 7 — status per donasi dari KM. Absen → dianggap "Escrow". */
  status?: PgClearingPendingStatus;
  /** Phase 7 — referensi donasi di KalyanaMitta (bisa sama dengan `reference`). */
  km_ref?: string | null;
};

/** Phase 7 — batch settlement KM → Bank Donasi (maks. 20, terbaru dulu). */
export type PgClearingSettlement = {
  id: number;
  ref: string;
  date: string;
  gross: string | number;
  komisi: string | number;
  net: string | number;
  bank_label: string;
  donation_count: number;
};

export type PgClearingData = {
  period: string;
  gross: { total: string | number; count: number };
  komisi: { total: string | number; count: number };
  settled: { total: string | number; count: number };
  saldo_1160: string | number;
  pending: PgClearingPending[];
  /** Phase 7 — absen selama backend lama; perlakukan sebagai []. */
  settlements?: PgClearingSettlement[];
};

export const getPgClearing = (params: {
  mode: "ytd" | "bulan";
  year: number;
  month?: number;
  vihara_id?: number | null;
}) => {
  const sp = new URLSearchParams({ mode: params.mode, year: String(params.year) });
  if (params.mode === "bulan" && params.month) sp.set("month", String(params.month));
  if (params.vihara_id != null) sp.set("vihara_id", String(params.vihara_id));
  return api<PgClearingData>(`/api/reconciliation/pg-clearing?${sp}`);
};

// ---------------------------------------------------------------------------
// Suspense (2310 · Dana Belum Teridentifikasi)
// ---------------------------------------------------------------------------

export type SuspenseItem = {
  id: number;
  date: string;
  amount: string | number;
  reference: string | null;
  description: string | null;
  bank_label: string | null;
  method: string | null;
};

export type SuspenseData = {
  items: SuspenseItem[];
  total: string | number;
  count: number;
};

export const getSuspense = (viharaId?: number | null) => {
  const sp = new URLSearchParams();
  if (viharaId != null) sp.set("vihara_id", String(viharaId));
  return api<SuspenseData>(
    `/api/reconciliation/suspense${sp.toString() ? `?${sp}` : ""}`,
  );
};

/** Reklasifikasi penerimaan suspense (2310) ke kategori dana yang sesuai. */
export const reklasifikasiPenerimaan = (
  penerimaanId: number,
  payload: { category: string; name?: string; source_name: string; description?: string },
) =>
  api<unknown>(`/api/penerimaan/${penerimaanId}/reklasifikasi`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
