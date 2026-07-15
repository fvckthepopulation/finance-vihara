"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminRole,
  getPermissionsCatalog,
  listAdminRoles,
  updateRolePermissions,
} from "@/lib/admin";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminRole | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([listAdminRoles(), getPermissionsCatalog()])
      .then(([r, p]) => {
        setRoles(r);
        setAllPermissions(p.permissions);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  return (
    <AppShell title="Admin — Roles" subtitle="Manage role dan permission matrix">
      {error && (
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
          {error}
        </p>
      )}

      {loading && <p className="text-[12px] text-km-ink-muted">Memuat…</p>}

      <div className="space-y-3.5">
        {roles.map((r) => (
          <Card key={r.id}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <span>{r.name}</span>
                  {r.is_protected && <Badge tone="warn">protected</Badge>}
                  <Badge tone="neutral">{r.users_count} user</Badge>
                </span>
              }
              subtitle={`${r.permissions.length} permission`}
              right={
                !r.is_protected && (
                  <Button variant="default" size="sm" onClick={() => setEditing(r)}>
                    Edit permissions
                  </Button>
                )
              }
            />
            <div className="p-4">
              <div className="flex flex-wrap gap-1.5">
                {r.permissions.length === 0 && (
                  <span className="text-[11px] text-km-ink-muted">— belum ada permission —</span>
                )}
                {r.permissions.map((p) => (
                  <span key={p} className="rounded-md bg-km-panel-soft px-1.5 py-0.5 text-[10px] font-mono text-km-ink-soft">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <PermissionsEditor
          role={editing}
          allPermissions={allPermissions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </AppShell>
  );
}

function PermissionsEditor({
  role, allPermissions, onClose, onSaved,
}: {
  role: AdminRole;
  allPermissions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const p of allPermissions) {
      const group = p.split(".")[0];
      (out[group] ??= []).push(p);
    }
    return out;
  }, [allPermissions]);

  function toggle(p: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function toggleGroup(group: string) {
    const perms = groups[group];
    const allOn = perms.every((p) => selected.has(p));
    setSelected((s) => {
      const next = new Set(s);
      if (allOn) perms.forEach((p) => next.delete(p));
      else perms.forEach((p) => next.add(p));
      return next;
    });
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      await updateRolePermissions(role.id, Array.from(selected));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-12">
      <div className="w-full max-w-2xl rounded-xl border border-km-border bg-km-panel shadow-xl">
        <div className="flex items-center justify-between border-b border-km-border px-4 py-3">
          <h2 className="text-[14px] font-medium text-km-ink">Edit permissions — {role.name}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-km-ink-muted hover:bg-km-bg">✕</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
          {Object.entries(groups).map(([group, perms]) => {
            const allOn = perms.every((p) => selected.has(p));
            return (
              <div key={group} className="mb-3">
                <div className="flex items-center justify-between border-b border-km-border pb-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-km-ink-muted">{group}</p>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="text-[10px] text-km-blue hover:underline"
                  >
                    {allOn ? "Uncheck all" : "Check all"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                  {perms.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(p)}
                        onChange={() => toggle(p)}
                        className="h-3.5 w-3.5 accent-km-blue"
                      />
                      <span className="font-mono text-[11px]">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mx-4 mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-km-border bg-km-panel-soft px-4 py-3">
          <p className="text-[12px] text-km-ink-muted">
            {selected.size} dari {allPermissions.length} permission dipilih
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="default" onClick={onClose}>Batal</Button>
            <Button type="button" variant="primary" onClick={handleSave} disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
