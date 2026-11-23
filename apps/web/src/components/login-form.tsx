"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { describeError } from "@/lib/api";
import { useAuth } from "./auth-provider";
import { cardClass, inputClass, labelClass, primaryButton } from "./ui";

// Set NEXT_PUBLIC_SHOW_DEMO_LOGIN=true to print the seed accounts on the form (local demos only).
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === "true";

export function LoginForm() {
  const { state, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (state.status === "authed") router.replace("/");
  }, [state.status, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
        <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-accent" />
        Helpdesk
      </div>

      <form onSubmit={onSubmit} className={`${cardClass} space-y-4 p-6`}>
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className={`${primaryButton} w-full`}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {SHOW_DEMO && (
        <p className="mt-4 text-center text-xs text-muted">
          Demo accounts: <code>agent@demo.test</code> or <code>admin@demo.test</code>, password{" "}
          <code>demo-password-123</code>
        </p>
      )}
    </div>
  );
}
