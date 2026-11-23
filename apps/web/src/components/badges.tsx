import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type Status } from "@/lib/api";

const STATUS_STYLES: Record<Status, string> = {
  open: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  in_progress: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
  resolved: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  closed: "bg-zinc-400/15 text-zinc-300 ring-zinc-400/30",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: "bg-zinc-400/10 text-zinc-300 ring-zinc-400/25",
  medium: "bg-violet-400/15 text-violet-300 ring-violet-400/30",
  high: "bg-red-400/15 text-red-300 ring-red-400/30",
};

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`${base} ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`${base} ${PRIORITY_STYLES[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}
