"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Td, TdAksi, Th, ThAksi } from "@/components/Tabel";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/Field";
import { YayasanViharaFields, YayasanViharaValue } from "@/components/YayasanViharaFields";
import { fmtTanggal } from "@/lib/tanggal";
import { PembayaranDetail } from "@/components/PembayaranDetail";
import { Modal } from "@/components/Modal";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import { CoaAccount, listCoa } from "@/lib/coa";
import {
  CreateJournalEntryPayload,
  JOURNAL_SOURCE_LABEL,
  JournalEntryRow,
  createJournalEntry,
  deleteJournalEntry,
  voidJournalEntry,
  getJournalEntry,
  journalSourceLabel,
  listJournalEntries,
  postJournalEntry,
  rejectJournalEntry,
  submitJournalEntry,
  unduhJurnalExcel,
} from "@/lib/journal";
import { useAuth } from "@/lib/useAuth";

/**
 * Keadaan jurnal manual sesudah FV-53. Sengaja memakai sebutan yang sama
 * dengan transaksi lain supaya approver tidak perlu belajar dua kosakata.
 */
const LABEL_JURNAL: Record<string, string> = {
  draft: "Draft",
  submitted: "Menunggu Persetujuan",
  posted: "Posted",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

const TONE_JURNAL: Record<string, "neutral" | "warn" | "success" | "danger"> = {
  draft: "neutral",
  submitted: "warn",
  posted: "success",
  rejected: "danger",
  cancelled: "danger",
};

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const today = () => new Date().toISOString().slice(0, 10);

type SourceFilter = "" | keyof typeof JOURNAL_SOURCE_LABEL;

export default function JurnalPage() {
  const { can } = useAuth();
  const canCreate = can("journal.create");
  const canVoid = can("journal.void");
  const canApprove = can("journal.approve");
  const bisaExport = can("reports.export");
  const [mengunduh, setMengunduh] = useState(false);

  async function unduh() {
    setMengunduh(true);
    setError(null);
    try {
      const { blob, filename } = await unduhJurnalExcel({
        status: status || undefined,
        source: source || undefined,
        from: from || undefined,
        to: to || undefined,
        q: q || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunduh jurnal");
    } finally {
      setMengunduh(false);
    }
  }

  const [rows, setRows] = useState<JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceFilter>("");
  const [status, setStatus] = useState<"" | "draft" | "posted" | "cancelled">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  // FV-18 poin 4: dari jurnal bisa membuka detail transaksi sumbernya.
  const [sumberId, setSumberId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    from: null as number | null,
    to: null as number | null,
  });

  function reload() {
    setLoading(true);
    listJournalEntries({
      status: status || undefined,
      source: source || undefined,
      from: from || undefined,
      to: to || undefined,
      q: q || undefined,
      page,
      per_page: perPage,
    })
      .then((p) => {
        setRows(p.data);
        setMeta({
          current_page: p.current_page,
          last_page: p.last_page,
          total: p.total,
          from: p.from,
          to: p.to,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [source, status, from, to, q, page, perPage]);

  // Saringan atau kata kunci berubah → kembali ke halaman 1.
  useEffect(() => {
    setPage(1);
  }, [source, status, from, to, q, perPage]);

  useEffect(() => {
    listCoa({ active: true }).then(setAccounts).catch(() => {});
  }, []);

  async function handleVoid(r: { id: number }) {
    const alasan = window.prompt(
      `Batalkan JE #${r.id}?\n\nJurnal TIDAK dihapus: sistem membuat jurnal pembalik dan menandainya dibatalkan.\n\nAlasan pembatalan:`,
    );
    if (alasan == null) return;
    if (alasan.trim().length < 3) {
      setError("Alasan pembatalan terlalu singkat.");
      return;
    }
    try {
      await voidJournalEntry(r.id, alasan.trim());
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membatalkan jurnal");
    }
  }

  // Siklus persetujuan jurnal manual (FV-53). Pola tombolnya menyamai
  // pengeluaran: pencatat mengajukan, penyetuju memposting atau menolak, dan
  // pemegang kedua izin boleh langsung memposting draftnya sendiri.
  async function handleAjukan(r: JournalEntryRow) {
    try {
      await submitJournalEntry(r.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengajukan jurnal");
    }
  }

  async function handlePost(r: JournalEntryRow) {
    try {
      await postJournalEntry(r.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memposting jurnal");
    }
  }

  async function handleReject(r: JournalEntryRow) {
    const alasan = window.prompt(
      `Tolak jurnal #${r.id}?\n\nJurnal dikembalikan ke pembuatnya beserta alasan ini, tidak dihapus.\n\nAlasan penolakan:`,
    );
    if (alasan === null) return;
    try {
      await rejectJournalEntry(r.id, alasan.trim());
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menolak jurnal");
    }
  }

  async function handleDelete(r: JournalEntryRow) {
    if (!confirm(`Hapus draft JE #${r.id}? Hanya draft manual yang bisa dihapus.`)) return;
    try {
      await deleteJournalEntry(r.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal hapus");
    }
  }

  return (
    <AppShell
      title="Jurnal & Buku Besar"
      subtitle="Manual journal entry + lihat semua JE (auto-posted dari pembayaran/penerimaan/escrow)."
      actions={
        <>
          {/* Unduhan mengikuti saringan yang sedang aktif (FV-59). */}
          {bisaExport && (
            <Button
              variant="default"
              data-testid="unduh-jurnal"
              disabled={mengunduh || rows.length === 0}
              onClick={unduh}
            >
              {mengunduh ? "Menyiapkan…" : "Download Excel"}
            </Button>
          )}
          {canCreate && (
            <Button variant="primary" onClick={() => setShowForm(true)}>+ Manual JE</Button>
          )}
        </>
      }
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
          {error}
        </p>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-km-border bg-km-panel-soft px-4 py-2.5">
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value as SourceFilter)}
            className="min-w-36"
          >
            <option value="">Semua sumber</option>
            {Object.entries(JOURNAL_SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="min-w-28"
          >
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-w-36" />
          <span className="text-[11px] text-km-ink-muted">s/d</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-w-36" />
          <Input
            data-testid="cari-jurnal"
            aria-label="Cari jurnal"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari no. jurnal atau keterangan…"
            className="min-w-48 max-w-xs"
          />
          <p className="ml-auto text-[11px] text-km-ink-muted">
            {/* Jumlah SELURUH entry hasil saringan, bukan baris di halaman ini. */}
            {loading ? "Memuat…" : `${meta.total} entry`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-panel-soft">
              <tr>
                <Th>Tanggal</Th>
                <Th>Sumber</Th>
                <Th>Vihara</Th>
                <Th>Deskripsi</Th>
                <Th>Akun (COA)</Th>
                <Th className="whitespace-nowrap text-right">Debit</Th>
                <Th className="whitespace-nowrap text-right">Kredit</Th>
                <Th>Status</Th>
                {/* Kolom aksi berjudul dan berlebar tetap (FV-41): tanpa
                    lebar pasti, tombol Detail bergeser mengikuti aksi kedua
                    di baris itu, jadi posisinya berbeda per baris. */}
                <ThAksi />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-km-ink-muted">Memuat…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-km-ink-muted">Belum ada jurnal.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft">
                  <Td className="whitespace-nowrap">{fmtTanggal(r.entry_date)}</Td>
                  <Td>
                    <Badge tone={r.reference_type === "manual" ? "info" : "neutral"}>
                      {r.source?.label ?? journalSourceLabel(r.reference_type)}
                    </Badge>
                    {r.source?.code && (
                      <p className="mt-0.5 kode text-[10.5px] text-km-ink-muted">
                        {r.source.code}
                      </p>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-[11px]">
                    {/* Jurnal lama (dan jurnal pusat) belum punya vihara —
                        disebut apa adanya, bukan tanda hubung (FV-35). */}
                    {r.vihara?.name ?? (
                      <span className="text-km-ink-muted">Tingkat yayasan</span>
                    )}
                  </Td>
                  <Td>
                    {/* Deskripsi tersimpan hanya memuat kode + nama kategori,
                        yang sama untuk semua transaksi sejenis. Informasi
                        pembedanya diambil dari transaksi sumbernya. */}
                    <p className="font-medium">{r.source?.name ?? r.description}</p>
                    {(r.source?.counterparty || r.source?.reference || r.reference) && (
                      <p className="text-[11px] text-km-ink-muted">
                        {[
                          r.source?.counterparty,
                          r.source?.reference ?? r.reference,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {r.source?.name && (
                      <p className="text-[10.5px] text-km-ink-muted">{r.description}</p>
                    )}
                  </Td>
                  <Td className="text-[11px] text-km-ink-muted kode">
                    {(r.lines ?? []).slice(0, 3).map((l) => l.account_code).join(", ")}
                    {(r.lines?.length ?? 0) > 3 && ` …+${(r.lines?.length ?? 0) - 3}`}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{fmtRp(r.total_debit)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">{fmtRp(r.total_credit)}</Td>
                  <Td>
                    <Badge tone={TONE_JURNAL[r.status] ?? "neutral"}>
                      {LABEL_JURNAL[r.status] ?? r.status}
                    </Badge>
                  </Td>
                  {/* Satu susunan untuk semua baris: Detail selalu di kiri
                      kolom, aksi kedua selalu di sebelahnya, dan keduanya
                      tombol — bukan campur tombol dengan teks bergaris bawah
                      yang tidak terbaca sebagai aksi (FV-41). */}
                  <TdAksi>
                    <Button
                      size="sm"
                      variant="default"
                      className="min-h-[32px]"
                      onClick={() => setViewId(r.id)}
                      data-testid={`detail-je-${r.id}`}
                    >
                      Detail
                    </Button>
                    {r.source?.type === "pembayaran" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="min-h-[32px]"
                        onClick={() => setSumberId(r.source!.id)}
                        data-testid={`sumber-je-${r.id}`}
                      >
                        Transaksi
                      </Button>
                    )}
                    {canCreate &&
                      r.reference_type === "manual" &&
                      ["draft", "rejected"].includes(r.status) && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="min-h-[32px]"
                          onClick={() => handleAjukan(r)}
                          data-testid={`ajukan-je-${r.id}`}
                        >
                          Ajukan
                        </Button>
                      )}
                    {canApprove &&
                      r.reference_type === "manual" &&
                      (r.status === "submitted" ||
                        (r.status === "draft" && canCreate)) && (
                        <Button
                          size="sm"
                          variant="success"
                          className="min-h-[32px]"
                          onClick={() => handlePost(r)}
                          data-testid={`posting-je-${r.id}`}
                        >
                          {r.status === "submitted" ? "Setujui" : "Posting"}
                        </Button>
                      )}
                    {canApprove && r.reference_type === "manual" && r.status === "submitted" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="min-h-[32px]"
                        onClick={() => handleReject(r)}
                        data-testid={`tolak-je-${r.id}`}
                      >
                        Tolak
                      </Button>
                    )}
                    {canCreate && r.reference_type === "manual" && r.status === "draft" && (
                      <Button
                        size="sm"
                        variant="danger"
                        className="min-h-[32px]"
                        onClick={() => handleDelete(r)}
                        data-testid={`hapus-je-${r.id}`}
                      >
                        Hapus
                      </Button>
                    )}
                    {/* Hanya jurnal MANUAL. Jurnal yang lahir dari
                        pembayaran/penerimaan dibatalkan lewat transaksinya,
                        supaya dokumen dan buku besar tidak berbeda. */}
                    {canVoid && r.reference_type === "manual" && r.status === "posted" && (
                      <Button
                        size="sm"
                        variant="danger"
                        className="min-h-[32px]"
                        onClick={() => handleVoid(r)}
                        data-testid={`batalkan-je-${r.id}`}
                      >
                        Batalkan
                      </Button>
                    )}
                  </TdAksi>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-km-border">
          <Pagination
            currentPage={meta.current_page}
            lastPage={meta.last_page}
            total={meta.total}
            from={meta.from}
            to={meta.to}
            onChange={setPage}
            perPage={perPage}
            onPerPageChange={setPerPage}
          />
        </div>
      </Card>

      {showForm && (
        <ManualJournalForm
          accounts={accounts}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      {viewId != null && (
        <ViewJournalModal id={viewId} onClose={() => setViewId(null)} />
      )}
      {sumberId != null && (
        <PembayaranDetail id={sumberId} onClose={() => setSumberId(null)} />
      )}
    </AppShell>
  );
}

// ────────────────────────────────────────────────────────────
// Manual JE form
// ────────────────────────────────────────────────────────────

type LineDraft = {
  account_code: string;
  debit: string;
  credit: string;
  description: string;
};

const blankLine = (): LineDraft => ({ account_code: "", debit: "", credit: "", description: "" });

function ManualJournalForm({
  accounts, onClose, onSaved,
}: {
  accounts: CoaAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState<YayasanViharaValue>({ entityId: null, viharaId: null });
  const [entryDate, setEntryDate] = useState(today());
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blankLine(), blankLine()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountsActive = useMemo(
    () => accounts.filter((a) => a.active && !a.is_header).sort((a, b) => a.code.localeCompare(b.code)),
    [accounts],
  );

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diff = totalDebit - totalCredit;
  const balanced = Math.abs(diff) < 0.005 && totalDebit > 0;

  function update(i: number, field: keyof LineDraft, val: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  }
  function addLine() { setLines((prev) => [...prev, blankLine()]); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!scope.entityId) { setError("Pilih yayasan dulu."); return; }
    if (!scope.viharaId) { setError("Pilih vihara dulu."); return; }
    if (!balanced) { setError("Jurnal belum balance / total 0."); return; }
    setError(null);
    setPending(true);
    try {
      const payload: CreateJournalEntryPayload = {
        entity_id: scope.entityId,
        vihara_id: scope.viharaId,
        entry_date: entryDate,
        description: description.trim(),
        reference: reference.trim() || undefined,
        lines: lines.map((l) => ({
          account_code: l.account_code,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description.trim() || undefined,
        })),
      };
      await createJournalEntry(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={"Manual Journal Entry"}
      onClose={onClose}
      onSubmit={submit}
      width="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={pending || !balanced}>
            {pending ? "Menyimpan…" : "Simpan draft"}
          </Button>
        </>
      }
    >

        <div className="space-y-3">
          {/* Yayasan + Vihara memakai komponen yang sama dengan form transaksi
              (FV-34/FV-35): istilahnya seragam, pilihannya dari /api/my-scope
              sehingga hanya berisi yang boleh diakses, dan satu-satunya
              pilihan langsung terpilih sendiri. */}
          <div className="grid grid-cols-2 gap-3">
            <YayasanViharaFields value={scope} onChange={setScope} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal">
              <Input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </Field>
            <Field label="Reference (opsional)">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="cth: ADJ-2026-001" />
            </Field>
          </div>

          <Field label="Deskripsi">
            <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="cth: Reklasifikasi salah catat MDR Maret" />
          </Field>

          <div className="rounded-lg border border-km-border">
            <div className="flex items-center justify-between border-b border-km-border bg-km-panel-soft px-3 py-2">
              <p className="text-[12px] font-medium text-km-ink">Lines</p>
              <button type="button" onClick={addLine} className="text-[11px] text-km-green hover:underline">
                + Tambah baris
              </button>
            </div>
            <table className="w-full text-[12px]">
              <thead className="bg-km-panel-soft">
                <tr>
                  <Th className="w-44">Akun</Th>
                  <Th>Deskripsi line</Th>
                  <Th className="w-32 text-right">Debit</Th>
                  <Th className="w-32 text-right">Kredit</Th>
                  <Th className="w-10"></Th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-t border-km-border">
                    <Td>
                      <Select required value={l.account_code} onChange={(e) => update(i, "account_code", e.target.value)}>
                        <option value="">— Pilih akun —</option>
                        {accountsActive.map((a) => (
                          <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <Input value={l.description} onChange={(e) => update(i, "description", e.target.value)} placeholder="opsional" />
                    </Td>
                    <Td>
                      <MoneyInput
                        aria-label={`Debit baris ${i + 1}`}
                        value={l.debit === "" ? 0 : Number(l.debit)}
                        onChange={(n) => update(i, "debit", n ? String(n) : "")}
                        className="text-right"
                        disabled={Number(l.credit) > 0}
                      />
                    </Td>
                    <Td>
                      <MoneyInput
                        aria-label={`Kredit baris ${i + 1}`}
                        value={l.credit === "" ? 0 : Number(l.credit)}
                        onChange={(n) => update(i, "credit", n ? String(n) : "")}
                        className="text-right"
                        disabled={Number(l.debit) > 0}
                      />
                    </Td>
                    <Td>
                      {lines.length > 2 && (
                        <button type="button" onClick={() => removeLine(i)} className="text-km-red-ink hover:underline text-[11px]">
                          ✕
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-km-panel-soft">
                <tr className="border-t border-km-border">
                  <Td className="font-medium" colSpan={2}>Total</Td>
                  <Td className="text-right font-medium">{fmtRp(totalDebit)}</Td>
                  <Td className="text-right font-medium">{fmtRp(totalCredit)}</Td>
                  <Td></Td>
                </tr>
                <tr className="border-t border-km-border">
                  <Td colSpan={2} className="text-[11px] text-km-ink-muted">
                    {balanced ? "✓ Balance" : `Selisih ${fmtRp(Math.abs(diff))} ${diff > 0 ? "(debit > kredit)" : "(kredit > debit)"}`}
                  </Td>
                  <Td colSpan={3}></Td>
                </tr>
              </tfoot>
            </table>
          </div>

          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
              {error}
            </p>
          )}
        </div>

    </Modal>
  );
}

// ────────────────────────────────────────────────────────────
// View JE modal
// ────────────────────────────────────────────────────────────

function ViewJournalModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [entry, setEntry] = useState<Awaited<ReturnType<typeof getJournalEntry>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJournalEntry(id)
      .then(setEntry)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
  }, [id]);

  return (
    <Modal
      title={`JE #${id}`}
      onClose={onClose}
      width="max-w-2xl"
      footer={<Button type="button" variant="default" onClick={onClose}>Tutup</Button>}
    >
        <div className="space-y-3">
          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
              {error}
            </p>
          )}
          {!entry && !error && <p className="text-[12px] text-km-ink-muted">Memuat…</p>}
          {entry && (
            <>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div><span className="text-km-ink-muted">Tanggal:</span> {entry.entry_date}</div>
                <div><span className="text-km-ink-muted">Sumber:</span> {journalSourceLabel(entry.reference_type)}</div>
                <div className="col-span-2"><span className="text-km-ink-muted">Deskripsi:</span> {entry.description}</div>
                {/* Penerima/donatur dan No. Bukti ikut tampil di detail,
                    seperti di daftar jurnal (FV-51 poin 3). */}
                {(entry.source?.counterparty || entry.source?.reference) && (
                  <div className="col-span-2">
                    <span className="text-km-ink-muted">Pihak / No. Bukti:</span>{" "}
                    {[entry.source?.counterparty, entry.source?.reference]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {/* Catatan penginput: keterangan TERPISAH, tidak lagi
                    menimpa deskripsi baris jurnal (FV-51 poin 2). */}
                {entry.source?.catatan && (
                  <div className="col-span-2" data-testid="je-catatan">
                    <span className="text-km-ink-muted">Catatan:</span> {entry.source.catatan}
                  </div>
                )}
                {entry.reference && (
                  <div className="col-span-2"><span className="text-km-ink-muted">Reference:</span> {entry.reference}</div>
                )}
                <div><span className="text-km-ink-muted">Status:</span> {entry.status}</div>
                <div><span className="text-km-ink-muted">Total:</span> {fmtRp(entry.total_debit)}</div>
              </div>
              <table className="w-full text-[12px]">
                <thead className="bg-km-panel-soft">
                  <tr>
                    <Th>Akun</Th>
                    <Th>Deskripsi</Th>
                    <Th className="whitespace-nowrap text-right">Debit</Th>
                    <Th className="whitespace-nowrap text-right">Kredit</Th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((l) => (
                    <tr key={l.id} className="border-t border-km-border">
                      <Td className="kode">{l.account_code}<br /><span className="text-[10.5px] text-km-ink-muted">{l.account?.name}</span></Td>
                      <Td>{l.description ?? "—"}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{Number(l.debit) > 0 ? fmtRp(l.debit) : "—"}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{Number(l.credit) > 0 ? fmtRp(l.credit) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
    </Modal>
  );
}
