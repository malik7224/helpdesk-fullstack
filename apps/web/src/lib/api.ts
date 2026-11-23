const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const TOKEN_KEY = "helpdesk.token";
export const UNAUTHORIZED_EVENT = "helpdesk:unauthorized";

export const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;

export type Role = "admin" | "agent";
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  createdBy: number;
  createdByName: string;
  assigneeId: number | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TicketFilters {
  q?: string;
  status?: Status;
  priority?: Priority;
  assigneeId?: number;
  page?: number;
  pageSize?: number;
}

export interface TicketInput {
  title: string;
  description?: string;
  priority?: Priority;
  assigneeId?: number | null;
}

export type TicketPatch = Partial<TicketInput & { status: Status }>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the API running?");
  }

  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as {
    error?: string;
    issues?: { path: string; message: string }[];
  } | null;

  if (!res.ok) {
    // A 401 while holding a token means it expired or was revoked.
    if (res.status === 401 && token && path !== "/auth/login") {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.issues);
  }
  return body as T;
}

const json = (value: unknown) => JSON.stringify(value);

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: json({ email, password }),
    }),

  me: () => request<{ user: User }>("/auth/me"),

  listUsers: () => request<{ data: User[] }>("/users"),

  listTickets: (filters: TicketFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return request<Paged<Ticket>>(`/tickets?${params}`);
  },

  getTicket: (id: number) => request<{ ticket: Ticket }>(`/tickets/${id}`),

  createTicket: (input: TicketInput) =>
    request<{ ticket: Ticket }>("/tickets", { method: "POST", body: json(input) }),

  updateTicket: (id: number, patch: TicketPatch) =>
    request<{ ticket: Ticket }>(`/tickets/${id}`, { method: "PATCH", body: json(patch) }),

  deleteTicket: (id: number) => request<void>(`/tickets/${id}`, { method: "DELETE" }),
};

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.issues.length) return err.issues.map((i) => `${i.path}: ${i.message}`).join(". ");
    return err.message;
  }
  return "Something went wrong";
}
