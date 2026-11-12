import { api, ScopeType } from "./api";

export type AdminUserVihara = { id: number; code: string; name: string };

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  entity_id: number | null;
  entity?: { id: number; code: string; legal_name: string } | null;
  /** global = lintas yayasan, entity = satu yayasan, vihara = daftar vihara. */
  scope_type: ScopeType;
  viharas: AdminUserVihara[];
  vihara_ids: number[];
  /** Hanya terisi bila user terkunci ke tepat satu vihara. */
  vihara_id: number | null;
  created_at: string;
  roles: string[];
};

export type AdminRole = {
  id: number;
  name: string;
  guard_name: string;
  users_count: number;
  permissions: string[];
  is_protected: boolean;
  /** Role bawaan RbacSeeder — dibuat ulang tiap seeding, jadi tak bisa dihapus. */
  is_builtin?: boolean;
  /** Dihitung server: bukan bawaan DAN belum dipakai pengguna mana pun. */
  can_delete?: boolean;
  description?: string | null;
  /** Anjuran scope untuk role ini — bukan penegakan. */
  default_scope?: ScopeType;
};

export const listAdminUsers = (q = "") =>
  api<AdminUser[]>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: string;
  /** Yayasan penaung. Wajib untuk scope `entity` dan `vihara`. */
  entity_id?: number | null;
  scope_type: ScopeType;
  /** Wajib (minimal satu) bila scope_type = "vihara". */
  vihara_ids?: number[];
};

export const createAdminUser = (payload: CreateUserPayload) =>
  api<AdminUser>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type UpdateUserPayload = Partial<
  Omit<CreateUserPayload, "password" | "scope_type"> & {
    password: string;
    scope_type: ScopeType;
  }
>;

export const updateAdminUser = (id: number, payload: UpdateUserPayload) =>
  api<AdminUser>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const deleteAdminUser = (id: number) =>
  api<{ message: string }>(`/api/admin/users/${id}`, { method: "DELETE" });

export const listAdminRoles = () =>
  api<AdminRole[]>(`/api/admin/roles`);

export const getPermissionsCatalog = () =>
  api<{
    permissions: string[];
    catalog: string[];
    /** Keterangan tiap hak, untuk ditampilkan di matrix. */
    descriptions?: Record<string, string>;
    /** Hak yang sengaja disembunyikan karena belum mengatur apa pun. */
    hidden?: string[];
  }>(`/api/admin/permissions`);

export const updateRolePermissions = (id: number, permissions: string[]) =>
  api<{ id: number; name: string; permissions: string[] }>(
    `/api/admin/roles/${id}`,
    { method: "PATCH", body: JSON.stringify({ permissions }) },
  );

export const deleteRole = (id: number) =>
  api<{ message: string }>(`/api/admin/roles/${id}`, { method: "DELETE" });

export const createRole = (name: string, permissions: string[]) =>
  api<{ id: number; name: string; permissions: string[] }>(`/api/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ name, permissions }),
  });
