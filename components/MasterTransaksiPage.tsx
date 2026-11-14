"use client";

import {
  FormEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppShell } from "@/components/AppShell";
import { Td, TdAksi, Th, ThAksi } from "@/components/Tabel";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { Field, Input, Select, Textarea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import { Toast } from "@/components/Toast";
import {
  AkunMaster,
  JenisPembatasan,
  LABEL_PEMBATASAN,
  ringkasAkunPerMetode,
  createKategori,
  createNama,
  deleteKategori,
  deleteNama,
  Halaman,
  JenisMaster,
  KategoriTransaksi,
  listAkunMaster,
  listKategori,
  listNama,
  NamaTransaksi,
  updateKategori,
  updateNama,
} from "@/lib/masterTransaksi";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Layar master transaksi dua tingkat — dipakai Master Pengeluaran (FV-29) DAN
// Master Penerimaan (FV-45).
//
// Dua tingkat dalam satu layar: Kategori sebagai induk, Nama sebagai anaknya.
// Memilih kategori di tabel atas menyaring tabel bawah — itu pula urutan yang
// dipakai form inputnya.
//
// Akun COA di tingkat Nama bukan sekadar catatan. Untuk pengeluaran, akun
// itulah yang jadi akun DEBIT saat dijurnal, jadi wajib. Untuk penerimaan
// akunnya OPSIONAL: kosong berarti "ikuti aturan kanal" (41x0 KalyanaMitta /
// 42x0 transfer / 43x0 tunai, digit ke-3 menandai pembatasan ISAK 35) —
// perilaku yang sudah berjalan dan yang dipakai seluruh nama bawaan.
//
// Seluruh sebutan di layar datang dari satu berkas label (lib/labelMaster.ts)
// lewat konteks, bukan prop yang dirantai turun — supaya menambah jenis master
// berikutnya tidak berarti menyentuh setiap komponen di sini.
// ============================================================================

type ToastMsg = { message: string; tone: "success" | "error" };

/** Sebutan per jenis master. Nilainya ada di lib/labelMaster.ts. */
export type LabelMaster = {
  jenis: JenisMaster;
  /** Judul halaman, mis. "Master Pengeluaran". */
  judul: string;
  subjudul: string;
  /** "Kategori Biaya" / "Kategori Dana". */
  kategori: string;
  /** "Nama Pengeluaran" / "Nama Penerimaan". */
  nama: string;
  /** Huruf kecil, untuk di tengah kalimat: "nama pengeluaran". */
  namaKecil: string;
  /** Label kolom & field akun, mis. "Akun Biaya (COA)". */
  akun: string;
  akunHint: string;
  /** Akun di tingkat Nama wajib diisi? (pengeluaran ya, penerimaan tidak) */
  akunWajib: boolean;
  /** Keterangan field "Akun bawaan" di form kategori. */
  bawaanHint: string;
  /** Contoh kode kategori di keterangan form. */
  contohKode: string;
  /** Kategori punya Jenis Pembatasan ISAK 35? (kategori dana saja) */
  punyaPembatasan: boolean;
  /**
   * Nama punya akun COA sendiri? Penerimaan: tidak — akunnya diwarisi dari
   * pembatasan kategorinya (FV-49).
   */
  akunPerNama: boolean;
};

const KonteksLabel = createContext<LabelMaster | null>(null);

function useLabel(): LabelMaster {
  const l = useContext(KonteksLabel);
  if (!l) throw new Error("MasterTransaksiPage: label master belum disediakan");
  return l;
}

export function MasterTransaksiPage({ label }: { label: LabelMaster }) {
  return (
    <KonteksLabel.Provider value={label}>
      <Isi />
    </KonteksLabel.Provider>
  );
}

function Isi() {
  const L = useLabel();
  const { can } = useAuth();
  const bisaKelola = can("masters.manage");

  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [kategoriTerpilih, setKategoriTerpilih] = useState<string>("");
  const [akun, setAkun] = useState<AkunMaster[]>([]);
  const [semuaKategori, setSemuaKategori] = useState<KategoriTransaksi[]>([]);
  const [revisi, setRevisi] = useState(0);

  useEffect(() => {
    listAkunMaster(L.jenis)
      .then(setAkun)
      .catch(() => setAkun([]));
  }, []);

  // Dipakai dropdown "kategori induk" di form nama — perlu seluruh kategori,
  // bukan hanya satu halaman.
  useEffect(() => {
    listKategori(L.jenis, { per_page: 100 })
      .then((r) => setSemuaKategori(r.data))
      .catch(() => setSemuaKategori([]));
  }, [revisi]);

  const segar = () => setRevisi((n) => n + 1);

  return (
    <AppShell title={L.judul} subtitle={L.subjudul}>
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
  akun: AkunMaster[];
  terpilih: string;
  onPilih: (code: string) => void;
  revisi: number;
  onBerubah: () => void;
  onToast: (t: ToastMsg) => void;
}) {
  const L = useLabel();
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState<"" | "1" | "0">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [res, setRes] = useState<Halaman<KategoriTransaksi> | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<"new" | { item: KategoriTransaksi } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [cari, status, perPage]);

  const muat = useCallback(() => {
    setLoading(true);
    listKategori(L.jenis, { q: cari || undefined, active: status, page, per_page: perPage })
      .then(setRes)
      .catch(() => setRes(null))
      .finally(() => setLoading(false));
  }, [cari, status, page, perPage]);

  useEffect(muat, [muat, revisi]);

  async function toggleAktif(k: KategoriTransaksi) {
    try {
      await updateKategori(L.jenis, k.id, { active: !k.active });
      onToast({ message: k.active ? "Kategori dinonaktifkan" : "Kategori diaktifkan", tone: "success" });
      onBerubah();
    } catch (e) {
      const pesan = e instanceof Error ? e.message : "Gagal mengubah status";
      // Masih punya nama aktif → tawarkan menonaktifkan semuanya sekaligus,
      // bukan berhenti dengan pesan error saja.
      // Pesan server: "Kategori masih punya N Nama <jenis> aktif."
      if (
        /masih punya .* aktif/i.test(pesan) &&
        window.confirm(`${pesan}\n\nNonaktifkan semuanya sekarang?`)
      ) {
        try {
          await updateKategori(L.jenis, k.id, { active: false, nonaktifkan_anak: true });
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

  async function hapus(k: KategoriTransaksi) {
    if (!window.confirm(`Hapus kategori ${k.name}?`)) return;
    try {
      await deleteKategori(L.jenis, k.id);
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
        title={L.kategori}
        subtitle={
          loading ? "Memuat…" : `Pilih satu kategori untuk menyaring ${L.nama} di bawah`
        }
        right={
          <div className="flex flex-wrap items-center justify-end gap-2 md:flex-nowrap">
            <Input
              data-testid="cari-kategori"
              placeholder="Cari kategori…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="max-w-44"
              aria-label={`Cari ${L.kategori}`}
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
              <Button variant="primary" data-testid="tambah-kategori" onClick={() => setForm("new")}>
                + Tambah Kategori
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
              {L.punyaPembatasan && <Th>Jenis Pembatasan</Th>}
              <Th>Keterangan</Th>
              <Th>{L.punyaPembatasan ? "Akun Pendapatan" : "Akun Bawaan"}</Th>
              <Th className="text-right">{L.nama}</Th>
              <Th>Status</Th>
              <ThAksi />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={L.punyaPembatasan ? 8 : 7} className="px-3 py-8 text-center text-km-ink-muted">
                  Memuat…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={L.punyaPembatasan ? 8 : 7} className="px-3 py-8 text-center text-km-ink-muted">
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
                  <Td className="whitespace-nowrap kode text-[11px]">{k.code}</Td>
                  <Td>{k.name}</Td>
                  {L.punyaPembatasan && (
                    <Td className="whitespace-nowrap text-[11px]">
                      {k.restriction_label ?? "—"}
                    </Td>
                  )}
                  <Td className="text-[11px] text-km-ink-muted">{k.description || "—"}</Td>
                  {/* Akun yang BENAR-BENAR dipakai saat menjurnal. Untuk
                      kategori dana akunnya diturunkan per kanal, jadi
                      ditampilkan ketiganya — bukan "—" (FV-49). */}
                  <Td className="whitespace-nowrap kode text-[11px]">
                    {L.punyaPembatasan
                      ? ringkasAkunPerMetode(k.akun_per_metode)
                      : (k.default_debit_code ?? "—")}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {k.jumlah_nama_aktif} / {k.jumlah_nama}
                  </Td>
                  <Td>
                    {k.active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                  </Td>
                  <TdAksi onClick={(e) => e.stopPropagation()}>
                    {bisaKelola ? (
                      <>
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
                      </>
                    ) : (
                      <span className="text-[11px] text-km-ink-muted">—</span>
                    )}
                  </TdAksi>
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
  item: KategoriTransaksi | null;
  akun: AkunMaster[];
  onClose: () => void;
  onSaved: (pesan: string) => void;
}) {
  const L = useLabel();
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [restriction, setRestriction] = useState<JenisPembatasan | "">(
    item?.restriction ?? "",
  );
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
        await updateKategori(L.jenis, item.id, {
          name,
          ...(L.punyaPembatasan ? { restriction: (restriction || null) as JenisPembatasan } : {}),
          description: description || null,
          default_debit_code: akunBawaan || null,
        });
        onSaved("Kategori diperbarui");
      } else {
        await createKategori(L.jenis, {
          code,
          name,
          ...(L.punyaPembatasan ? { restriction: (restriction || null) as JenisPembatasan } : {}),
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
      title={item ? `Ubah Kategori — ${item.name}` : `Tambah ${L.kategori}`}
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
              : `Huruf kecil, angka, dan garis bawah. Contoh: ${L.contohKode}.`
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
        {L.punyaPembatasan && (
          <Field
            label="Jenis Pembatasan *"
            hint={
              item?.in_use
                ? "Tidak bisa diubah: kategori ini sudah dipakai transaksi."
                : "Menentukan akun pendapatan yang dipakai saat menjurnal, dan kolom TP/DP di laporan ISAK 35."
            }
          >
            <Select
              required
              data-testid="kategori-pembatasan"
              value={restriction}
              disabled={item?.in_use ?? false}
              onChange={(e) => setRestriction(e.target.value as JenisPembatasan | "")}
            >
              <option value="">— Pilih jenis pembatasan —</option>
              {(Object.keys(LABEL_PEMBATASAN) as JenisPembatasan[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_PEMBATASAN[k]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label="Akun bawaan"
          hint={L.bawaanHint}
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
  akun: AkunMaster[];
  kategoriList: KategoriTransaksi[];
  kategoriTerpilih: string;
  onGantiKategori: (code: string) => void;
  revisi: number;
  onBerubah: () => void;
  onToast: (t: ToastMsg) => void;
}) {
  const L = useLabel();
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState<"" | "1" | "0">("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [res, setRes] = useState<Halaman<NamaTransaksi> | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<"new" | { item: NamaTransaksi } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [cari, status, kategoriTerpilih, perPage]);

  const muat = useCallback(() => {
    setLoading(true);
    listNama(L.jenis, {
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

  async function toggleAktif(n: NamaTransaksi) {
    try {
      await updateNama(L.jenis, n.id, { active: !n.active });
      onToast({ message: n.active ? "Nama dinonaktifkan" : "Nama diaktifkan", tone: "success" });
      onBerubah();
    } catch (e) {
      onToast({ message: e instanceof Error ? e.message : "Gagal mengubah status", tone: "error" });
    }
  }

  async function hapus(n: NamaTransaksi) {
    if (!window.confirm(`Hapus ${L.namaKecil} ${n.name}?`)) return;
    try {
      await deleteNama(L.jenis, n.id);
      onToast({ message: `${L.nama} dihapus`, tone: "success" });
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
        title={labelKategori ? `${L.nama} — ${labelKategori}` : L.nama}
        subtitle={loading ? "Memuat…" : undefined}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2 md:flex-nowrap">
            <Input
              data-testid="cari-nama"
              placeholder={`Cari ${L.namaKecil}…`}
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="max-w-44"
              aria-label={`Cari ${L.namaKecil}`}
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
              <Button variant="primary" data-testid="tambah-nama" onClick={() => setForm("new")}>
                + Tambah {L.nama}
              </Button>
            )}
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-km-bg">
            <tr>
              <Th>{L.nama}</Th>
              <Th>Kategori</Th>
              <Th>{L.akun}</Th>
              <Th>Berlaku di</Th>
              <Th>Status</Th>
              <ThAksi />
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
                    : `Belum ada ${L.namaKecil}`}
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
                    {L.akunPerNama ? (
                      <>
                        <span className="kode text-[11px]">{n.coa_account_code ?? "—"}</span>
                        {n.coa_account_name && (
                          <span className="ml-1 text-[11px] text-km-ink-muted">
                            {n.coa_account_name}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="kode text-[11px] text-km-ink-soft">
                        {ringkasAkunPerMetode(n.akun_per_metode ?? null)}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-[11px] text-km-ink-soft">
                    {n.vihara_name ?? "Semua vihara"}
                  </Td>
                  <Td>
                    {n.active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                  </Td>
                  <TdAksi>
                    {bisaKelola ? (
                      <>
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
                      </>
                    ) : (
                      <span className="text-[11px] text-km-ink-muted">—</span>
                    )}
                  </TdAksi>
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
  item: NamaTransaksi | null;
  akun: AkunMaster[];
  kategoriList: KategoriTransaksi[];
  kategoriAwal: string;
  onClose: () => void;
  onSaved: (pesan: string) => void;
}) {
  const L = useLabel();
  const [category, setCategory] = useState(item?.category ?? kategoriAwal ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [coa, setCoa] = useState(item?.coa_account_code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kategori baru dipilih dan akunnya masih kosong → pakai akun bawaan
  // kategori itu sebagai saran, supaya tidak perlu diisi dari nol.
  useEffect(() => {
    if (!L.akunPerNama || coa) return;
    const k = kategoriList.find((x) => x.code === category);
    if (k?.default_debit_code) setCoa(k.default_debit_code);
  }, [L.akunPerNama, category, kategoriList, coa]);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const payload = {
        category,
        name,
        // Penerimaan boleh tanpa akun tetap — null, bukan string kosong.
        coa_account_code: coa || null,
        description: description || null,
      };
      if (item) {
        await updateNama(L.jenis, item.id, payload);
        onSaved(`${L.nama} diperbarui`);
      } else {
        await createNama(L.jenis, payload);
        onSaved(`${L.nama} ditambahkan`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : `Gagal menyimpan ${L.namaKecil}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={item ? `Ubah Nama — ${item.name}` : `Tambah ${L.nama}`}
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
        <Field label={`${L.nama} *`}>
          <Input
            required
            data-testid="nama-nama"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {L.akunPerNama ? (
          <Field label={L.akunWajib ? `${L.akun} *` : L.akun} hint={L.akunHint}>
            <Select
              required={L.akunWajib}
              data-testid="nama-akun"
              value={coa}
              onChange={(e) => setCoa(e.target.value)}
            >
              <option value="">— Pilih akun —</option>
              {akun.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          /* Penerimaan: akunnya milik kategori, bukan nama. Ditampilkan
             sebagai keterangan supaya admin tetap bisa memeriksanya tanpa
             tergoda mengubahnya di sini (FV-49). */
          <Field label={L.akun} hint={L.akunHint}>
            <Input
              readOnly
              disabled
              data-testid="nama-akun-warisan"
              value={ringkasAkunPerMetode(
                kategoriList.find((k) => k.code === category)?.akun_per_metode ?? null,
              )}
            />
          </Field>
        )}
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
