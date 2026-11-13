"use client";

import { useEffect, useState } from "react";
import {
  createEntity,
  deleteEntity,
  listEntitiesPaginated,
  MasterEntity,
  updateEntity,
} from "@/lib/masters";
import { useAuth } from "@/lib/useAuth";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { Field, Input, Textarea } from "@/components/Field";
import { ImportExcelButton } from "@/components/ImportExcelButton";
import { Pagination } from "@/components/Pagination";

export default function EntitiesPage() {
  const { can } = useAuth();
  const canManage = can("masters.manage");

  const [rows, setRows] = useState<MasterEntity[]>([]);
  const [pageMeta, setPageMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: null as number | null, to: null as number | null });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | { item: MasterEntity } | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    listEntitiesPaginated({ page, per_page: 24 })
      .then((res) => {
        setRows(res.data);
        setPageMeta({ current_page: res.current_page, last_page: res.last_page, total: res.total, from: res.from, to: res.to });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);

  async function handleDelete(e: MasterEntity) {
    if (!confirm(`Hapus yayasan ${e.code}?`)) return;
    try {
      await deleteEntity(e.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    }
  }

  return (
    <AppShell
      title="Master Yayasan"
      subtitle={`${pageMeta.total} yayasan terdaftar`}
      actions={canManage ? (
        <div className="flex items-center gap-2">
          <ImportExcelButton type="entities" onImported={load} />
          <Button variant="primary" onClick={() => setForm("new")}>+ Yayasan baru</Button>
        </div>
      ) : null}
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">{error}</p>
      )}

      {loading && <p className="text-[12px] text-km-ink-muted">Memuat…</p>}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {rows.map((e) => (
          <Card key={e.id} className="p-0">
            <div className="flex items-start justify-between gap-2 border-b border-km-border bg-km-panel-soft px-4 py-3">
              <div>
                <h3 className="text-[14px] font-semibold text-km-ink">{e.code}</h3>
                <p className="text-[11px] text-km-ink-muted">{e.legal_name}</p>
              </div>
              <Badge tone={e.active ? "success" : "neutral"}>{e.active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="space-y-1.5 px-4 py-3 text-[12px]">
              <div className="flex justify-between"><span className="text-km-ink-muted">NPWP</span><span className="kode">{e.npwp || "—"}</span></div>
              {e.address && <div><span className="text-km-ink-muted">Alamat:</span> <span>{e.address}</span></div>}

              <div className="mt-2 border-t border-km-border pt-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-km-ink-muted">Cakupan</p>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <Stat label="Vihara" value={e.viharas_count ?? 0} />
                  <Stat label="Aktif" value={e.viharas_active_count ?? 0} />
                  <Stat label="Pengguna" value={e.users_count ?? 0} />
                </div>
              </div>
            </div>
            {canManage && (
              <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-2">
                <button onClick={() => setForm({ item: e })} className="text-[11px] text-km-blue hover:underline">Edit</button>
                <button onClick={() => handleDelete(e)} className="text-[11px] text-km-red-ink hover:underline">Hapus</button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {pageMeta.last_page > 1 && (
        <div className="mt-3 rounded-xl border border-km-border bg-km-panel">
          <Pagination
            currentPage={pageMeta.current_page}
            lastPage={pageMeta.last_page}
            total={pageMeta.total}
            from={pageMeta.from}
            to={pageMeta.to}
            onChange={setPage}
          />
        </div>
      )}

      {form && canManage && (
        <EntityForm
          item={form === "new" ? null : form.item}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); load(); }}
        />
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-km-border bg-km-panel-soft px-1.5 py-1 text-center">
      <p className="text-km-ink-muted">{label}</p>
      <p className="text-[12px] font-semibold text-km-ink">{value}</p>
    </div>
  );
}

function EntityForm({ item, onClose, onSaved }: { item: MasterEntity | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!item;
  const [e, setE] = useState({
    code: item?.code ?? "",
    legal_name: item?.legal_name ?? "",
    npwp: item?.npwp ?? "",
    address: item?.address ?? "",
    active: item?.active ?? true,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (isEdit) await updateEntity(item!.id, e);
      else await createEntity(e);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `Edit ${item!.code}` : "Yayasan baru"}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="max-w-md"
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={pending}>{pending ? "…" : "Simpan"}</Button>
        </>
      }
    >
        <div className="space-y-3">
          <Field label="Kode (UPPERCASE, max 8)"><Input required value={e.code} onChange={(ev) => setE({ ...e, code: ev.target.value.toUpperCase() })} placeholder="PGS" className="kode" /></Field>
          <Field label="Nama Legal"><Input required value={e.legal_name} onChange={(ev) => setE({ ...e, legal_name: ev.target.value })} placeholder="PT Persatuan Gula Sentosa" /></Field>
          <Field label="NPWP"><Input value={e.npwp} onChange={(ev) => setE({ ...e, npwp: ev.target.value })} className="kode" /></Field>
          <Field label="Alamat"><Textarea value={e.address} onChange={(ev) => setE({ ...e, address: ev.target.value })} /></Field>
          <label className="flex items-center gap-1.5 text-[12px]">
            <input type="checkbox" checked={e.active} onChange={(ev) => setE({ ...e, active: ev.target.checked })} className="h-3.5 w-3.5 accent-km-blue" />
            <span>Active</span>
          </label>
          {error && <div className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">{error}</div>}
        </div>
    </Modal>
  );

}
