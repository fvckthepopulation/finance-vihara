"use client";

import { useRef, useState } from "react";
import {
  commitImport,
  downloadTemplate,
  ImportPreviewResult,
  MasterImportType,
  previewImport,
} from "@/lib/masterImport";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Modal } from "./Modal";

type Props = {
  type: MasterImportType;
  label?: string;
  onImported?: () => void;
};

export function ImportExcelButton({ type, label = "Import dari Excel", onImported }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>↥ {label}</Button>
      {open && (
        <ImportExcelModal
          type={type}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); onImported?.(); }}
        />
      )}
    </>
  );
}

function ImportExcelModal({
  type,
  onClose,
  onDone,
}: {
  type: MasterImportType;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [committed, setCommitted] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setError(null);
    setCommitted(null);
    if (!f) return;
    setPending(true);
    try {
      const result = await previewImport(type, f);
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal preview");
    } finally {
      setPending(false);
    }
  }

  async function handleDownloadTemplate() {
    setError(null);
    try {
      await downloadTemplate(type);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal download");
    }
  }

  async function handleCommit() {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const result = await commitImport(type, file, skipInvalid);
      setCommitted(result.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal import");
    } finally {
      setPending(false);
    }
  }

  const summary = preview?.summary;
  const hasInvalid = (summary?.invalid ?? 0) > 0;
  const canCommit = !!file && !!summary && (skipInvalid || !hasInvalid);

  return (
    <Modal
      title={
        <span className="flex flex-col">
          <span>Import Excel — {type}</span>
          <span className="text-[11px] font-normal text-km-ink-muted">
            Upload .xlsx → preview validasi → commit.
          </span>
        </span>
      }
      onClose={onClose}
      width="max-w-5xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          {committed ? (
            <Button variant="primary" onClick={onDone}>Selesai</Button>
          ) : (
            <>
              <Button variant="default" onClick={onClose}>Batal</Button>
              <Button variant="primary" onClick={handleCommit} disabled={!canCommit || pending}>
                {pending ? "…" : `Commit ${summary?.valid ?? 0} baris`}
              </Button>
            </>
          )}
        </div>
      }
    >

        <div className="space-y-3 px-4 py-4">
          {!committed && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-km-border bg-km-panel-soft px-3 py-2.5">
              <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>↓ Download template</Button>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <Button variant="primary" size="sm" onClick={() => fileInput.current?.click()} disabled={pending}>
                {file ? "Ganti file" : "Pilih file .xlsx"}
              </Button>
              {file && <span className="text-[11px] text-km-ink-muted">{file.name}</span>}
              {pending && <span className="text-[11px] text-km-ink-muted">Memproses…</span>}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">{error}</div>
          )}

          {committed && (
            <div className="space-y-2 rounded-lg border border-km-teal bg-km-teal-soft px-3 py-3 text-[12px] text-km-teal-ink">
              <p className="font-medium">Import selesai.</p>
              <p>Created: <strong>{committed.created}</strong> · Updated: <strong>{committed.updated}</strong> · Skipped: <strong>{committed.skipped}</strong></p>
            </div>
          )}

          {preview && !committed && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <Badge tone="info">Total: {summary!.total}</Badge>
                <Badge tone="success">Valid: {summary!.valid}</Badge>
                {hasInvalid && <Badge tone="danger">Invalid: {summary!.invalid}</Badge>}
                {hasInvalid && (
                  <label className="ml-auto flex items-center gap-1.5">
                    <input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} className="h-3.5 w-3.5 accent-km-blue" />
                    <span>Lewati baris error</span>
                  </label>
                )}
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-lg border border-km-border">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-km-panel-soft">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-km-ink-muted">Row</th>
                      <th className="px-2 py-2 text-left font-medium text-km-ink-muted">Status</th>
                      {preview.header.map((h) => (
                        <th key={h} className="px-2 py-2 text-left font-medium text-km-ink-muted whitespace-nowrap">{h}</th>
                      ))}
                      <th className="px-2 py-2 text-left font-medium text-km-ink-muted">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.row_no} className={`border-t border-km-border ${r.valid ? "" : "bg-km-red-soft/40"}`}>
                        <td className="px-2 py-1.5 kode">{r.row_no}</td>
                        <td className="px-2 py-1.5">
                          <Badge tone={r.valid ? "success" : "danger"}>{r.valid ? "OK" : "Error"}</Badge>
                        </td>
                        {preview.header.map((h) => {
                          const norm = h.toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
                          const v = r.data[norm];
                          return (
                            <td key={h} className="px-2 py-1.5 whitespace-nowrap">
                              {v === null || v === undefined ? <span className="text-km-ink-muted">—</span> : String(v)}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-km-red-ink">
                          {Object.entries(r.errors).map(([field, msgs]) => (
                            <div key={field}><strong>{field}:</strong> {msgs.join("; ")}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                    {preview.rows.length === 0 && (
                      <tr><td colSpan={preview.header.length + 3} className="px-3 py-6 text-center text-km-ink-muted">Tidak ada baris di file.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

    </Modal>
  );
}
