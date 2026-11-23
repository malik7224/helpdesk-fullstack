"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  api,
  describeError,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Paged,
  type Priority,
  type Status,
  type Ticket,
  type User,
} from "@/lib/api";
import { useAuth } from "./auth-provider";
import { PriorityBadge, StatusBadge } from "./badges";
import { TicketForm } from "./ticket-form";
import { cardClass, ghostButton, inputClass, primaryButton } from "./ui";

const PAGE_SIZE = 10;

type Settled =
  | { key: string; result: Paged<Ticket>; error?: undefined }
  | { key: string; result?: undefined; error: string };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function TicketsPage() {
  const { state } = useAuth();
  const meId = state.status === "authed" ? state.user.id : null;

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [settled, setSettled] = useState<Settled | null>(null);

  // Wait for the typing to pause before searching.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api
      .listUsers()
      .then(({ data }) => !cancelled && setUsers(data))
      .catch(() => undefined); // The list still works without the assignee picker.
    return () => {
      cancelled = true;
    };
  }, []);

  // One key describes the request; "loading" means the latest result is for an older key.
  const requestKey = JSON.stringify([query, status, priority, mine, page, reload, meId]);
  const loading = settled?.key !== requestKey;

  useEffect(() => {
    let cancelled = false;
    api
      .listTickets({
        q: query || undefined,
        status: status || undefined,
        priority: priority || undefined,
        assigneeId: mine && meId ? meId : undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((result) => !cancelled && setSettled({ key: requestKey, result }))
      .catch((err) => !cancelled && setSettled({ key: requestKey, error: describeError(err) }));
    return () => {
      cancelled = true;
    };
  }, [requestKey, query, status, priority, mine, page, meId]);

  const result = settled?.result;
  const hasFilters = Boolean(query || status || priority || mine);

  function resetFilters() {
    setSearch("");
    setQuery("");
    setStatus("");
    setPriority("");
    setMine(false);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {result ? `${result.total} ${result.total === 1 ? "ticket" : "tickets"}` : " "}
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className={primaryButton}>
            New ticket
          </button>
        )}
      </div>

      {showForm && (
        <TicketForm
          users={users}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            setPage(1);
            setReload((n) => n + 1);
          }}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input
          type="search"
          aria-label="Search tickets"
          placeholder="Search title or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Status | "");
            setPage(1);
          }}
          className={`${inputClass} sm:w-40`}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value as Priority | "");
            setPage(1);
          }}
          className={`${inputClass} sm:w-40`}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={mine}
          onClick={() => {
            setMine((v) => !v);
            setPage(1);
          }}
          className={`${ghostButton} ${mine ? "!border-accent !text-accent" : ""}`}
        >
          Assigned to me
        </button>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        {settled?.error ? (
          <div role="alert" className="p-6 text-sm">
            <p className="text-red-300">{settled.error}</p>
            <button type="button" onClick={() => setReload((n) => n + 1)} className={`${ghostButton} mt-3`}>
              Try again
            </button>
          </div>
        ) : !result ? (
          <p role="status" className="p-6 text-sm text-muted">
            Loading tickets…
          </p>
        ) : result.data.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            <p>{hasFilters ? "No tickets match these filters." : "No tickets yet."}</p>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className={`${ghostButton} mt-3`}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className={`divide-y divide-line transition-opacity ${loading ? "opacity-60" : ""}`}>
            {result.data.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="grid gap-2 px-5 py-4 transition-colors hover:bg-raised sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{ticket.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      #{ticket.id} · {ticket.assigneeName ?? "Unassigned"} · Updated{" "}
                      {formatDate(ticket.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {result && result.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={ghostButton}
          >
            Previous
          </button>
          <span className="text-muted">
            Page {result.page} of {result.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
            disabled={page >= result.totalPages}
            className={ghostButton}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
