import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";

describe("health", () => {
  const app = createApp({ db: openDb() });

  it("reports ok when the database is reachable", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

describe("database schema", () => {
  it("rejects an invalid ticket status", () => {
    const db = openDb();
    db.exec(
      "INSERT INTO users (email, name, password_hash, role) VALUES ('a@demo.test', 'A', 'x', 'agent')",
    );
    expect(() =>
      db.exec("INSERT INTO tickets (title, status, created_by) VALUES ('t', 'bogus', 1)"),
    ).toThrow();
  });
});
