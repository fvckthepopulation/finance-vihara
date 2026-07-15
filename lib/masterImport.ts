import { getToken } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8500";

export type ImportRow = {
  row_no: number;
  data: Record<string, unknown>;
  errors: Record<string, string[]>;
  valid: boolean;
};

export type ImportPreviewResult = {
  header: string[];
  rows: ImportRow[];
  summary: { total: number; valid: number; invalid: number };
};

export type ImportCommitResult = {
  summary: { total: number; valid: number; invalid: number };
  result: { created: number; updated: number; skipped: number };
};

export type MasterImportType =
  | "suppliers"
  | "customers"
  | "bahan-baku"
  | "entities"
  | "locations"
  | "coa";

async function uploadFile<T>(path: string, file: File, extra: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    body: fd,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let payload: unknown = null;
    try { payload = await res.json(); } catch { payload = await res.text(); }
    const err = new Error(
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `HTTP ${res.status}`,
    );
    (err as Error & { payload?: unknown }).payload = payload;
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export function templateDownloadUrl(type: MasterImportType): string {
  return `${API_URL}/api/master-import/${type}/template`;
}

export async function downloadTemplate(type: MasterImportType): Promise<void> {
  const token = getToken();
  const res = await fetch(templateDownloadUrl(type), {
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Gagal download template (HTTP ${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `template-${type}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function previewImport(type: MasterImportType, file: File): Promise<ImportPreviewResult> {
  return uploadFile<ImportPreviewResult>(`/api/master-import/${type}/preview`, file);
}

export function commitImport(type: MasterImportType, file: File, skipInvalid: boolean): Promise<ImportCommitResult> {
  return uploadFile<ImportCommitResult>(`/api/master-import/${type}/commit`, file, {
    skip_invalid: skipInvalid ? "1" : "0",
  });
}
