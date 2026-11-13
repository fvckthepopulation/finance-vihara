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
import { getMyScope, ScopeVihara } from "@/lib/api";
import { CoaAccount, listCoa } from "@/lib/coa";
import {
  createViharaBankAccount,
  deleteViharaBankAccount,
  JENIS_REKENING,
  JenisRekening,
  listMasterRekening,
  MasterRekeningPage,
  MasterRekeningRow,
  updateViharaBankAccount,
} from "@/lib/kasBank";
import { useAuth } from "@/lib/useAuth";

// ============================================================================
// Master Rekening (FV-30).
//
// Rekening vihara sudah lama tersimpan beserta akun COA-nya, tapi satu-satunya
// cara mengelolanya adalah panel kecil di dalam baris Admin → Vihara: tidak
// ada daftar lintas vihara, tidak ada pencarian, dan tidak ada tempat untuk
// membedakan rekening bank dari kas tunai.
//
// Akun COA di sini bukan hiasan: dialah yang menentukan akun KREDIT saat
// pengeluaran dijurnal (dan DEBIT untuk penerimaan), jadi wajib diisi.
// ============================================================================

const KOSONG = { cari: "", jenis: "" as JenisRekening | "", status: "" as "" | "1" | "0", vihara: "" };

export default function MasterRekeningPage_() {
  const { can } = useAuth();
  const bisaKelola = can("cash.account.manage") || can("masters.manage");

  const [f, setF] = useState({ ...KOSONG });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [res, setRes] = useState<MasterRekeningPage | null>(null);
  const [viharas, setViharas] = useState<ScopeVihara[]>([]);
  const [akun, setAkun] = useState<CoaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | { item: MasterRekeningRow } | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    getMyScope()
      .then((d) => setViharas(d.viharas))
      .catch(() => setViharas([]));
    // Hanya akun kas/bank (1xxx aset) yang masuk akal sebagai akun rekening.
    listCoa({ type: "asset", active: true })
      .then((list) => setAkun(list.filter((a) => !a.is_header && /^11/.test(a.code))))
      .catch(() => setAkun([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [f, perPage]);

  const muat = useCallback(() => {
    setLoading(true);
    setError(null);
    listMasterRekening({
      q: f.cari || undefined,
      type: f.jenis || undefined,
      active: f.status,
      vihara_id: f.vihara ? Number(f.vihara) : null,
      page,
      per_page: perPage,
    })
      .then(setRes)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [f, page, perPage]);

  useEffect(muat, [muat]);

  async function toggleAktif(b: MasterRekeningRow) {
    try {
      await updateViharaBankAccount(b.id, { active: !b.active });
      setToast({ message: b.active ? "Rekening dinonaktifkan" : "Rekening diaktifkan", tone: "success" });
      muat();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Gagal mengubah status", tone: "error" });
    }
  }

  async function hapus(b: MasterRekeningRow) {
    if (!window.confirm(`Hapus rekening ${b.label}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteViharaBankAccount(b.id);
      setToast({ message: "Rekening dihapus", tone: "success" });
      muat();
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : "Gagal menghapus", tone: "error" });
    }
  }

  const rows = res?.data ?? [];

  return (
    <AppShell title="Master Rekening" subtitle="Rekening bank & kas tunai per vihara">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      <Card className="mb-3.5">
        <div className="grid grid-cols-1 gap-2.5 px-4 py-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cari">
            <Input
              data-testid="cari-rekening"
              placeholder="Nama bank, no. rekening, atas nama…"
              value={f.cari}
              onChange={(e) => setF({ ...f, cari: e.target.value })}
            />
          </Field>
          <Field label="Vihara">
            <Select
              data-testid="filter-vihara"
              value={f.vihara}
              onChange={(e) => setF({ ...f, vihara: e.target.value })}
            >
              <option value="">Semua vihara</option>
              {viharas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jenis">
            <Select
              data-testid="filter-jenis"
              value={f.jenis}
              onChange={(e) => setF({ ...f, jenis: e.target.value as JenisRekening | "" })}
            >
              <option value="">Semua jenis</option>
              {(Object.keys(JENIS_REKENING) as JenisRekening[]).map((k) => (
                <option key={k} value={k}>
                  {JENIS_REKENING[k]}
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
            <Button size="sm" variant="primary" data-testid="tambah-rekening" onClick={() => setForm("new")}>
              + Tambah Rekening
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Daftar Rekening" subtitle={loading ? "Memuat…" : undefined} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                <Th>Vihara</Th>
                <Th>Jenis</Th>
                <Th>Nama Bank / Kas</Th>
                <Th>No. Rekening</Th>
                <Th>Atas Nama</Th>
                <Th>Akun COA</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-km-ink-muted">
                    Memuat…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-km-ink-muted">
                    {f.cari || f.jenis || f.status || f.vihara
                      ? "Data tidak ditemukan"
                      : "Belum ada rekening"}
                  </td>
                </tr>
              ) : (
                rows.map((b) => (
                  <tr
                    key={b.id}
                    data-testid={`rekening-row-${b.id}`}
                    className="border-t border-km-border hover:bg-km-panel-soft"
                  >
                    <Td className="whitespace-nowrap">{b.vihara_name ?? "—"}</Td>
                    <Td>
                      <Badge tone={b.type === "bank" ? "info" : "neutral"}>{b.type_label}</Badge>
                    </Td>
                    <Td>{b.bank_name}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{b.account_number || "—"}</Td>
                    <Td>{b.account_name || "—"}</Td>
                    <Td className="whitespace-nowrap">
                      <span className="font-mono text-[11px]">{b.coa_account_code ?? "—"}</span>
                      {b.coa_account_name && (
                        <span className="ml-1 text-[11px] text-km-ink-muted">{b.coa_account_name}</span>
                      )}
                    </Td>
                    <Td>
                      {b.active ? (
                        <Badge tone="success">Aktif</Badge>
                      ) : (
                        <Badge tone="neutral">Nonaktif</Badge>
                      )}
                    </Td>
                    <Td>
                      {bisaKelola ? (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            className="min-h-[32px]"
                            data-testid={`ubah-rekening-${b.id}`}
                            onClick={() => setForm({ item: b })}
                          >
                            Ubah
                          </Button>
                          <Button
                            size="sm"
                            className="min-h-[32px]"
                            data-testid={`status-rekening-${b.id}`}
                            onClick={() => toggleAktif(b)}
                          >
                            {b.active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          {/* Yang sudah dipakai transaksi tidak boleh dihapus —
                              baris lama harus tetap menunjuk rekeningnya. */}
                          {!b.in_use && (
                            <Button
                              size="sm"
                              variant="danger"
                              className="min-h-[32px]"
                              data-testid={`hapus-rekening-${b.id}`}
                              onClick={() => hapus(b)}
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
        <RekeningForm
          item={form === "new" ? null : form.item}
          viharas={viharas}
          akun={akun}
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

function RekeningForm({
  item,
  viharas,
  akun,
  onClose,
  onSaved,
}: {
  item: MasterRekeningRow | null;
  viharas: ScopeVihara[];
  akun: CoaAccount[];
  onClose: () => void;
  onSaved: (pesan: string) => void;
}) {
  const [viharaId, setViharaId] = useState<string>(
    item ? String(item.vihara_id) : viharas.length === 1 ? String(viharas[0].id) : "",
  );
  const [jenis, setJenis] = useState<JenisRekening>(item?.type ?? "bank");
  const [namaBank, setNamaBank] = useState(item?.bank_name ?? "");
  const [nomor, setNomor] = useState(item?.account_number ?? "");
  const [atasNama, setAtasNama] = useState(item?.account_name ?? "");
  const [coa, setCoa] = useState(item?.coa_account_code ?? "");
  const [keterangan, setKeterangan] = useState(item?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bank = jenis === "bank";

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!item && !viharaId) {
      setError("Pilih vihara pemilik rekening.");
      return;
    }
    setPending(true);
    try {
      const payload = {
        type: jenis,
        bank_name: namaBank,
        account_number: bank ? nomor : null,
        account_name: atasNama || null,
        coa_account_code: coa,
        description: keterangan || null,
      };
      if (item) {
        await updateViharaBankAccount(item.id, payload);
        onSaved("Rekening diperbarui");
      } else {
        await createViharaBankAccount(Number(viharaId), payload);
        onSaved("Rekening ditambahkan");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan rekening");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={item ? `Ubah Rekening — ${item.label}` : "Tambah Rekening"}
      onClose={onClose}
      onSubmit={simpan}
      testId="form-rekening-master"
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" disabled={pending} data-testid="simpan-rekening">
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
        <Field label="Vihara pemilik *">
          <Select
            required
            data-testid="rekening-vihara"
            value={viharaId}
            disabled={item !== null}
            onChange={(e) => setViharaId(e.target.value)}
          >
            <option value="">— Pilih vihara —</option>
            {viharas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Jenis *">
          <Select
            required
            data-testid="rekening-jenis"
            value={jenis}
            onChange={(e) => setJenis(e.target.value as JenisRekening)}
          >
            {(Object.keys(JENIS_REKENING) as JenisRekening[]).map((k) => (
              <option key={k} value={k}>
                {JENIS_REKENING[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={bank ? "Nama bank *" : "Nama kas *"}>
          <Input
            required
            data-testid="rekening-nama-bank"
            placeholder={bank ? "Bank BCA" : "Kas Tunai Vihara"}
            value={namaBank}
            onChange={(e) => setNamaBank(e.target.value)}
          />
        </Field>
        {bank && (
          <Field label="Nomor rekening *">
            <Input
              required
              data-testid="rekening-nomor"
              placeholder="6280-3488-88"
              value={nomor ?? ""}
              onChange={(e) => setNomor(e.target.value)}
            />
          </Field>
        )}
        <Field label="Atas nama">
          <Input
            data-testid="rekening-atas-nama"
            value={atasNama ?? ""}
            onChange={(e) => setAtasNama(e.target.value)}
          />
        </Field>
        <Field
          label="Akun COA kas/bank *"
          hint="Akun inilah yang dipakai jurnal — kredit saat pengeluaran, debit saat penerimaan."
        >
          <Select
            required
            data-testid="rekening-coa"
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
        <Field label="Keterangan">
          <Textarea
            rows={2}
            data-testid="rekening-keterangan"
            value={keterangan ?? ""}
            onChange={(e) => setKeterangan(e.target.value)}
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

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
