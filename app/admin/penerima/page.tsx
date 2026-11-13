"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import { Toast } from "@/components/Toast";
import {
  createPenerima,
  deletePenerima,
  HalamanPenerima,
  JENIS_PENERIMA,
  JenisPenerima,
  listPenerima,
  Penerima,
  updatePenerima,
} from "@/lib/penerima";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Master Penerima (FV-31).
//
// Daftarnya milik yayasan: vendor biasanya lokal, jadi yayasan lain tidak
// perlu — dan tidak boleh — melihatnya. Nama penerima yang sudah dipakai
// transaksi hanya bisa dinonaktifkan, supaya baris lama tetap menunjuk
// penerima yang sama.
// ============================================================================

const KOSONG = { cari: "", jenis: "" as JenisPenerima | "", status: "" as "" | "1" | "0" };

export default function MasterPenerimaPage() {
  const { can } = useAuth();
  const bisaKelola = can("masters.manage");

  const [f, setF] = useState({ ...KOSONG });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [res, setRes] = useState<HalamanPenerima | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | { item: Penerima } | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [f, perPage]);

  const muat = useCallback(() => {
    setLoading(true);
    setError(null);
    listPenerima({
      q: f.cari || undefined,
      type: f.jenis || undefined,
      active: f.status,
      page,
      per_page: perPage,
    })
      .then(setRes)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [f, page, perPage]);

  useEffect(muat, [muat]);

  async function toggleAktif(p: Penerima) {
    try {
      await updatePenerima(p.id, { active: !p.active });
      setToast({
        message: p.active ? "Penerima dinonaktifkan" : "Penerima diaktifkan",
        tone: "success",
      });
      muat();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Gagal mengubah status", tone: "error" });
    }
  }

  async function hapus(p: Penerima) {
    if (!window.confirm(`Hapus penerima ${p.name}?`)) return;
    try {
      await deletePenerima(p.id);
      setToast({ message: "Penerima dihapus", tone: "success" });
      muat();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Gagal menghapus", tone: "error" });
    }
  }

  const rows = res?.data ?? [];

  return (
    <AppShell title="Master Penerima" subtitle="Vendor, perorangan, dan penerima internal">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      <Card className="mb-3.5">
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-3">
          <Field label="Cari">
            <Input
              data-testid="cari-penerima"
              placeholder="Nama, telepon, NPWP, no. rekening…"
              value={f.cari}
              onChange={(e) => setF({ ...f, cari: e.target.value })}
            />
          </Field>
          <Field label="Jenis">
            <Select
              data-testid="filter-jenis"
              value={f.jenis}
              onChange={(e) => setF({ ...f, jenis: e.target.value as JenisPenerima | "" })}
            >
              <option value="">Semua jenis</option>
              {(Object.keys(JENIS_PENERIMA) as JenisPenerima[]).map((k) => (
                <option key={k} value={k}>
                  {JENIS_PENERIMA[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              data-testid="filter-status"
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as "" | "1" | "0" })}
            >
              <option value="">Semua status</option>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-2.5">
          <Button size="sm" data-testid="reset-filter" onClick={() => setF({ ...KOSONG })}>
            Reset filter
          </Button>
          {bisaKelola && (
            <Button size="sm" variant="primary" data-testid="tambah-penerima" onClick={() => setForm("new")}>
              + Tambah Penerima
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Daftar Penerima" subtitle={loading ? "Memuat…" : undefined} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                <Th>Nama</Th>
                <Th>Jenis</Th>
                <Th>Telepon</Th>
                <Th>Rekening Tujuan</Th>
                <Th>NPWP</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-km-ink-muted">
                    {f.cari || f.jenis || f.status ? "Data tidak ditemukan" : "Belum ada penerima"}
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    data-testid={`penerima-row-${p.id}`}
                    className="border-t border-km-border hover:bg-km-panel-soft"
                  >
                    <Td>
                      <p>{p.name}</p>
                      {p.address && <p className="text-[11px] text-km-ink-muted">{p.address}</p>}
                    </Td>
                    <Td>
                      <Badge tone={p.type === "vendor" ? "info" : "neutral"}>{p.type_label}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">{p.phone || "—"}</Td>
                    <Td className="whitespace-nowrap">
                      {p.bank_account_number ? (
                        <>
                          <span className="tabular-nums">
                            {p.bank_name} {p.bank_account_number}
                          </span>
                          {p.bank_account_holder && (
                            <span className="block text-[11px] text-km-ink-muted">
                              a.n. {p.bank_account_holder}
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">{p.npwp || "—"}</Td>
                    <Td>
                      {p.active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                    </Td>
                    <Td>
                      {bisaKelola ? (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            className="min-h-[32px]"
                            data-testid={`ubah-penerima-${p.id}`}
                            onClick={() => setForm({ item: p })}
                          >
                            Ubah
                          </Button>
                          <Button
                            size="sm"
                            className="min-h-[32px]"
                            data-testid={`status-penerima-${p.id}`}
                            onClick={() => toggleAktif(p)}
                          >
                            {p.active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          {!p.in_use && (
                            <Button
                              size="sm"
                              variant="danger"
                              className="min-h-[32px]"
                              data-testid={`hapus-penerima-${p.id}`}
                              onClick={() => hapus(p)}
                            >
                              Hapus
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-km-ink-muted">—</span>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-km-border">
          <Pagination
            currentPage={res?.current_page ?? 1}
            lastPage={res?.last_page ?? 1}
            total={res?.total ?? 0}
            from={res?.from ?? null}
            to={res?.to ?? null}
            onChange={setPage}
            perPage={perPage}
            onPerPageChange={setPerPage}
          />
        </div>
      </Card>

      {form && (
        <FormPenerima
          item={form === "new" ? null : form.item}
          onClose={() => setForm(null)}
          onSaved={(pesan) => {
            setForm(null);
            setToast({ message: pesan, tone: "success" });
            muat();
          }}
        />
      )}
    </AppShell>
  );
}

function FormPenerima({
  item,
  onClose,
  onSaved,
}: {
  item: Penerima | null;
  onClose: () => void;
  onSaved: (pesan: string) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<JenisPenerima>(item?.type ?? "vendor");
  const [phone, setPhone] = useState(item?.phone ?? "");
  const [address, setAddress] = useState(item?.address ?? "");
  const [bankName, setBankName] = useState(item?.bank_name ?? "");
  const [bankNumber, setBankNumber] = useState(item?.bank_account_number ?? "");
  const [bankHolder, setBankHolder] = useState(item?.bank_account_holder ?? "");
  const [npwp, setNpwp] = useState(item?.npwp ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        name,
        type,
        phone: phone || null,
        address: address || null,
        bank_name: bankName || null,
        bank_account_number: bankNumber || null,
        bank_account_holder: bankHolder || null,
        npwp: npwp || null,
      };
      if (item) {
        await updatePenerima(item.id, payload);
        onSaved("Penerima diperbarui");
      } else {
        await createPenerima(payload);
        onSaved("Penerima ditambahkan");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan penerima");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={item ? `Ubah Penerima — ${item.name}` : "Tambah Penerima"}
      onClose={onClose}
      onSubmit={simpan}
      testId="form-penerima-master"
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={pending} data-testid="simpan-penerima">
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-2.5">
        <Field label="Nama *">
          <Input
            required
            data-testid="penerima-nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Jenis *">
          <Select
            required
            data-testid="penerima-jenis"
            value={type}
            onChange={(e) => setType(e.target.value as JenisPenerima)}
          >
            {(Object.keys(JENIS_PENERIMA) as JenisPenerima[]).map((k) => (
              <option key={k} value={k}>
                {JENIS_PENERIMA[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Telepon">
          <Input data-testid="penerima-telepon" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Alamat">
          <Textarea
            rows={2}
            data-testid="penerima-alamat"
            value={address ?? ""}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Field label="Bank tujuan">
            <Input
              data-testid="penerima-bank"
              value={bankName ?? ""}
              onChange={(e) => setBankName(e.target.value)}
            />
          </Field>
          <Field label="No. rekening">
            <Input
              data-testid="penerima-rekening"
              value={bankNumber ?? ""}
              onChange={(e) => setBankNumber(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Atas nama">
          <Input
            data-testid="penerima-atas-nama"
            value={bankHolder ?? ""}
            onChange={(e) => setBankHolder(e.target.value)}
          />
        </Field>
        <Field label="NPWP">
          <Input data-testid="penerima-npwp" value={npwp ?? ""} onChange={(e) => setNpwp(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10.5px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
