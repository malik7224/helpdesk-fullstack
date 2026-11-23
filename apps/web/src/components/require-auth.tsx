"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { Header } from "./header";

/** Page chrome for signed-in screens. Sends visitors without a session to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "anon") router.replace("/login");
  }, [state.status, router]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {state.status === "authed" ? (
          children
        ) : (
          <p role="status" className="text-sm text-muted">
            Loading…
          </p>
        )}
      </main>
    </>
  );
}
