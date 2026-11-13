"use client";

import { useEffect, useState } from "react";
import { Pagination, PER_PAGE_DEFAULT } from "@/components/Pagination";
import {
  AdminRole,
  AdminUser,
  UpdateUserPayload,
  createAdminUser,
  deleteAdminUser,
  listAdminRoles,
  listAdminUsersPaginated,
  updateAdminUser,
} from "@/lib/admin";
import { ScopeType } from "@/lib/api";
import { MasterEntity, listEntities } from "@/lib/masters";
import { Vihara, listViharas } from "@/lib/vihara";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field, Input, Select } from "@/components/Field";
import { Modal } from "@/components/Modal";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [viharas, setViharas] = useState<Vihara[]>([]);
  const [entities, setEntities] = useState<MasterEntity[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE_DEFAULT);
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    from: null as number | null,
    to: null as number | null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState<"new" | { user: AdminUser } | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([
      listAdminUsersPaginated({ q: search, page, per_page: perPage }),
      listAdminRoles(),
      // Daftar ini sudah ter-scope di API: admin yayasan hanya menerima
      // vihara & yayasannya sendiri.
      listViharas({ active_only: true }).then((r) => r.data),
      listEntities({ active: true }),
    ])
      .then(([u, r, v, e]) => {
        setUsers(u.data);
        setMeta({
          current_page: u.current_page,
          last_page: u.last_page,
          total: u.total,
          from: u.from,
          to: u.to,
        });
        setRoles(r);
        setViharas(v);
        setEntities(e);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [search, page, perPage]);

  // Kata kunci berubah → kembali ke halaman 1.
  useEffect(() => {
    setPage(1);
  }, [search, perPage]);

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
        <p className="mb-3 rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
          {error}
        </p>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-km-border bg-km-panel-soft px-4 py-2.5">
          <Input
            data-testid="cari-user"
            aria-label="Cari user"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / email…"
            className="min-w-48 max-w-xs"
          />
          <p className="ml-auto text-[11px] text-km-ink-muted">
            {loading ? "Memuat…" : `${meta.total} user`}
          </p>
        </div>

        <table className="w-full text-[12px]">
          <thead className="bg-km-panel-soft">
            <tr>
              <Th>Nama</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Jangkauan akses</Th>
              <Th>Created</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-km-ink-muted">Belum ada user.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.email}`} className="border-t border-km-border hover:bg-km-panel-soft">
                <Td className="font-medium">{u.name}</Td>
                <Td className="text-km-ink-muted">{u.email}</Td>
                <Td>
                  {u.roles.map((r) => (
                    <Badge key={r} tone="info" className="mr-1">{r}</Badge>
                  ))}
                </Td>
                <Td><ScopeCell user={u} /></Td>
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
        <div className="border-t border-km-border">
          <Pagination
            currentPage={meta.current_page}
            lastPage={meta.last_page}
            total={meta.total}
            from={meta.from}
            to={meta.to}
            onChange={setPage}
            perPage={perPage}
            onPerPageChange={setPerPage}
          />
        </div>
      </Card>

      {showForm && (
        <UserForm
          user={showForm === "new" ? null : showForm.user}
          roles={roles}
          viharas={viharas}
          entities={entities}
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
  user, roles, viharas, entities, onClose, onSaved,
}: {
  user: AdminUser | null;
  roles: AdminRole[];
  viharas: Vihara[];
  entities: MasterEntity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.roles[0] ?? roles[0]?.name ?? "");
  const [scopeType, setScopeType] = useState<ScopeType>(
    user?.scope_type ?? roles[0]?.default_scope ?? "vihara",
  );
  const [entityId, setEntityId] = useState<number | null>(
    user?.entity_id ?? entities[0]?.id ?? null,
  );
  const [viharaIds, setViharaIds] = useState<number[]>(user?.vihara_ids ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ganti role → ikuti anjuran scope-nya, selama user belum punya scope
  // sendiri (hanya saat membuat baru).
  function handleRoleChange(next: string) {
    setRole(next);
    if (!user) {
      const suggested = roles.find((r) => r.name === next)?.default_scope;
      if (suggested) setScopeType(suggested);
    }
  }

  function toggleVihara(id: number) {
    setViharaIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  // Vihara yang ditawarkan dibatasi ke yayasan terpilih — mencegah
  // menugaskan vihara milik yayasan lain.
  const viharaOptions = entityId
    ? viharas.filter((v) => v.entity_id == null || v.entity_id === entityId)
    : viharas;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (scopeType === "vihara" && viharaIds.length === 0) {
      setError("Pilih minimal satu vihara untuk akses tingkat vihara.");
      return;
    }
    if (scopeType === "entity" && !entityId) {
      setError("Pilih yayasan untuk akses tingkat yayasan.");
      return;
    }

    setPending(true);
    try {
      const scope = {
        scope_type: scopeType,
        entity_id: scopeType === "global" ? entityId : entityId,
        vihara_ids: scopeType === "vihara" ? viharaIds : [],
      };
      if (user) {
        const payload: UpdateUserPayload = { name, email, role, ...scope };
        if (password) payload.password = password;
        await updateAdminUser(user.id, payload);
      } else {
        await createAdminUser({ name, email, password, role, ...scope });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal simpan");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      title={user ? `Edit ${user.name}` : "User baru"}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="default" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >

        <div className="space-y-3">
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
          <Field label="Role — apa yang boleh dilakukan">
            <Select required value={role} onChange={(e) => handleRoleChange(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </Select>
            {roles.find((r) => r.name === role)?.description && (
              <p className="mt-1 text-[11px] leading-snug text-km-ink-muted">
                {roles.find((r) => r.name === role)?.description}
              </p>
            )}
          </Field>

          <div className="rounded-lg border border-km-border bg-km-panel-soft p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-km-ink-muted">
              Jangkauan akses — di mana boleh dilakukan
            </p>

            <Field label="Tingkat">
              <Select
                data-testid="scope-type"
                required
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value as ScopeType)}
              >
                <option value="global">Global — semua yayasan &amp; semua vihara</option>
                <option value="entity">Yayasan — semua vihara di satu yayasan</option>
                <option value="vihara">Vihara — hanya vihara terpilih</option>
              </Select>
            </Field>

            {scopeType !== "global" && (
              <Field label="Yayasan">
                <Select
                  data-testid="scope-entity"
                  required
                  value={entityId ?? ""}
                  onChange={(e) => {
                    setEntityId(e.target.value ? Number(e.target.value) : null);
                    setViharaIds([]);
                  }}
                >
                  <option value="">— pilih yayasan —</option>
                  {entities.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.code} — {en.legal_name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            {scopeType === "vihara" && (
              <Field label="Vihara (boleh lebih dari satu)">
                <div
                  data-testid="scope-viharas"
                  className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-km-border bg-km-panel p-2"
                >
                  {viharaOptions.length === 0 && (
                    <p className="px-1 py-2 text-[11px] text-km-ink-muted">
                      Tidak ada vihara pada yayasan ini.
                    </p>
                  )}
                  {viharaOptions.map((v) => (
                    <label
                      key={v.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12px] hover:bg-km-panel-soft"
                    >
                      <input
                        type="checkbox"
                        value={v.id}
                        checked={viharaIds.includes(v.id)}
                        onChange={() => toggleVihara(v.id)}
                      />
                      <span className="text-km-ink-muted">{v.code}</span>
                      <span>{v.name}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-km-ink-muted">
                  Vihara yang tidak dicentang tidak akan terlihat sama sekali oleh
                  pengguna ini.
                </p>
              </Field>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
              {error}
            </p>
          )}
        </div>

    </Modal>
  );
}

/** Ringkasan jangkauan akses — tiga tingkat hirarki dibedakan jelas. */
function ScopeCell({ user }: { user: AdminUser }) {
  if (user.scope_type === "global") {
    return (
      <Badge tone="warn" data-testid="scope-badge">
        Global — semua yayasan
      </Badge>
    );
  }
  if (user.scope_type === "entity") {
    return (
      <span data-testid="scope-badge" className="text-[11px]">
        <Badge tone="info" className="mr-1">Yayasan</Badge>
        <span className="text-km-ink-muted">
          {user.entity?.code ?? "—"} · seluruh vihara
        </span>
      </span>
    );
  }
  return (
    <span data-testid="scope-badge" className="text-[11px]">
      <Badge tone="neutral" className="mr-1">Vihara</Badge>
      <span className="text-km-ink-muted">
        {user.viharas.length === 0
          ? "belum ditugaskan"
          : user.viharas.map((v) => v.code).join(", ")}
      </span>
    </span>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-km-ink-muted ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-km-ink ${className}`}>{children}</td>;
}
