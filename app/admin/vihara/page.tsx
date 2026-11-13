"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Pagination, usePaginasiLokal } from "@/components/Pagination";
import { Toast } from "@/components/Toast";
import { bankBrand, listViharaBankAccounts, ViharaBankAccount } from "@/lib/kasBank";
import {
  createPettyCashPic,
  deletePettyCashPic,
  listPettyCashPics,
  PettyCashPic,
  updatePettyCashPic,
} from "@/lib/pettyCash";
import {
  createVihara,
  deleteVihara,
  listViharas,
  updateVihara,
  verifyVihara,
  Vihara,
  ViharaInput,
} from "@/lib/vihara";
import { useAuth } from "@/lib/useAuth";
import { MasterEntity, listEntities } from "@/lib/masters";

export default function AdminViharaPage() {
  const { can } = useAuth();
  const canManage = can("masters.manage");
  const canVerify = can("campaign.verify");

  const [rows, setRows] = useState<Vihara[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<"new" | { item: Vihara } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  function reload() {
    setLoading(true);
    listViharas({ q: search || undefined })
      .then((p) => setRows(p.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [search]);

  async function handleVerify(v: Vihara) {
    if (!confirm(`Verifikasi vihara "${v.name}"? Setelah verified, vihara bisa menerima settlement.`)) return;
    try {
      await verifyVihara(v.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal verify");
    }
  }

  async function handleDelete(v: Vihara) {
    if (!confirm(`Hapus vihara "${v.name}"? (akan gagal jika sudah ada donasi)`)) return;
    try {
      await deleteVihara(v.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal hapus");
    }
  }

  // Pencarian sudah di server (`q`); halaman dipotong di peramban karena
  // daftar vihara jumlahnya tetap kecil.
  const daftar = usePaginasiLokal(rows);

  return (
    <AppShell
      title="Admin — Vihara"
      subtitle="Master vihara penerima donasi."
      actions={
        canManage && (
          <Button variant="primary" onClick={() => setForm("new")}>
            + Vihara baru
          </Button>
        )
      }
    >
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
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
            placeholder="Cari kode / nama…"
            className="min-w-48 max-w-xs"
          />
          <p className="ml-auto text-[11px] text-km-ink-muted">
            {loading ? "Memuat…" : `${rows.length} vihara`}
          </p>
        </div>

        <table className="w-full text-[12px]">
          <thead className="bg-km-panel-soft">
            <tr>
              <Th>Kode</Th>
              <Th>Nama</Th>
              <Th>Rekening Bank</Th>
              <Th>PIC</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-km-ink-muted">
                  {search ? "Data tidak ditemukan" : "Belum ada vihara."}
                </td>
              </tr>
            )}
            {daftar.rows.map((v) => (
              <ViharaRow
                key={v.id}
                v={v}
                canManage={canManage}
                canVerify={canVerify}
                expanded={expanded === v.id}
                onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                onEdit={() => setForm({ item: v })}
                onVerify={() => handleVerify(v)}
                onDelete={() => handleDelete(v)}
                onToast={(message, tone) => setToast({ message, tone })}
              />
            ))}
          </tbody>
        </table>
        <div className="border-t border-km-border">
          <Pagination {...daftar.props} />
        </div>
      </Card>

      {form && (
        <ViharaForm
          item={form === "new" ? null : form.item}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            reload();
          }}
        />
      )}
    </AppShell>
  );
}

// ── Baris vihara + panel kelola (rekening bank & PIC kas kecil) ─────────────
function ViharaRow({
  v,
  canManage,
  canVerify,
  expanded,
  onToggle,
  onEdit,
  onVerify,
  onDelete,
  onToast,
}: {
  v: Vihara;
  canManage: boolean;
  canVerify: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onVerify: () => void;
  onDelete: () => void;
  onToast: (message: string, tone: "success" | "error") => void;
}) {
  return (
    <>
      <tr className="border-t border-km-border hover:bg-km-panel-soft">
        <Td className="font-mono">{v.code}</Td>
        <Td className="font-medium">{v.name}</Td>
        <Td className="text-[11px] text-km-ink-muted">
          {v.bank_name} {v.bank_account_number}<br />
          a.n. {v.bank_account_holder}
        </Td>
        <Td className="text-[11px] text-km-ink-muted">
          {v.contact_pic ?? "—"}<br />
          {v.contact_phone}
        </Td>
        <Td>
          {!v.active ? (
            <Badge tone="neutral">Nonaktif</Badge>
          ) : v.verified_at ? (
            <Badge tone="success">Verified</Badge>
          ) : (
            <Badge tone="warn">Unverified</Badge>
          )}
        </Td>
        <Td className="text-right">
          {canVerify && v.active && !v.verified_at && (
            <button onClick={onVerify} className="mr-2 text-[11px] text-km-green hover:underline">
              Verify
            </button>
          )}
          {canManage && (
            <>
              <button
                onClick={onToggle}
                className="mr-2 text-[11px] font-medium text-km-accent hover:underline"
              >
                {expanded ? "Tutup" : "Kelola"}
              </button>
              <button onClick={onEdit} className="mr-2 text-[11px] text-km-blue hover:underline">
                Edit
              </button>
              <button onClick={onDelete} className="text-[11px] text-km-red-ink hover:underline">
                Hapus
              </button>
            </>
          )}
        </Td>
      </tr>
      {expanded && (
        <tr className="border-t border-km-border bg-km-panel-soft">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <BankAccountSection viharaId={v.id} canManage={canManage} onToast={onToast} />
              <PicSection viharaId={v.id} canManage={canManage} onToast={onToast} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BankAccountSection({
  viharaId,
  canManage,
}: {
  viharaId: number;
  canManage: boolean;
  onToast: (message: string, tone: "success" | "error") => void;
}) {
  // Rekening milik YAYASAN sejak FV-36, bukan vihara. Panel ini tinggal
  // memperlihatkan rekening yang boleh dipakai vihara ini; pengelolaannya
  // pindah ke Admin → Master Rekening supaya tidak ada dua tempat mengubah
  // data yang sama.
  const [items, setItems] = useState<ViharaBankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listViharaBankAccounts(viharaId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [viharaId]);

  return (
    <div className="rounded-lg border border-km-border bg-km-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-km-ink-soft">
          Rekening yang bisa dipakai
        </p>
        {canManage && (
          <a href="/admin/rekening" className="text-[11px] text-km-blue hover:underline">
            Kelola di Master Rekening →
          </a>
        )}
      </div>
      {loading ? (
        <p className="py-2 text-[11px] text-km-ink-muted">Memuat…</p>
      ) : items.length === 0 ? (
        <p className="py-2 text-[11px] text-km-ink-muted">
          Belum ada rekening yayasan yang bisa dipakai vihara ini.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((b) => (
            <li key={b.id} className="flex items-center justify-between text-[12px] text-km-ink">
              <span>
                {bankBrand(b.bank_name)} {b.account_number ?? ""}
                {b.account_name ? (
                  <span className="text-km-ink-muted"> · {b.account_name}</span>
                ) : null}
              </span>
              <span className="text-[11px] text-km-ink-muted">{b.entity_name ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PicSection({
  viharaId,
  canManage,
  onToast,
}: {
  viharaId: number;
  canManage: boolean;
  onToast: (message: string, tone: "success" | "error") => void;
}) {
  const [items, setItems] = useState<PettyCashPic[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  function reload() {
    setLoading(true);
    listPettyCashPics(viharaId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [viharaId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    try {
      await createPettyCashPic(viharaId, name.trim());
      setName("");
      onToast("PIC ditambahkan", "success");
      reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Gagal menambah PIC", "error");
    } finally {
      setPending(false);
    }
  }

  async function handleNonaktif(p: PettyCashPic) {
    try {
      await updatePettyCashPic(p.id, { active: false });
      onToast("PIC dinonaktifkan", "success");
      reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Gagal menonaktifkan", "error");
    }
  }

  async function handleDelete(p: PettyCashPic) {
    try {
      await deletePettyCashPic(p.id);
      onToast("PIC dihapus", "success");
      reload();
    } catch (e) {
      // 422 = PIC sudah dipakai transaksi → fallback nonaktifkan.
      if ((e as { status?: number }).status === 422) {
        onToast(e instanceof Error ? e.message : "PIC dipakai transaksi", "error");
        try {
          await updatePettyCashPic(p.id, { active: false });
          onToast("Dinonaktifkan", "success");
        } catch { /* biarkan error pertama tampil */ }
        reload();
      } else {
        onToast(e instanceof Error ? e.message : "Gagal menghapus PIC", "error");
      }
    }
  }

  return (
    <div className="rounded-lg border border-km-border bg-km-panel p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-km-ink-soft">
        PIC Kas Kecil
      </p>
      {loading ? (
        <p className="py-2 text-[11px] text-km-ink-muted">Memuat…</p>
      ) : items.length === 0 ? (
        <p className="py-2 text-[11px] text-km-ink-muted">Belum ada PIC.</p>
      ) : (
        <ul className="mb-2 space-y-1.5">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 border-b border-km-border pb-1.5 last:border-0">
              <p className={`text-[12px] font-medium text-km-ink ${p.active ? "" : "opacity-50"}`}>
                {p.name}
                {!p.active && (
                  <span className="ml-1.5 rounded bg-km-bg px-1.5 py-px text-[10px] font-normal text-km-ink-muted">
                    Nonaktif
                  </span>
                )}
              </p>
              {canManage && (
                <div className="flex shrink-0 gap-2">
                  {p.active && (
                    <button
                      onClick={() => handleNonaktif(p)}
                      className="text-[11px] text-km-amber-ink hover:underline"
                    >
                      Nonaktif
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(p)}
                    className="text-[11px] text-km-red-ink hover:underline"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form onSubmit={handleAdd} className="mt-2 flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama PIC"
            required
          />
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            Tambah
          </Button>
        </form>
      )}
    </div>
  );
}

function ViharaForm({ item, onClose, onSaved }: { item: Vihara | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [entities, setEntities] = useState<MasterEntity[]>([]);
  // Vihara selalu bernaung di bawah satu yayasan. Admin tingkat yayasan
  // hanya melihat yayasannya sendiri (API yang membatasi daftarnya).
  const [entityId, setEntityId] = useState<number | null>(item?.entity_id ?? null);
  const [name, setName] = useState(item?.name ?? "");
  const [address, setAddress] = useState(item?.address ?? "");
  const [contactPic, setContactPic] = useState(item?.contact_pic ?? "");
  const [contactPhone, setContactPhone] = useState(item?.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(item?.contact_email ?? "");
  const [bankName, setBankName] = useState(item?.bank_name ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState(item?.bank_account_number ?? "");
  const [bankAccountHolder, setBankAccountHolder] = useState(item?.bank_account_holder ?? "");
  const [npwp, setNpwp] = useState(item?.npwp ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEntities({ active: true })
      .then((list) => {
        setEntities(list);
        if (entityId == null && list.length > 0) setEntityId(list[0].id);
      })
      .catch(() => setEntities([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const payload: ViharaInput = {
      entity_id: entityId,
      name,
      address: address || null,
      contact_pic: contactPic || null,
      contact_phone: contactPhone || null,
      contact_email: contactEmail || null,
      bank_name: bankName,
      bank_account_number: bankAccountNumber,
      bank_account_holder: bankAccountHolder,
      npwp: npwp || null,
      active,
    };
    try {
      if (item) await updateVihara(item.id, payload);
      else await createVihara(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={item ? `Edit ${item.name}` : "Vihara baru"}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="default" onClick={onClose}>Batal</Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan"}
              </Button>
        </div>
      }
    >

        <div className="space-y-3 px-4 py-4">
          <Field label="Yayasan penaung">
            <Select
              data-testid="vihara-entity"
              required
              value={entityId ?? ""}
              onChange={(e) => setEntityId(e.target.value ? Number(e.target.value) : null)}
              disabled={!!item && !(user?.scope_type === "global")}
            >
              <option value="">— pilih yayasan —</option>
              {entities.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.code} — {en.legal_name}
                </option>
              ))}
            </Select>
            {user?.scope_type !== "global" && (
              <p className="mt-1 text-[11px] text-km-ink-muted">
                Hanya admin tingkat global yang bisa memindahkan vihara antar yayasan.
              </p>
            )}
          </Field>
          <Field label="Nama vihara">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Alamat">
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="PIC">
              <Input value={contactPic} onChange={(e) => setContactPic(e.target.value)} placeholder="Bhante / Pengurus" />
            </Field>
            <Field label="Telp">
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="081xxxx" />
            </Field>
          </div>

          <Field label="Email kontak">
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Bank">
              <Input required value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BCA" />
            </Field>
            <div className="col-span-2">
              <Field label="No rekening">
                <Input required value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="1234567890" />
              </Field>
            </div>
          </div>

          <Field label="Atas nama (account holder)">
            <Input required value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="NPWP (opsional)">
              <Input value={npwp} onChange={(e) => setNpwp(e.target.value)} />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 text-[13px] text-km-ink">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                Aktif
              </label>
            </Field>
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

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
