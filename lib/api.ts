export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8500";
const TOKEN_KEY = "vf_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Rangkai pesan error yang terbaca dari balasan API.
 *
 * Laravel mengirim `message` berisi error PERTAMA saja, ditambah imbuhan
 * "(and 4 more errors)". Kalau itu yang ditampilkan, pengguna hanya tahu satu
 * dari lima field yang salah dan harus menebak sisanya satu per satu. Di sini
 * seluruh pesan di `errors` dirangkai, satu baris per field.
 */
function pesanDari(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null) {
    const p = payload as { message?: unknown; errors?: unknown };
    if (p.errors && typeof p.errors === "object") {
      const semua = Object.values(p.errors as Record<string, unknown>)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .map((v) => String(v))
        .filter(Boolean);
      // Duplikat muncul saat satu aturan menandai dua field sekaligus.
      const unik = [...new Set(semua)];
      if (unik.length) return unik.join("\n");
    }
    if (p.message) return String(p.message);
  }
  return `HTTP ${status}`;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = await res.text();
    }
    const error = new Error(pesanDari(payload, res.status));
    (error as Error & { payload?: unknown }).payload = payload;
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

/**
 * Tingkat akses user. Dua sumbu yang sengaja dipisah:
 *   roles/permissions = APA yang boleh dilakukan
 *   scope_type/vihara_ids = DI MANA boleh dilakukan
 */
export type ScopeType = "global" | "entity" | "vihara";

export type AuthEntity = {
  id: number;
  code: string;
  legal_name: string;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  entity_id: number | null;
  entity?: AuthEntity | null;
  /**
   * global = lintas yayasan; entity = seluruh vihara di satu yayasan;
   * vihara = hanya vihara di `vihara_ids`.
   */
  scope_type: ScopeType;
  /** Vihara yang boleh diakses. null = tanpa batas (admin tertinggi). */
  vihara_ids?: number[] | null;
  /** Kompat klien lama: hanya terisi bila user terkunci ke TEPAT satu vihara. */
  vihara_id?: number | null;
  /** Boleh membuka konsolidasi & data level yayasan. */
  can_see_yayasan_level?: boolean;
  roles: string[];
  permissions: string[];
  app?: {
    /** Instance yayasan tunggal — sembunyikan pemilih vihara & konsolidasi. */
    single_entity_mode: boolean;
  };
};

/** true bila user boleh berpindah-pindah antar lebih dari satu vihara. */
export function canSwitchVihara(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.app?.single_entity_mode) return false;
  const ids = user.vihara_ids;
  return ids == null || ids.length > 1;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const data = await api<{ token: string; user: AuthUser }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_name: "web" }),
  });
  setToken(data.token);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await api("/api/logout", { method: "POST" });
  } finally {
    clearToken();
    // Drop the cached user so the next login reloads fresh.
    const mod = await import("./useAuth");
    mod.invalidateAuth();
  }
}

export function me(): Promise<AuthUser> {
  return api<AuthUser>("/api/me");
}

/**
 * Jangkauan akses akun untuk BERTRANSAKSI — yayasan & vihara yang boleh
 * dipakai. Sengaja bukan /api/entities + /api/viharas: keduanya master data
 * dan butuh izin `entities.view` / `masters.view`, yang banyak role
 * operasional tidak punya. Form transaksi tidak boleh bergantung ke sana.
 */
export type ScopeEntity = { id: number; code: string; legal_name: string };
export type ScopeVihara = { id: number; code: string; name: string; entity_id: number | null };

export function getMyScope(): Promise<{ entities: ScopeEntity[]; viharas: ScopeVihara[] }> {
  return api<{ entities: ScopeEntity[]; viharas: ScopeVihara[] }>("/api/my-scope");
}
