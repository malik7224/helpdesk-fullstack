"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  describeError,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Priority,
  type Status,
  type Ticket,
  type TicketPatch,
  type User,
} from "@/lib/api";
import { useAuth } from "./auth-provider";
import { PriorityBadge, StatusBadge } from "./badges";
import { Comments } from "./comments";
import { cardClass, dangerButton, ghostButton, inputClass, labelClass, primaryButton } from "./ui";

type Loaded = { id: number; ticket: Ticket; error?: undefined } | { id: number; ticket?: undefined; error: string };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function TicketDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const { state } = useAuth();
  const isAdmin = state.status === "authed" && state.user.role === "admin";

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getTicket(id)
      .then(({ ticket }) => !cancelled && setLoaded({ id, ticket }))
      .catch((err) => !cancelled && setLoaded({ id, error: describeError(err) }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    api
      .listUsers()
      .then(({ data }) => !cancelled && setUsers(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const current = loaded?.id === id ? loaded : null;
  const ticket = current?.ticket;

  async function save(patch: TicketPatch, success = "Saved") {
    setBusy(true);
    setNotice(null);
    try {
      const { ticket: updated } = await api.updateTicket(id, patch);
      setLoaded({ id, ticket: updated });
      setNotice({ kind: "ok", text: success });
      return true;
    } catch (err) {
      setNotice({ kind: "error", text: describeError(err) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitEdit(event: FormEvent) {
    event.preventDefault();
    if (await save({ title, description })) setEditing(false);
  }

  async function onDelete() {
    if (!window.confirm("Delete this ticket? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api.deleteTicket(id);
      router.replace("/");
    } catch (err) {
      setNotice({ kind: "error", text: describeError(err) });
      setBusy(false);
    }
  }

  const back = (
    <Link href="/" className="text-sm text-muted transition-colors hover:text-ink">
      ← All tickets
    </Link>
  );

  if (!current) {
    return (
      <div className="space-y-4">
        {back}
        <p role="status" className="text-sm text-muted">
          Loading ticket…
        </p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        {back}
        <p role="alert" className="rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {current.error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}

      <div className={`${cardClass} p-6`}>
        {editing ? (
          <form onSubmit={onSubmitEdit} className="space-y-4" aria-label="Edit ticket">
            <div>
              <label htmlFor="edit-title" className={labelClass}>
                Title
              </label>
              <input
                id="edit-title"
                required
                minLength={3}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-description" className={labelClass}>
                Description
              </label>
              <textarea
                id="edit-description"
                rows={6}
                maxLength={5000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className={primaryButton}>
                Save changes
              </button>
              <button type="button" onClick={() => setEditing(false)} className={ghostButton}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">Ticket #{ticket.id}</p>
                <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight">{ticket.title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </div>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-ink/90">
              {ticket.description || <span className="text-muted">No description.</span>}
            </p>
            <p className="mt-5 text-xs text-muted">
              Opened by {ticket.createdByName} · {formatDateTime(ticket.createdAt)} · Updated{" "}
              {formatDateTime(ticket.updatedAt)}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setTitle(ticket.title);
                  setDescription(ticket.description);
                  setNotice(null);
                  setEditing(true);
                }}
                className={ghostButton}
              >
                Edit
              </button>
              {isAdmin && (
                <button type="button" onClick={onDelete} disabled={busy} className={dangerButton}>
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className={`${cardClass} grid gap-4 p-6 sm:grid-cols-3`}>
        <div>
          <label htmlFor="status" className={labelClass}>
            Status
          </label>
          <select
            id="status"
            value={ticket.status}
            disabled={busy}
            onChange={(e) => save({ status: e.target.value as Status })}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="priority" className={labelClass}>
            Priority
          </label>
          <select
            id="priority"
            value={ticket.priority}
            disabled={busy}
            onChange={(e) => save({ priority: e.target.value as Priority })}
            className={inputClass}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="assignee" className={labelClass}>
            Assignee
          </label>
          <select
            id="assignee"
            value={ticket.assigneeId ?? ""}
            disabled={busy}
            onChange={(e) => save({ assigneeId: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Comments ticketId={id} />

      <p
        role={notice?.kind === "error" ? "alert" : "status"}
        className={`min-h-5 text-sm ${notice?.kind === "error" ? "text-red-300" : "text-emerald-300"}`}
      >
        {notice?.text}
      </p>
    </div>
  );
}
