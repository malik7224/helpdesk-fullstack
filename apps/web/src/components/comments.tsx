"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, describeError, type Comment } from "@/lib/api";
import { cardClass, inputClass, labelClass, primaryButton } from "./ui";

type Loaded = { ticketId: number; comments: Comment[]; error?: string };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function Comments({ ticketId }: { ticketId: number }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listComments(ticketId)
      .then(({ comments }) => !cancelled && setLoaded({ ticketId, comments }))
      .catch((err) => !cancelled && setLoaded({ ticketId, comments: [], error: describeError(err) }));
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const current = loaded?.ticketId === ticketId ? loaded : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { comment } = await api.addComment(ticketId, body);
      setLoaded((prev) => ({
        ticketId,
        comments: [...(prev?.ticketId === ticketId ? prev.comments : []), comment],
      }));
      setBody("");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${cardClass} p-6`} aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-sm font-semibold">
        Comments{current ? ` (${current.comments.length})` : ""}
      </h2>

      {!current ? (
        <p role="status" className="mt-4 text-sm text-muted">
          Loading comments…
        </p>
      ) : (
        <>
          {current.error && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {current.error}
            </p>
          )}
          {current.comments.length === 0 && !current.error ? (
            <p className="mt-4 text-sm text-muted">No comments yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {current.comments.map((comment) => (
                <li key={comment.id}>
                  <p className="text-xs text-muted">
                    <span className="font-medium text-ink">{comment.authorName}</span> ·{" "}
                    {formatDateTime(comment.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink/90">
                    {comment.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-3" aria-label="Add comment">
        <div>
          <label htmlFor="new-comment" className={labelClass}>
            Add a comment
          </label>
          <textarea
            id="new-comment"
            rows={3}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !body.trim()} className={primaryButton}>
          Post comment
        </button>
      </form>
    </section>
  );
}
