"use client";

import { useState, type FormEvent } from "react";
import {
  api,
  describeError,
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  type Ticket,
  type User,
} from "@/lib/api";
import { cardClass, ghostButton, inputClass, labelClass, primaryButton } from "./ui";

interface TicketFormProps {
  users: User[];
  onCreated: (ticket: Ticket) => void;
  onCancel: () => void;
}

export function TicketForm({ users, onCreated, onCancel }: TicketFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { ticket } = await api.createTicket({
        title,
        description,
        priority,
        assigneeId: assigneeId ? Number(assigneeId) : null,
      });
      onCreated(ticket);
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={`${cardClass} space-y-4 p-5`} aria-label="New ticket">
      <h2 className="text-lg font-semibold tracking-tight">New ticket</h2>

      <div>
        <label htmlFor="new-title" className={labelClass}>
          Title
        </label>
        <input
          id="new-title"
          required
          minLength={3}
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="What is the problem?"
        />
      </div>

      <div>
        <label htmlFor="new-description" className={labelClass}>
          Description
        </label>
        <textarea
          id="new-description"
          rows={4}
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
          placeholder="Steps to reproduce, who is affected…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-priority" className={labelClass}>
            Priority
          </label>
          <select
            id="new-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
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
          <label htmlFor="new-assignee" className={labelClass}>
            Assignee
          </label>
          <select
            id="new-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
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

      {error && (
        <p role="alert" className="rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className={primaryButton}>
          {submitting ? "Creating…" : "Create ticket"}
        </button>
        <button type="button" onClick={onCancel} className={ghostButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}
