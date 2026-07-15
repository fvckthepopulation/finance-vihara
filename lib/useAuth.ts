"use client";

import { useEffect, useState } from "react";
import { AuthUser, me } from "./api";

let cached: AuthUser | null = null;
let pending: Promise<AuthUser> | null = null;
const listeners = new Set<(u: AuthUser | null) => void>();

function emit(u: AuthUser | null) {
  cached = u;
  listeners.forEach((cb) => cb(u));
}

export function invalidateAuth() {
  cached = null;
  pending = null;
}

/**
 * Lightweight auth hook with module-level cache.
 * Loads once per page lifecycle; multiple components share the same fetch.
 */
export function useAuth(): {
  user: AuthUser | null;
  loading: boolean;
  can: (permission: string | string[]) => boolean;
  hasRole: (role: string) => boolean;
} {
  const [user, setUser] = useState<AuthUser | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    listeners.add(setUser);

    if (cached) {
      setUser(cached);
      setLoading(false);
    } else {
      if (!pending) {
        pending = me()
          .then((u) => {
            emit(u);
            return u;
          })
          .catch(() => {
            emit(null);
            return null as unknown as AuthUser;
          })
          .finally(() => {
            pending = null;
          });
      }
      pending.then(() => setLoading(false));
    }

    return () => {
      listeners.delete(setUser);
    };
  }, []);

  function can(permission: string | string[]): boolean {
    if (!user) return false;
    const list = Array.isArray(permission) ? permission : [permission];
    return list.every((p) => user.permissions.includes(p));
  }

  function hasRole(role: string): boolean {
    return !!user && user.roles.includes(role);
  }

  return { user, loading, can, hasRole };
}
