import request from "supertest";
import { createApp, type AppDeps } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { openDb, type Db, type Role } from "../src/db.js";

export const TEST_PASSWORD = "test-password-123";

export function buildApp(overrides: Partial<AppDeps> = {}) {
  const db = openDb();
  const app = createApp({
    db,
    jwtSecret: "test-secret",
    // High limit so ordinary tests never trip it; the rate-limit test overrides this.
    loginRateLimit: { max: 1000, windowMs: 60_000 },
    ...overrides,
  });
  return { app, db };
}

export async function insertUser(db: Db, email: string, role: Role, name = email.split("@")[0]!) {
  const hash = await hashPassword(TEST_PASSWORD);
  const result = db
    .prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(email, name, hash, role);
  return Number(result.lastInsertRowid);
}

export async function login(app: ReturnType<typeof createApp>, email: string) {
  const res = await request(app).post("/auth/login").send({ email, password: TEST_PASSWORD });
  return res.body.token as string;
}

/** An app with one admin and one agent, plus a token for each. */
export async function setup() {
  const { app, db } = buildApp();
  const adminId = await insertUser(db, "admin@test.dev", "admin", "Admin");
  const agentId = await insertUser(db, "agent@test.dev", "agent", "Agent");
  const admin = await login(app, "admin@test.dev");
  const agent = await login(app, "agent@test.dev");
  return { app, db, adminId, agentId, admin, agent };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
