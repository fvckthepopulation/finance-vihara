"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { dialog } from "@/components/Dialog";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { AdminUser, listAdminUsers } from "@/lib/admin";
import { GrupKonsolidasi, GrupInput, hapusGrup, listGrup, simpanGrup } from "@/lib/konsolidasiGrup";
import { listEntities, MasterEntity } from "@/lib/masters";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Master Grup Konsolidasi (FV-66).
//
// Grup menentukan yayasan mana yang dilaporkan bersama dan sejak kapan.
// Pembukuan tiap yayasan tetap terpisah: menambah, mengeluarkan, atau
// memisahkan yayasan cukup dengan mengubah keanggotaan — tanpa memindahkan
// vihara atau transaksi. Satu yayasan hanya boleh di satu grup pada periode
// yang sama (dicek server).
// ============================================================================

const tgl = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    : "sekarang";

export default function GrupKonsolidasiPage() {
  const { can } = useAuth();
  const canManage = can("entities.manage");
  const [rows, setRows] = useState<GrupKonsolidasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | { item: GrupKonsolidasi } | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    listGrup(true)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleDelete(g: GrupKonsolidasi) {
    const ya = await dialog.confirm({
      title: `Hapus grup ${g.name}`,
      message: "Grup hanya lapisan laporan; transaksi dan pembukuan yayasan anggotanya tidak berubah.",
      confirmLabel: "Hapus",
      tone: "danger",
      action: () => hapusGrup(g.id),
    });
    if (ya) load();
  }

  return (
    <AppShell
      title="Grup Konsolidasi"
      subtitle="Yayasan yang dilaporkan bersama, dengan eliminasi transaksi antar yayasan"
      actions={
        canManage ? (
          <Button variant="primary" onClick={() => setForm("new")} data-testid="grup-baru">
            + Grup baru
          </Button>
        ) : null
      }
    >
      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}
      {loading && <p className="text-[12px] text-km-ink-muted">Memuat…</p>}
      {!loading && rows.length === 0 && (
        <Card className="px-4 py-8 text-center text-[12px] text-km-ink-muted">Belum ada grup konsolidasi.</Card>
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {rows.map((g) => (
          <Card key={g.id} data-testid="grup-kartu">
            <div className="flex items-start justify-between gap-2 border-b border-km-border bg-km-panel-soft px-4 py-3">
              <div>
                <h3 className="text-[14px] font-semibold text-km-ink">{g.name}</h3>
                {g.description && <p className="text-[11px] text-km-ink-muted">{g.description}</p>}
              </div>
              <Badge tone={g.active ? "success" : "neutral"}>{g.active ? "Aktif" : "Nonaktif"}</Badge>
            </div>
            <div className="px-4 py-3 text-[12px]">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-km-ink-muted">Anggota</p>
              <ul className="space-y-1">
                {g.members.map((m) => (
                  <li key={`${m.entity_id}-${m.start_date}`} className="flex justify-between gap-2">
                    <span>
                      <strong>{m.code}</strong> {m.nama}
                    </span>
                    <span className="whitespace-nowrap text-km-ink-muted">
                      {tgl(m.start_date)} – {tgl(m.end_date)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mb-1 mt-3 text-[10px] uppercase tracking-wider text-km-ink-muted">Akses laporan</p>
              <p className="text-km-ink-soft">
                Pengguna global (semua yayasan)
                {g.users.length > 0 ? ` + ${g.users.map((u) => u.name).join(", ")}` : ""}
              </p>
            </div>
            {canManage && (
              <div className="flex justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-2">
                <Button size="sm" onClick={() => setForm({ item: g })}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(g)}>Hapus</Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {form && canManage && (
        <GrupForm
          item={form === "new" ? null : form.item}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

type BarisAnggota = { entity_id: string; start_date: string; end_date: string };

function GrupForm({ item, onClose, onSaved }: { item: GrupKonsolidasi | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [anggota, setAnggota] = useState<BarisAnggota[]>(
    item?.members.map((m) => ({ entity_id: String(m.entity_id), start_date: m.start_date, end_date: m.end_date ?? "" })) ?? [
      { entity_id: "", start_date: `${new Date().getFullYear()}-01-01`, end_date: "" },
    ],
  );
  const [userIds, setUserIds] = useState<number[]>(item?.users.map((u) => u.id) ?? []);
  const [entities, setEntities] = useState<MasterEntity[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEntities().then(setEntities).catch(() => setEntities([]));
    // Pengguna global sudah melihat semua grup; yang perlu diberi akses
    // hanya pengguna tingkat yayasan.
    listAdminUsers()
      .then((u) => setUsers(u.filter((x) => x.scope_type === "entity")))
      .catch(() => setUsers([]));
  }, []);

  const ubahAnggota = (i: number, isi: Partial<BarisAnggota>) =>
    setAnggota((a) => a.map((b, j) => (j === i ? { ...b, ...isi } : b)));

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const input: GrupInput = {
      name,
      description: description || null,
      active,
      members: anggota
        .filter((a) => a.entity_id)
        .map((a) => ({ entity_id: Number(a.entity_id), start_date: a.start_date, end_date: a.end_date || null })),
      user_ids: userIds,
    };
    try {
      await simpanGrup(input, item?.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={item ? `Edit grup ${item.name}` : "Grup konsolidasi baru"}
      onClose={onClose}
      onSubmit={simpan}
      width="max-w-2xl"
      testId="form-grup"
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={pending} data-testid="simpan-grup">
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p className="whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink" data-testid="grup-error">
            {error}
          </p>
        )}
        <Field label="Nama grup *">
          <Input required value={name} onChange={(e) => setName(e.target.value)} data-testid="grup-nama" />
        </Field>
        <Field label="Keterangan">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div>
          <p className="mb-1 text-[12px] font-medium text-km-ink">Yayasan anggota *</p>
          <p className="mb-2 text-[11px] text-km-ink-muted">
            Tanggal selesai kosong = masih anggota. Laporan periode lama mengikuti keanggotaan pada periode itu.
          </p>
          <div className="space-y-2">
            {anggota.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_140px_auto] items-end gap-2" data-testid="grup-anggota-baris">
                <Field label={i === 0 ? "Yayasan" : ""}>
                  <Select required value={a.entity_id} onChange={(e) => ubahAnggota(i, { entity_id: e.target.value })} data-testid="grup-anggota-yayasan">
                    <option value="">— Pilih yayasan —</option>
                    {entities.map((en) => (
                      <option key={en.id} value={en.id}>{en.code} — {en.legal_name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label={i === 0 ? "Mulai" : ""}>
                  <Input type="date" required value={a.start_date} onChange={(e) => ubahAnggota(i, { start_date: e.target.value })} data-testid="grup-anggota-mulai" />
                </Field>
                <Field label={i === 0 ? "Selesai" : ""}>
                  <Input type="date" value={a.end_date} onChange={(e) => ubahAnggota(i, { end_date: e.target.value })} data-testid="grup-anggota-selesai" />
                </Field>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={anggota.length === 1}
                  onClick={() => setAnggota((x) => x.filter((_, j) => j !== i))}
                  aria-label="Hapus anggota"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-2"
            onClick={() => setAnggota((x) => [...x, { entity_id: "", start_date: `${new Date().getFullYear()}-01-01`, end_date: "" }])}
            data-testid="grup-tambah-anggota"
          >
            + Tambah yayasan
          </Button>
        </div>
        <div>
          <p className="mb-1 text-[12px] font-medium text-km-ink">Akses laporan grup</p>
          <p className="mb-2 text-[11px] text-km-ink-muted">
            Pengguna global selalu bisa melihat. Pilih pengguna tingkat yayasan yang juga boleh melihat laporan grup ini.
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-km-border p-2">
            {users.length === 0 && <p className="text-[11px] text-km-ink-muted">Tidak ada pengguna tingkat yayasan.</p>}
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={userIds.includes(u.id)}
                  onChange={(e) => setUserIds((x) => (e.target.checked ? [...x, u.id] : x.filter((y) => y !== u.id)))}
                />
                {u.name} <span className="text-km-ink-muted">· {u.entity?.code ?? "-"}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-1.5 text-[12px]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Aktif (muncul di pilihan laporan Konsolidasi)
        </label>
      </div>
    </Modal>
  );
}
