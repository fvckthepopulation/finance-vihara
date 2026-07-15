"use client";

import { useEffect, useState } from "react";
import {
  AdminRole,
  AdminUser,
  createAdminUser,
  deleteAdminUser,
  listAdminRoles,
  listAdminUsers,
  updateAdminUser,
} from "@/lib/admin";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field, Input, Select } from "@/components/Field";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState<"new" | { user: AdminUser } | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([listAdminUsers(search), listAdminRoles()])
      .then(([u, r]) => {
        setUsers(u);
        setRoles(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [search]);

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Hapus user "${name}"?`)) return;
    try {
      await deleteAdminUser(id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal hapus");
    }
  }

  return (
    <AppShell
      title="Admin — Users"
      subtitle="Manage user account dan assign role"
      actions={
        <Button variant="primary" onClick={() => setShowForm("new")}>
          + User baru
        </Button>
      }
    >
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-km-border bg-km-panel-soft px-4 py-2.5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / email…"
            className="min-w-48 max-w-xs"
          />
          <p className="ml-auto text-[11px] text-km-ink-muted">
            {loading ? "Memuat…" : `${users.length} user`}
          </p>
        </div>

        <table className="w-full text-[12px]">
          <thead className="bg-km-panel-soft">
            <tr>
              <Th>Nama</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Created</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-km-ink-muted">Belum ada user.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-km-border hover:bg-km-panel-soft">
                <Td className="font-medium">{u.name}</Td>
                <Td className="text-km-ink-muted">{u.email}</Td>
                <Td>
                  {u.roles.map((r) => (
                    <Badge key={r.id} tone="info" className="mr-1">{r.name}</Badge>
                  ))}
                </Td>
                <Td className="text-[11px] text-km-ink-muted">{u.created_at.slice(0, 10)}</Td>
                <Td className="text-right">
                  <button
                    onClick={() => setShowForm({ user: u })}
                    className="mr-2 text-[11px] text-km-blue hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(u.id, u.name)}
                    className="text-[11px] text-km-red-ink hover:underline"
                  >
                    Hapus
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showForm && (
        <UserForm
          user={showForm === "new" ? null : showForm.user}
          roles={roles}
          onClose={() => setShowForm(null)}
          onSaved={() => {
            setShowForm(null);
            reload();
          }}
        />
      )}
    </AppShell>
  );
}

function UserForm({
  user, roles, onClose, onSaved,
}: {
  user: AdminUser | null;
  roles: AdminRole[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.roles[0]?.name ?? roles[0]?.name ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (user) {
        const payload: { name: string; email: string; role: string; password?: string } = { name, email, role };
        if (password) payload.password = password;
        await updateAdminUser(user.id, payload);
      } else {
        await createAdminUser({ name, email, password, role });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-km-border bg-km-panel shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-km-border px-4 py-3">
          <h2 className="text-[14px] font-medium text-km-ink">
            {user ? `Edit ${user.name}` : "User baru"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-km-ink-muted hover:bg-km-bg">✕</button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <Field label="Nama">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={user ? "Password (kosongkan kalau tidak diubah)" : "Password"}>
            <Input
              type="password"
              required={!user}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={user ? "••••••" : "min 8 karakter"}
            />
          </Field>
          <Field label="Role">
            <Select required value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </Select>
          </Field>

          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-km-border bg-km-panel-soft px-4 py-3">
          <Button type="button" variant="default" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
