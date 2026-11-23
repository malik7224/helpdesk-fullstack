// Shared Tailwind class strings so every form control and button looks the same.

export const inputClass =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted/70 disabled:opacity-60";

export const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted";

export const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButton =
  "inline-flex items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButton =
  "inline-flex items-center justify-center rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50";

export const cardClass = "rounded-2xl border border-line bg-surface";
