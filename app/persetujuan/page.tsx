"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { DanaTag } from "@/components/DanaTag";
import { Toast } from "@/components/Toast";
import { deletePembayaran, postPembayaran } from "@/lib/pembayaran";
import { deletePenerimaan, postPenerimaan } from "@/lib/penerimaan";
import { listTransactions, TransactionRow } from "@/lib/transactions";
import { useAuth } from "@/lib/useAuth";
import { useVihara } from "@/lib/useVihara";

// ============================================================================
// Persetujuan transaksi.
//
// Model izin memisahkan "boleh mencatat" (*.create) dari "boleh menyetujui"
// (*.approve), tapi sebelumnya form selalu memposting begitu disimpan. Role
// yang hanya punya .create karenanya mustahil dipakai: pembuatannya berhasil,
// postingnya 403, dan yang tertinggal adalah draft yang tidak muncul di layar
// mana pun.
//
// Halaman ini melengkapi separuh yang hilang: tempat pemegang .approve
// melihat draft yang menunggu, lalu memposting atau menolaknya.
// ============================================================================

const fmtRp = (n: string | number) =>
  "Rp " + Math.round(typeof n === "string" ? Number(n) : n).toLocaleString("id-ID");

export default function PersetujuanPage() {
  const { can } = useAuth();
  const { viharaId, ready } = useVihara();

  const bisaPengeluaran = can("pembayaran.approve");
  const bisaPenerimaan = can("penerimaan.approve");
  // Menolak berarti menghapus draftnya — izinnya sama dengan yang membuat.
  const bisaTolakPengeluaran = can("pembayaran.create");
  const bisaTolakPenerimaan = can("penerimaan.create");

  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const reload = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    listTransactions({ status: "draft", vihara_id: viharaId, per_page: 100 })
      .then((r) => setRows(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [viharaId, ready]);

  useEffect(reload, [reload]);

  function bolehSetujui(r: TransactionRow) {
    return r.tipe === "Pengeluaran" ? bisaPengeluaran : bisaPenerimaan;
  }
  function bolehTolak(r: TransactionRow) {
    return r.tipe === "Pengeluaran" ? bisaTolakPengeluaran : bisaTolakPenerimaan;
  }

  async function setujui(r: TransactionRow) {
    setBusy(r.id);
    setError(null);
    try {
      if (r.tipe === "Pengeluaran") await postPembayaran(r.id);
      else await postPenerimaan(r.id);
      setToast(`${r.code} disetujui dan diposting`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyetujui");
    } finally {
      setBusy(null);
    }
  }

  async function tolak(r: TransactionRow) {
    if (
      !confirm(
        `Tolak ${r.code}?\n\nDraft ini akan DIHAPUS beserta lampirannya. Tindakan ini tidak bisa dibatalkan.`,
      )
    ) {
      return;
    }
    setBusy(r.id);
    setError(null);
    try {
      if (r.tipe === "Pengeluaran") await deletePembayaran(r.id);
      else await deletePenerimaan(r.id);
      setToast(`${r.code} ditolak dan dihapus`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menolak");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell
      title="Persetujuan"
      subtitle="Transaksi draft yang menunggu disetujui"
    >
      {toast && <Toast message={toast} tone="success" onClose={() => setToast(null)} />}

      {error && (
        <p className="mb-3 whitespace-pre-line rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      <Card>
        <CardHeader
          title="Menunggu persetujuan"
          subtitle={
            loading ? "Memuat…" : `${rows.length} transaksi draft dalam jangkauan Anda`
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-km-bg">
              <tr>
                <Th>Tanggal</Th>
                <Th>Kode</Th>
                <Th>Tipe</Th>
                <Th>Vihara</Th>
                <Th>Keterangan</Th>
                <Th>Kategori</Th>
                <Th className="text-right">Jumlah</Th>
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
                    Tidak ada transaksi yang menunggu persetujuan
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={`${r.tipe}-${r.id}`}
                    className="border-t border-km-border hover:bg-km-panel-soft"
                  >
                    <Td className="whitespace-nowrap">{r.date.slice(0, 10)}</Td>
                    <Td className="font-mono text-[11px]">{r.code}</Td>
                    <Td>
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          r.tipe === "Pengeluaran"
                            ? "bg-km-red-soft text-km-red"
                            : "bg-km-green-soft text-km-green"
                        }`}
                      >
                        {r.tipe}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">{r.vihara_name ?? "—"}</Td>
                    <Td>{r.name ?? "—"}</Td>
                    <Td>
                      <DanaTag category={r.category} label={r.category_label} />
                    </Td>
                    <Td className="text-right font-mono tabular-nums font-medium">
                      {fmtRp(r.amount)}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        {bolehSetujui(r) ? (
                          <Button
                            size="sm"
                            variant="success"
                            disabled={busy === r.id}
                            onClick={() => setujui(r)}
                            data-testid={`setujui-${r.tipe}-${r.id}`}
                          >
                            {busy === r.id ? "…" : "Setujui"}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-km-ink-muted">
                            Bukan wewenang Anda
                          </span>
                        )}
                        {bolehTolak(r) && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={busy === r.id}
                            onClick={() => tolak(r)}
                            data-testid={`tolak-${r.tipe}-${r.id}`}
                          >
                            Tolak
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
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
