"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AccountType,
  CoaAccount,
  createCoa,
  deleteCoa,
  listCoaPaginated,
  TYPE_LABEL,
  updateCoa,
} from "@/lib/coa";
import { listEntities, MasterEntity } from "@/lib/masters";
import { useAuth } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ImportExcelButton } from "@/components/ImportExcelButton";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";

const TYPE_TONE: Record<AccountType, "info" | "warn" | "purple" | "success" | "danger"> = {
  asset: "info",
  liability: "warn",
  equity: "purple",
  revenue: "success",
  expense: "danger",
};

export default function CoaPage() {
  const { can } = useAuth();
  const canManage = can("coa.manage");

  const [rows, setRows] = useState<CoaAccount[]>([]);
  const [pageMeta, setPageMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: null as number | null, to: null as number | null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [showForm, setShowForm] = useState<"new" | { account: CoaAccount } | null>(null);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);

  function load() {
    setLoading(true);
    setError(null);
    listCoaPaginated({
      q: search || undefined,
      type: typeFilter || undefined,
      active: showInactive ? undefined : true,
      page,
      per_page: perPage,
    })
      .then((res) => {
        setRows(res.data);
        setPageMeta({ current_page: res.current_page, last_page: res.last_page, total: res.total, from: res.from, to: res.to });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [search, typeFilter, showInactive, page, perPage]);
  useEffect(() => setPage(1), [search, typeFilter, showInactive, perPage]);

  async function handleDelete(account: CoaAccount) {
    if (!confirm(`Hapus akun ${account.code} ${account.name}?\nIni akan gagal kalau akun sudah dipakai di jurnal.`)) {
      return;
    }
    try {
      await deleteCoa(account.code);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal hapus");
    }
  }

  const grouped = useMemo(() => {
    const groups: Record<AccountType, CoaAccount[]> = {
      asset: [], liability: [], equity: [], revenue: [], expense: [],
    };
    rows.forEach((r) => groups[r.type].push(r));
    return groups;
  }, [rows]);

  return (
    <AppShell
      title="Master COA (Chart of Account)"
      subtitle={`F1.1 — Manage ${pageMeta.total} akun. Edit konfigurasi, tambah akun custom, atau nonaktifkan yang tidak terpakai.`}
      actions={
        canManage ? (
          <div className="flex items-center gap-2">
            <ImportExcelButton type="coa" onImported={load} />
            <Button variant="primary" onClick={() => setShowForm("new")}>
              + Akun baru
            </Button>
          </div>
        ) : null
      }
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
          {error}
        </p>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-km-border bg-km-panel-soft px-4 py-2.5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode atau nama akun…"
            className="min-w-48 max-w-xs"
          />
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
            <option value="">Semua tipe</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <label className="flex items-center gap-1.5 text-[12px]">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-3.5 w-3.5 accent-km-blue"
            />
            <span>Tampilkan inactive</span>
          </label>
          <p className="ml-auto text-[11px] text-km-ink-muted">
            {loading ? "Memuat…" : `${pageMeta.total} akun total`}
          </p>
        </div>

        <div className="border-t border-km-border">
          <Pagination
            currentPage={pageMeta.current_page}
            lastPage={pageMeta.last_page}
            total={pageMeta.total}
            from={pageMeta.from}
            to={pageMeta.to}
            onChange={setPage}
            perPage={perPage}
            onPerPageChange={setPerPage}
          />
        </div>

        {Object.entries(grouped).map(([type, accounts]) => {
          if (accounts.length === 0) return null;
          return (
            <div key={type}>
              <div className="border-t border-km-border bg-km-panel-soft/50 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-km-ink-soft">
                  {TYPE_LABEL[type as AccountType]}
                </span>
                <span className="ml-2 text-[10px] text-km-ink-muted">({accounts.length})</span>
              </div>
              <table className="w-full text-[12px]">
                <thead className="bg-km-panel-soft">
                  <tr>
                    <Th>Kode</Th>
                    <Th>Nama</Th>
                    <Th>Parent</Th>
                    <Th className="text-center">Header?</Th>
                    <Th className="text-right">Usage</Th>
                    <Th>Status</Th>
                    {canManage && <Th></Th>}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-t border-km-border hover:bg-km-panel-soft">
                      <Td className="kode font-medium">{a.code}</Td>
                      <Td>
                        <p className={a.is_header ? "font-semibold" : ""}>{a.name}</p>
                        {a.note && <p className="text-[10px] text-km-ink-muted">{a.note}</p>}
                      </Td>
                      <Td className="text-[11px] text-km-ink-muted kode">{a.parent_code ?? "—"}</Td>
                      <Td className="text-center">
                        {a.is_header && <Badge tone="info">HDR</Badge>}
                      </Td>
                      <Td className="text-right">
                        {a.usage_count > 0 ? (
                          <Badge tone="warn">{a.usage_count}×</Badge>
                        ) : (
                          <span className="text-[10px] text-km-ink-muted">unused</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={a.active ? "success" : "neutral"}>
                          {a.active ? "Active" : "Inactive"}
                        </Badge>
                      </Td>
                      {canManage && (
                        <Td className="text-right">
                          <button
                            onClick={() => setShowForm({ account: a })}
                            className="mr-2 text-[11px] text-km-blue hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(a)}
                            className="text-[11px] text-km-red-ink hover:underline"
                          >
                            Hapus
                          </button>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </Card>

      {showForm && canManage && (
        <CoaForm
          account={showForm === "new" ? null : showForm.account}
          onClose={() => setShowForm(null)}
          onSaved={() => {
            setShowForm(null);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function CoaForm({
  account, onClose, onSaved,
}: {
  account: CoaAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!account;
  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "asset");
  const [parentCode, setParentCode] = useState(account?.parent_code ?? "");
  const [entityId, setEntityId] = useState<number | null>(account?.entity_id ?? null);
  const [isHeader, setIsHeader] = useState(account?.is_header ?? false);
  const [note, setNote] = useState(account?.note ?? "");
  const [active, setActive] = useState(account?.active ?? true);
  const [force, setForce] = useState(false);

  const [entities, setEntities] = useState<MasterEntity[]>([]);
  useEffect(() => { listEntities({ active: true }).then(setEntities).catch(() => {}); }, []);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (isEdit) {
        await updateCoa(account!.code, {
          name, type, parent_code: parentCode || null,
          entity_id: entityId,
          is_header: isHeader, note: note || null, active,
          force,
        });
      } else {
        await createCoa({
          code, name, type,
          parent_code: parentCode || null,
          entity_id: entityId,
          is_header: isHeader, note: note || null, active,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `Edit ${account!.code}` : "Akun baru"}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="max-w-lg"
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Kode${isEdit ? " (tidak bisa diubah)" : " — format NNN-NN"}`}>
              <Input
                required
                disabled={isEdit}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="500-99"
                className="kode"
              />
            </Field>
            <Field label="Tipe">
              <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Nama akun">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Yayasan pemilik (opsional — wajib untuk rekening bank agar bebannya bisa ditelusuri)">
            <Select value={entityId ?? ""} onChange={(e) => setEntityId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Umum / tidak terikat yayasan —</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.code} — {e.legal_name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Parent code (opsional, kode akun induk)">
            <Input
              value={parentCode}
              onChange={(e) => setParentCode(e.target.value)}
              placeholder="500-00"
              className="kode"
            />
          </Field>

          <Field label="Catatan">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={isHeader}
                onChange={(e) => setIsHeader(e.target.checked)}
                className="h-3.5 w-3.5 accent-km-blue"
              />
              <span>Header (kategori, bukan akun postable)</span>
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-3.5 w-3.5 accent-km-blue"
              />
              <span>Active</span>
            </label>
          </div>

          {isEdit && (account?.usage_count ?? 0) > 0 && (
            <div className="rounded-lg border border-km-amber bg-km-amber-soft px-3 py-2 text-[11px] text-km-amber-ink">
              <p>⚠ Akun ini sudah dipakai di {account!.usage_count} jurnal/line. Mengubah <strong>tipe</strong> atau <strong>parent</strong> bisa memengaruhi laporan keuangan.</p>
              <label className="mt-1.5 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="h-3.5 w-3.5 accent-km-amber"
                />
                <span>Force override (lanjutkan walau akun in-use)</span>
              </label>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
              {error}
            </p>
          )}
        </div>

    </Modal>
  );

}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
