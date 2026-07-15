import { api } from "./api";

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  entity_id: number | null;
  outlet_id: number | null;
  created_at: string;
  roles: { id: number; name: string }[];
  outlet?: { id: number; code: string; name: string } | null;
};

export type AdminRole = {
  id: number;
  name: string;
  guard_name: string;
  users_count: number;
  permissions: string[];
  is_protected: boolean;
};

export const listAdminUsers = (q = "") =>
  api<AdminUser[]>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: string;
  entity_id?: number | null;
  outlet_id?: number | null;
};

export const createAdminUser = (payload: CreateUserPayload) =>
  api<AdminUser>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type UpdateUserPayload = Partial<
  Omit<CreateUserPayload, "password"> & { password: string }
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
  api<{ permissions: string[]; catalog: string[] }>(`/api/admin/permissions`);

export const updateRolePermissions = (id: number, permissions: string[]) =>
  api<{ id: number; name: string; permissions: string[] }>(
    `/api/admin/roles/${id}`,
    { method: "PATCH", body: JSON.stringify({ permissions }) },
  );

export const createRole = (name: string, permissions: string[]) =>
  api<{ id: number; name: string; permissions: string[] }>(`/api/admin/roles`, {
    method: "POST",
    body: JSON.stringify({ name, permissions }),
  });
