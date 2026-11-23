// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, describeError, UNAUTHORIZED_EVENT } from "@/lib/api";

const fetchMock = vi.fn();

function respond(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1)! as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("sends credentials as JSON and never sets an Authorization header", async () => {
    respond(200, { token: "t", user: { id: 1 } });
    await api.login("a@demo.test", "secret-pass");

    const { url, init, headers } = lastRequest();
    expect(url).toMatch(/\/auth\/login$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@demo.test", password: "secret-pass" });
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.has("Authorization")).toBe(false);
  });

  it("sends the session cookie with every request", async () => {
    respond(200, { user: { id: 1 } });
    await api.me();
    expect(lastRequest().init.credentials).toBe("include");
    expect(lastRequest().headers.has("Authorization")).toBe(false);
  });

  it("logs out with a POST", async () => {
    respond(204);
    await api.logout();
    expect(lastRequest().url).toMatch(/\/auth\/logout$/);
    expect(lastRequest().init.method).toBe("POST");
  });

  it("builds the ticket query and skips empty filters", async () => {
    respond(200, { data: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
    await api.listTickets({ q: "login", status: "open", priority: undefined, assigneeId: 3, page: 2, pageSize: 10 });

    const params = new URL(lastRequest().url).searchParams;
    expect(Object.fromEntries(params)).toEqual({
      q: "login",
      status: "open",
      assigneeId: "3",
      page: "2",
      pageSize: "10",
    });
  });

  it("returns undefined for a 204 response", async () => {
    respond(204);
    await expect(api.deleteTicket(5)).resolves.toBeUndefined();
    expect(lastRequest().init.method).toBe("DELETE");
  });

  it("throws an ApiError carrying the server's message and validation issues", async () => {
    respond(400, { error: "Validation failed", issues: [{ path: "title", message: "Too short" }] });

    const error = await api.createTicket({ title: "ab" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).issues).toEqual([{ path: "title", message: "Too short" }]);
    expect(describeError(error)).toBe("title: Too short");
  });

  it("explains a network failure instead of leaking the raw error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const error = await api.me().catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(0);
    expect(describeError(error)).toMatch(/cannot reach the server/i);
  });
});

describe("expired sessions", () => {
  it("signals sign-out when a normal request comes back 401", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    respond(401, { error: "Invalid or expired token" });
    await api.listTickets().catch(() => undefined);

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("does not sign out on a failed login or when checking for a session", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    respond(401, { error: "Invalid email or password" });
    await api.login("a@demo.test", "wrong").catch(() => undefined);

    respond(401, { error: "Authentication required" });
    await api.me().catch(() => undefined);

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });
});

