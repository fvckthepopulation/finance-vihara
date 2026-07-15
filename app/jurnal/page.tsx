"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { CoaAccount, listCoa } from "@/lib/coa";
import {
  CreateJournalEntryPayload,
  JOURNAL_SOURCE_LABEL,
  JournalEntryRow,
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  journalSourceLabel,
  listJournalEntries,
} from "@/lib/journal";
import { MasterEntity, listEntities } from "@/lib/masters";
import { useAuth } from "@/lib/useAuth";

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

const today = () => new Date().toISOString().slice(0, 10);

type SourceFilter = "" | keyof typeof JOURNAL_SOURCE_LABEL;

export default function JurnalPage() {
  const { can } = useAuth();
  const canCreate = can("journal.create");

  const [rows, setRows] = useState<JournalEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceFilter>("");
  const [status, setStatus] = useState<"" | "draft" | "posted">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [entities, setEntities] = useState<MasterEntity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);

  function reload() {
    setLoading(true);
    listJournalEntries({
      status: status || undefined,
      source: source || undefined,
      from: from || undefined,
      to: to || undefined,
      q: q || undefined,
      per_page: 50,
    })
      .then((p) => setRows(p.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [source, status, from, to, q]);

  useEffect(() => {
    listCoa({ active: true }).then(setAccounts).catch(() => {});
    listEntities({ active: true }).then(setEntities).catch(() => {});
  }, []);

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
        canCreate && (
          <Button variant="primary" onClick={() => setShowForm(true)}>+ Manual JE</Button>
        )
      }
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
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
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari deskripsi…"
            className="min-w-48 max-w-xs"
          />
          <p className="ml-auto text-[11px] text-km-ink-muted">
            {loading ? "Memuat…" : `${rows.length} entry`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-panel-soft">
              <tr>
                <Th>Tanggal</Th>
                <Th>Sumber</Th>
                <Th>Deskripsi</Th>
                <Th>Akun (COA)</Th>
                <Th className="text-right">Debit</Th>
                <Th className="text-right">Kredit</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-km-ink-muted">Memuat…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-km-ink-muted">Belum ada jurnal.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-km-border hover:bg-km-panel-soft">
                  <Td>{r.entry_date}</Td>
                  <Td>
                    <Badge tone={r.reference_type === "manual" ? "info" : "neutral"}>
                      {journalSourceLabel(r.reference_type)}
                    </Badge>
                  </Td>
                  <Td>
                    <p className="font-medium">{r.description}</p>
                    {r.reference && (
                      <p className="text-[11px] text-km-ink-muted">ref: {r.reference}</p>
                    )}
                  </Td>
                  <Td className="text-[11px] text-km-ink-muted font-mono">
                    {(r.lines ?? []).slice(0, 3).map((l) => l.account_code).join(", ")}
                    {(r.lines?.length ?? 0) > 3 && ` …+${(r.lines?.length ?? 0) - 3}`}
                  </Td>
                  <Td className="text-right">{fmtRp(r.total_debit)}</Td>
                  <Td className="text-right">{fmtRp(r.total_credit)}</Td>
                  <Td>
                    <Badge tone={r.status === "posted" ? "success" : "neutral"}>
                      {r.status === "posted" ? "Posted" : "Draft"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => setViewId(r.id)}
                      className="mr-2 text-[11px] text-km-blue hover:underline"
                    >
                      Lihat
                    </button>
                    {canCreate && r.reference_type === "manual" && r.status === "draft" && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="text-[11px] text-km-red-ink hover:underline"
                      >
                        Hapus
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && (
        <ManualJournalForm
          accounts={accounts}
          entities={entities}
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
  accounts, entities, onClose, onSaved,
}: {
  accounts: CoaAccount[];
  entities: MasterEntity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [entityId, setEntityId] = useState<number | "">(entities[0]?.id ?? "");
  const [entryDate, setEntryDate] = useState(today());
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blankLine(), blankLine()]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entityId === "" && entities[0]) setEntityId(entities[0].id);
  }, [entities, entityId]);

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
    if (!entityId) { setError("Pilih entitas dulu."); return; }
    if (!balanced) { setError("Jurnal belum balance / total 0."); return; }
    setError(null);
    setPending(true);
    try {
      const payload: CreateJournalEntryPayload = {
        entity_id: Number(entityId),
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12 overflow-y-auto">
      <form onSubmit={submit} className="w-full max-w-3xl rounded-xl border border-km-border bg-km-panel shadow-xl">
        <div className="flex items-center justify-between border-b border-km-border px-4 py-3">
          <h2 className="text-[14px] font-medium text-km-ink">Manual Journal Entry</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-km-ink-muted hover:bg-km-bg">✕</button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Entitas">
              <Select required value={String(entityId)} onChange={(e) => setEntityId(Number(e.target.value))}>
                {entities.map((en) => (
                  <option key={en.id} value={en.id}>{en.code} · {en.legal_name}</option>
                ))}
              </Select>
            </Field>
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
                      <Input
                        type="number" step="0.01" min="0" inputMode="decimal"
                        value={l.debit} onChange={(e) => update(i, "debit", e.target.value)}
                        className="text-right"
                        disabled={Number(l.credit) > 0}
                      />
                    </Td>
                    <Td>
                      <Input
                        type="number" step="0.01" min="0" inputMode="decimal"
                        value={l.credit} onChange={(e) => update(i, "credit", e.target.value)}
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
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
          <Button type="button" variant="default" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={pending || !balanced}>
            {pending ? "Menyimpan…" : "Simpan draft"}
          </Button>
        </div>
      </form>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-km-border bg-km-panel shadow-xl">
        <div className="flex items-center justify-between border-b border-km-border px-4 py-3">
          <h2 className="text-[14px] font-medium text-km-ink">JE #{id}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-km-ink-muted hover:bg-km-bg">✕</button>
        </div>
        <div className="space-y-3 px-4 py-4">
          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
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
                    <Th className="text-right">Debit</Th>
                    <Th className="text-right">Kredit</Th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((l) => (
                    <tr key={l.id} className="border-t border-km-border">
                      <Td className="font-mono">{l.account_code}<br /><span className="text-[10.5px] text-km-ink-muted">{l.account?.name}</span></Td>
                      <Td>{l.description ?? "—"}</Td>
                      <Td className="text-right">{Number(l.debit) > 0 ? fmtRp(l.debit) : "—"}</Td>
                      <Td className="text-right">{Number(l.credit) > 0 ? fmtRp(l.credit) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
          <Button type="button" variant="default" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}>{children}</th>;
}

function Td({ children, className = "", colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
