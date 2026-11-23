"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";
import { ghostButton } from "./ui";

export function Header() {
  const { state, logout } = useAuth();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          Helpdesk
        </Link>

        {state.status === "authed" && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">
              {state.user.name}
              <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-xs uppercase tracking-wide">
                {state.user.role}
              </span>
            </span>
            <button type="button" onClick={logout} className={`${ghostButton} !px-3 !py-1.5`}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
