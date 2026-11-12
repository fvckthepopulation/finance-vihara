"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@vihara.test");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-km-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-km-border bg-km-panel p-6 shadow-sm"
      >
        <div className="mb-5 flex items-center gap-2">
          <BrandLogo size={36} />
          <div>
            <h1 className="text-[17px] font-medium text-km-ink leading-tight">Vihara Finance</h1>
            <p className="text-[11px] text-km-ink-muted">Modul Keuangan — masuk ke akun internal</p>
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-km-red bg-km-red-soft px-3 py-2 text-[12px] text-km-red-ink whitespace-pre-line">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full justify-center" disabled={pending}>
            {pending ? "Masuk…" : "Masuk"}
          </Button>
        </div>
      </form>
    </main>
  );
}
