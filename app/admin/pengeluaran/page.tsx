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
  AkunBeban,
  createKategoriBiaya,
  createNamaPengeluaran,
  deleteKategoriBiaya,
  deleteNamaPengeluaran,
  Halaman,
  KategoriBiaya,
  listAkunBeban,
  listKategoriBiaya,
  listNamaPengeluaran,
  NamaPengeluaran,
  updateKategoriBiaya,
  updateNamaPengeluaran,
} from "@/lib/masterPengeluaran";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Master Pengeluaran (FV-29).
//
// Dua tingkat dalam satu layar: Kategori Biaya sebagai induk, Nama Pengeluaran
// sebagai anaknya. Memilih kategori di tabel atas menyaring tabel bawah — itu
// pula urutan yang dipakai form Input Pengeluaran.
//
// Akun COA di Nama Pengeluaran bukan sekadar catatan: akun itulah yang jadi
// akun DEBIT saat pengeluaran dijurnal.
// ============================================================================

type ToastMsg = { message: string; tone: "success" | "error" };

export default function MasterPengeluaranPage() {
  const { can } = useAuth();
  const bisaKelola = can("masters.manage");

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [kategoriTerpilih, setKategoriTerpilih] = useState<string>("");
  const [akun, setAkun] = useState<AkunBeban[]>([]);
  const [semuaKategori, setSemuaKategori] = useState<KategoriBiaya[]>([]);
  const [revisi, setRevisi] = useState(0);

  useEffect(() => {
    listAkunBeban()
      .then(setAkun)
      .catch(() => setAkun([]));
  }, []);

  // Dipakai dropdown "kategori induk" di form nama — perlu seluruh kategori,
  // bukan hanya satu halaman.
  useEffect(() => {
    listKategoriBiaya({ per_page: 100 })
      .then((r) => setSemuaKategori(r.data))
      .catch(() => setSemuaKategori([]));
  }, [revisi]);

  const segar = () => setRevisi((n) => n + 1);

  return (
    <AppShell title="Master Pengeluaran" subtitle="Kategori Biaya dan Nama Pengeluaran">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div className="space-y-3.5">
        <TabelKategori
          bisaKelola={bisaKelola}
          akun={akun}
          terpilih={kategoriTerpilih}
          onPilih={setKategoriTerpilih}
          revisi={revisi}
          onBerubah={segar}
          onToast={setToast}
        />
        <TabelNama
          bisaKelola={bisaKelola}
          akun={akun}
          kategoriList={semuaKategori}
          kategoriTerpilih={kategoriTerpilih}
          onGantiKategori={setKategoriTerpilih}
          revisi={revisi}
          onBerubah={segar}
          onToast={setToast}
        />
      </div>
    </AppShell>
  );
}

// ── Kategori Biaya ──────────────────────────────────────────────────────────

function TabelKategori({
  bisaKelola,
  akun,
  terpilih,
  onPilih,
  revisi,
  onBerubah,
  onToast,
}: {
  bisaKelola: boolean;
  akun: AkunBeban[];
  terpilih: string;
  onPilih: (code: string) => void;
  revisi: number;
  onBerubah: () => void;
  onToast: (t: ToastMsg) => void;
}) {
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState<"" | "1" | "0">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [res, setRes] = useState<Halaman<KategoriBiaya> | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<"new" | { item: KategoriBiaya } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [cari, status, perPage]);

  const muat = useCallback(() => {
    setLoading(true);
    listKategoriBiaya({ q: cari || undefined, active: status, page, per_page: perPage })
      .then(setRes)
      .catch(() => setRes(null))
      .finally(() => setLoading(false));
  }, [cari, status, page, perPage]);

  useEffect(muat, [muat, revisi]);

  async function toggleAktif(k: KategoriBiaya) {
    try {
      await updateKategoriBiaya(k.id, { active: !k.active });
      onToast({ message: k.active ? "Kategori dinonaktifkan" : "Kategori diaktifkan", tone: "success" });
      onBerubah();
    } catch (e) {
      const pesan = e instanceof Error ? e.message : "Gagal mengubah status";
      // Masih punya nama aktif → tawarkan menonaktifkan semuanya sekaligus,
      // bukan berhenti dengan pesan error saja.
      if (/Nama Pengeluaran aktif/i.test(pesan) && window.confirm(`${pesan}\n\nNonaktifkan semuanya sekarang?`)) {
        try {
          await updateKategoriBiaya(k.id, { active: false, nonaktifkan_anak: true });
          onToast({ message: "Kategori dan seluruh namanya dinonaktifkan", tone: "success" });
          onBerubah();
          return;
        } catch (e2) {
          onToast({ message: e2 instanceof Error ? e2.message : pesan, tone: "error" });
          return;
        }
      }
      onToast({ message: pesan, tone: "error" });
    }
  }

  async function hapus(k: KategoriBiaya) {
    if (!window.confirm(`Hapus kategori ${k.name}?`)) return;
    try {
      await deleteKategoriBiaya(k.id);
      onToast({ message: "Kategori dihapus", tone: "success" });
      onBerubah();
    } catch (e) {
      onToast({ message: e instanceof Error ? e.message : "Gagal menghapus", tone: "error" });
    }
  }

  const rows = res?.data ?? [];

  return (
    <Card>
      <CardHeader
        title="Kategori Biaya"
        subtitle={loading ? "Memuat…" : "Pilih satu kategori untuk menyaring Nama Pengeluaran di bawah"}
        right={
          <div className="flex items-center gap-2">
            <Input
              data-testid="cari-kategori"
              placeholder="Cari kategori…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="max-w-44"
              aria-label="Cari kategori biaya"
            />
            <Select
              data-testid="filter-status-kategori"
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | "1" | "0")}
              className="max-w-32"
              aria-label="Status kategori"
            >
              <option value="">Semua status</option>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </Select>
            {bisaKelola && (
              <Button size="sm" variant="primary" data-testid="tambah-kategori" onClick={() => setForm("new")}>
                + Kategori
              </Button>
            )}
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-km-bg">
            <tr>
              <Th>Kode</Th>
              <Th>Nama Kategori</Th>
              <Th>Keterangan</Th>
              <Th>Akun Bawaan</Th>
              <Th className="text-right">Nama Pengeluaran</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-km-ink-muted">
                  Memuat…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-km-ink-muted">
                  {cari || status ? "Data tidak ditemukan" : "Belum ada kategori"}
                </td>
              </tr>
            ) : (
              rows.map((k) => (
                <tr
                  key={k.id}
                  data-testid={`kategori-row-${k.code}`}
                  onClick={() => onPilih(terpilih === k.code ? "" : k.code)}
                  className={`cursor-pointer border-t border-km-border hover:bg-km-panel-soft ${
                    terpilih === k.code ? "bg-km-accent-soft" : ""
                  }`}
                >
                  <Td className="whitespace-nowrap font-mono text-[11px]">{k.code}</Td>
                  <Td>{k.name}</Td>
                  <Td className="text-[11px] text-km-ink-muted">{k.description || "—"}</Td>
                  <Td className="whitespace-nowrap font-mono text-[11px]">
                    {k.default_debit_code ?? "—"}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {k.jumlah_nama_aktif} / {k.jumlah_nama}
                  </Td>
                  <Td>
                    {k.active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    {bisaKelola ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="min-h-[32px]"
                          data-testid={`ubah-kategori-${k.code}`}
                          onClick={() => setForm({ item: k })}
                        >
                          Ubah
                        </Button>
                        <Button
                          size="sm"
                          className="min-h-[32px]"
                          data-testid={`status-kategori-${k.code}`}
                          onClick={() => toggleAktif(k)}
                        >
                          {k.active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        {!k.in_use && k.jumlah_nama === 0 && (
                          <Button
                            size="sm"
                            variant="danger"
                            className="min-h-[32px]"
                            data-testid={`hapus-kategori-${k.code}`}
                            onClick={() => hapus(k)}
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

      {form && (
        <FormKategori
          item={form === "new" ? null : form.item}
          akun={akun}
          onClose={() => setForm(null)}
          onSaved={(pesan) => {
            setForm(null);
            onToast({ message: pesan, tone: "success" });
            onBerubah();
          }}
        />
      )}
    </Card>
  );
}

function FormKategori({
  item,
  akun,
  onClose,
  onSaved,
}: {
  item: KategoriBiaya | null;
  akun: AkunBeban[];
  onClose: () => void;
  onSaved: (pesan: string) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [akunBawaan, setAkunBawaan] = useState(item?.default_debit_code ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (item) {
        await updateKategoriBiaya(item.id, {
          name,
          description: description || null,
          default_debit_code: akunBawaan || null,
        });
        onSaved("Kategori diperbarui");
      } else {
        await createKategoriBiaya({
          code,
          name,
          description: description || null,
          default_debit_code: akunBawaan || null,
        });
        onSaved("Kategori ditambahkan");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan kategori");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={item ? `Ubah Kategori — ${item.name}` : "Tambah Kategori Biaya"}
      onClose={onClose}
      onSubmit={simpan}
      testId="form-kategori"
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={pending} data-testid="simpan-kategori">
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
        <Field
          label="Kode *"
          hint={
            item
              ? "Kode tidak bisa diubah — transaksi lama menyimpan kode ini."
              : "Huruf kecil, angka, dan garis bawah. Contoh: biaya_kebersihan."
          }
        >
          <Input
            required
            data-testid="kategori-kode"
            value={code}
            disabled={item !== null}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <Field label="Nama kategori *">
          <Input
            required
            data-testid="kategori-nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Akun bawaan"
          hint="Dipakai hanya kalau Nama Pengeluaran belum punya akunnya sendiri."
        >
          <Select
            data-testid="kategori-akun"
            value={akunBawaan ?? ""}
            onChange={(e) => setAkunBawaan(e.target.value)}
          >
            <option value="">— Tanpa akun bawaan —</option>
            {akun.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Keterangan">
          <Textarea
            rows={2}
            data-testid="kategori-keterangan"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ── Nama Pengeluaran ────────────────────────────────────────────────────────

function TabelNama({
  bisaKelola,
  akun,
  kategoriList,
  kategoriTerpilih,
  onGantiKategori,
  revisi,
  onBerubah,
  onToast,
}: {
  bisaKelola: boolean;
  akun: AkunBeban[];
  kategoriList: KategoriBiaya[];
  kategoriTerpilih: string;
  onGantiKategori: (code: string) => void;
  revisi: number;
  onBerubah: () => void;
  onToast: (t: ToastMsg) => void;
}) {
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState<"" | "1" | "0">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [res, setRes] = useState<Halaman<NamaPengeluaran> | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<"new" | { item: NamaPengeluaran } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [cari, status, kategoriTerpilih, perPage]);

  const muat = useCallback(() => {
    setLoading(true);
    listNamaPengeluaran({
      q: cari || undefined,
      category: kategoriTerpilih || undefined,
      active: status,
      page,
      per_page: perPage,
    })
      .then(setRes)
      .catch(() => setRes(null))
      .finally(() => setLoading(false));
  }, [cari, status, kategoriTerpilih, page, perPage]);

  useEffect(muat, [muat, revisi]);

  async function toggleAktif(n: NamaPengeluaran) {
    try {
      await updateNamaPengeluaran(n.id, { active: !n.active });
      onToast({ message: n.active ? "Nama dinonaktifkan" : "Nama diaktifkan", tone: "success" });
      onBerubah();
    } catch (e) {
      onToast({ message: e instanceof Error ? e.message : "Gagal mengubah status", tone: "error" });
    }
  }

  async function hapus(n: NamaPengeluaran) {
    if (!window.confirm(`Hapus nama pengeluaran ${n.name}?`)) return;
    try {
      await deleteNamaPengeluaran(n.id);
      onToast({ message: "Nama pengeluaran dihapus", tone: "success" });
      onBerubah();
    } catch (e) {
      onToast({ message: e instanceof Error ? e.message : "Gagal menghapus", tone: "error" });
    }
  }

  const rows = res?.data ?? [];
  const labelKategori = kategoriList.find((k) => k.code === kategoriTerpilih)?.name;

  return (
    <Card>
      <CardHeader
        title={labelKategori ? `Nama Pengeluaran — ${labelKategori}` : "Nama Pengeluaran"}
        subtitle={loading ? "Memuat…" : undefined}
        right={
          <div className="flex items-center gap-2">
            <Input
              data-testid="cari-nama"
              placeholder="Cari nama pengeluaran…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="max-w-44"
              aria-label="Cari nama pengeluaran"
            />
            <Select
              data-testid="filter-kategori-nama"
              value={kategoriTerpilih}
              onChange={(e) => onGantiKategori(e.target.value)}
              className="max-w-44"
              aria-label="Kategori"
            >
              <option value="">Semua kategori</option>
              {kategoriList.map((k) => (
                <option key={k.code} value={k.code}>
                  {k.name}
                </option>
              ))}
            </Select>
            <Select
              data-testid="filter-status-nama"
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | "1" | "0")}
              className="max-w-32"
              aria-label="Status nama"
            >
              <option value="">Semua status</option>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </Select>
            {bisaKelola && (
              <Button size="sm" variant="primary" data-testid="tambah-nama" onClick={() => setForm("new")}>
                + Nama
              </Button>
            )}
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-km-bg">
            <tr>
              <Th>Nama Pengeluaran</Th>
              <Th>Kategori</Th>
              <Th>Akun Biaya (COA)</Th>
              <Th>Berlaku di</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-km-ink-muted">
                  Memuat…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-km-ink-muted">
                  {cari || status || kategoriTerpilih
                    ? "Data tidak ditemukan"
                    : "Belum ada nama pengeluaran"}
                </td>
              </tr>
            ) : (
              rows.map((n) => (
                <tr
                  key={n.id}
                  data-testid={`nama-row-${n.id}`}
                  className="border-t border-km-border hover:bg-km-panel-soft"
                >
                  <Td>
                    <p>{n.name}</p>
                    {n.description && (
                      <p className="text-[11px] text-km-ink-muted">{n.description}</p>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{n.category_label}</Td>
                  <Td className="whitespace-nowrap">
                    <span className="font-mono text-[11px]">{n.coa_account_code ?? "—"}</span>
                    {n.coa_account_name && (
                      <span className="ml-1 text-[11px] text-km-ink-muted">{n.coa_account_name}</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-[11px] text-km-ink-soft">
                    {n.vihara_name ?? "Semua vihara"}
                  </Td>
                  <Td>
                    {n.active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                  </Td>
                  <Td>
                    {bisaKelola ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="min-h-[32px]"
                          data-testid={`ubah-nama-${n.id}`}
                          onClick={() => setForm({ item: n })}
                        >
                          Ubah
                        </Button>
                        <Button
                          size="sm"
                          className="min-h-[32px]"
                          data-testid={`status-nama-${n.id}`}
                          onClick={() => toggleAktif(n)}
                        >
                          {n.active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        {!n.in_use && (
                          <Button
                            size="sm"
                            variant="danger"
                            className="min-h-[32px]"
                            data-testid={`hapus-nama-${n.id}`}
                            onClick={() => hapus(n)}
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

      {form && (
        <FormNama
          item={form === "new" ? null : form.item}
          akun={akun}
          kategoriList={kategoriList}
          kategoriAwal={kategoriTerpilih}
          onClose={() => setForm(null)}
          onSaved={(pesan) => {
            setForm(null);
            onToast({ message: pesan, tone: "success" });
            onBerubah();
          }}
        />
      )}
    </Card>
  );
}

function FormNama({
  item,
  akun,
  kategoriList,
  kategoriAwal,
  onClose,
  onSaved,
}: {
  item: NamaPengeluaran | null;
  akun: AkunBeban[];
  kategoriList: KategoriBiaya[];
  kategoriAwal: string;
  onClose: () => void;
  onSaved: (pesan: string) => void;
}) {
  const [category, setCategory] = useState(item?.category ?? kategoriAwal ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [coa, setCoa] = useState(item?.coa_account_code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kategori baru dipilih dan akunnya masih kosong → pakai akun bawaan
  // kategori itu sebagai saran, supaya tidak perlu diisi dari nol.
  useEffect(() => {
    if (coa) return;
    const k = kategoriList.find((x) => x.code === category);
    if (k?.default_debit_code) setCoa(k.default_debit_code);
  }, [category, kategoriList, coa]);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        category,
        name,
        coa_account_code: coa,
        description: description || null,
      };
      if (item) {
        await updateNamaPengeluaran(item.id, payload);
        onSaved("Nama pengeluaran diperbarui");
      } else {
        await createNamaPengeluaran(payload);
        onSaved("Nama pengeluaran ditambahkan");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan nama pengeluaran");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={item ? `Ubah Nama — ${item.name}` : "Tambah Nama Pengeluaran"}
      onClose={onClose}
      onSubmit={simpan}
      testId="form-nama"
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={pending} data-testid="simpan-nama">
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
        <Field label="Kategori induk *" hint="Boleh dipindah ke kategori lain kapan saja.">
          <Select
            required
            data-testid="nama-kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">— Pilih kategori —</option>
            {kategoriList.map((k) => (
              <option key={k.code} value={k.code}>
                {k.name}
                {k.active ? "" : " (nonaktif)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nama pengeluaran *">
          <Input
            required
            data-testid="nama-nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Akun biaya (COA) *"
          hint="Akun inilah yang jadi akun debit saat pengeluaran ini dijurnal."
        >
          <Select required data-testid="nama-akun" value={coa} onChange={(e) => setCoa(e.target.value)}>
            <option value="">— Pilih akun —</option>
            {akun.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Keterangan">
          <Textarea
            rows={2}
            data-testid="nama-keterangan"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
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

function Td({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td className={`px-3 py-2.5 text-km-ink ${className}`} onClick={onClick}>
      {children}
    </td>
  );
}
