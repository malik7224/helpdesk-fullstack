import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { TEST_PASSWORD, bearer, buildApp, insertUser, setup } from "./helpers.js";

describe("POST /auth/login", () => {
  it("returns a token and the user, never the password hash", async () => {
    const { app, adminId } = await setup();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@test.dev", password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: adminId, email: "admin@test.dev", name: "Admin", role: "admin" });
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("treats the email case-insensitively", async () => {
    const { app } = await setup();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "  ADMIN@Test.dev ", password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const { app } = await setup();
    const wrong = await request(app).post("/auth/login").send({ email: "admin@test.dev", password: "nope" });
    const unknown = await request(app).post("/auth/login").send({ email: "who@test.dev", password: "nope" });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("validates the request body", async () => {
    const { app } = await setup();
    const res = await request(app).post("/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("rejects malformed JSON with a 400", async () => {
    const { app } = await setup();
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
  });

  it("rate limits repeated attempts", async () => {
    const { app, db } = buildApp({ loginRateLimit: { max: 3, windowMs: 60_000 } });
    await insertUser(db, "admin@test.dev", "admin");

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/auth/login").send({ email: "admin@test.dev", password: "wrong" });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 429, 429]);
  });
});

describe("GET /auth/me", () => {
  it("requires a token", async () => {
    const { app } = await setup();
    expect((await request(app).get("/auth/me")).status).toBe(401);
  });

  it("returns the signed-in user", async () => {
    const { app, agent } = await setup();
    const res = await request(app).get("/auth/me").set(bearer(agent));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("agent@test.dev");
  });

  it("rejects garbage, tampered and expired tokens", async () => {
    const { app, agentId } = await setup();
    const forged = jwt.sign({ sub: String(agentId) }, "some-other-secret");
    const expired = jwt.sign({ sub: String(agentId) }, "test-secret", { expiresIn: -10 });

    for (const token of ["garbage", forged, expired]) {
      const res = await request(app).get("/auth/me").set(bearer(token));
      expect(res.status).toBe(401);
    }
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const { app, db, agent, agentId } = await setup();
    db.prepare("DELETE FROM users WHERE id = ?").run(agentId);
    const res = await request(app).get("/auth/me").set(bearer(agent));
    expect(res.status).toBe(401);
  });
});

describe("cookie sessions", () => {
  const WEB = "http://localhost:3000";

  async function loginWithCookie(app: Parameters<typeof request>[0]) {
    const res = await request(app).post("/auth/login").send({ email: "agent@test.dev", password: TEST_PASSWORD });
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
    return { res, cookie, pair: cookie.split(";")[0]! };
  }

  it("sets an httpOnly, SameSite=Lax session cookie on login", async () => {
    const { app } = await setup();
    const { cookie } = await loginWithCookie(app);
    expect(cookie).toMatch(/^helpdesk_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=28800/);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("marks the cookie Secure when configured for production", async () => {
    const { app, db } = buildApp({ cookieSecure: true });
    await insertUser(db, "agent@test.dev", "agent");
    const { cookie } = await loginWithCookie(app);
    expect(cookie).toMatch(/Secure/);
  });

  it("accepts the cookie instead of a Bearer header", async () => {
    const { app } = await setup();
    const { pair } = await loginWithCookie(app);
    const res = await request(app).get("/auth/me").set("Cookie", pair);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("agent@test.dev");
  });

  it("rejects a tampered cookie", async () => {
    const { app } = await setup();
    const res = await request(app).get("/auth/me").set("Cookie", "helpdesk_session=garbage");
    expect(res.status).toBe(401);
  });

  it("clears the cookie on logout", async () => {
    const { app } = await setup();
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^helpdesk_session=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it("blocks cookie-authenticated writes from another origin", async () => {
    const { app } = await setup();
    const { pair } = await loginWithCookie(app);
    const body = { title: "Cross-site ticket" };

    const evil = await request(app).post("/tickets").set("Cookie", pair).set("Origin", "https://evil.example").send(body);
    expect(evil.status).toBe(403);
    const none = await request(app).post("/tickets").set("Cookie", pair).send(body);
    expect(none.status).toBe(403);
    const ok = await request(app).post("/tickets").set("Cookie", pair).set("Origin", WEB).send(body);
    expect(ok.status).toBe(201);
  });

  it("allows the web origin to send credentials (CORS)", async () => {
    const { app } = await setup();
    const res = await request(app).options("/tickets").set("Origin", WEB);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["access-control-allow-origin"]).toBe(WEB);
  });
});
