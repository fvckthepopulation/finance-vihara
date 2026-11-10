import { api, Paginated } from "./api";

export type Vihara = {
  id: number;
  /** Yayasan penaung — inti hirarki Yayasan -> Vihara. */
  entity_id: number | null;
  entity?: { id: number; code: string; legal_name: string } | null;
  code: string;
  name: string;
  address: string | null;
  contact_pic: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  npwp: string | null;
  active: boolean;
  verified_at: string | null;
  verified_by_user_id: number | null;
  verified_by?: { id: number; name: string; email: string } | null;
  created_at: string;
  updated_at: string;
};

export type ListViharaParams = { q?: string; active_only?: boolean; page?: number; entity_id?: number };

export async function listViharas(params: ListViharaParams = {}): Promise<Paginated<Vihara>> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.active_only) qs.set("active_only", "1");
  if (params.page) qs.set("page", String(params.page));
  if (params.entity_id) qs.set("entity_id", String(params.entity_id));
  const suffix = qs.toString() ? `?${qs}` : "";
  return api<Paginated<Vihara>>(`/api/viharas${suffix}`);
}

export async function getVihara(id: number): Promise<Vihara> {
  return api<Vihara>(`/api/viharas/${id}`);
}

export type ViharaInput = {
  /** Wajib bagi admin global; admin yayasan otomatis ikut yayasannya. */
  entity_id?: number | null;
  name: string;
  address?: string | null;
  contact_pic?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  npwp?: string | null;
  active?: boolean;
};

export async function createVihara(input: ViharaInput): Promise<Vihara> {
  return api<Vihara>(`/api/viharas`, { method: "POST", body: JSON.stringify(input) });
}

export async function updateVihara(id: number, input: Partial<ViharaInput>): Promise<Vihara> {
  return api<Vihara>(`/api/viharas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function verifyVihara(id: number): Promise<Vihara> {
  return api<Vihara>(`/api/viharas/${id}/verify`, { method: "POST" });
}

export async function deleteVihara(id: number): Promise<void> {
  await api(`/api/viharas/${id}`, { method: "DELETE" });
}
