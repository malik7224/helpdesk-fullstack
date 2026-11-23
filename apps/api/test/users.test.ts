import request from "supertest";
import { describe, expect, it } from "vitest";
import { bearer, setup } from "./helpers.js";

const newUser = { email: "New.Person@test.dev", name: "New Person", password: "a-long-password", role: "agent" };

describe("GET /users", () => {
  it("requires authentication", async () => {
    const { app } = await setup();
    expect((await request(app).get("/users")).status).toBe(401);
  });

  it("lists users for any signed-in member, without password data", async () => {
    const { app, agent } = await setup();
    const res = await request(app).get("/users").set(bearer(agent));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain("password");
  });
});

describe("POST /users", () => {
  it("lets an admin create a user, and that user can log in", async () => {
    const { app, admin } = await setup();
    const created = await request(app).post("/users").set(bearer(admin)).send(newUser);

    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({ email: "new.person@test.dev", role: "agent" });
    expect(JSON.stringify(created.body)).not.toContain("password");

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "new.person@test.dev", password: newUser.password });
    expect(login.status).toBe(200);
  });

  it("forbids agents from creating users", async () => {
    const { app, agent } = await setup();
    const res = await request(app).post("/users").set(bearer(agent)).send(newUser);
    expect(res.status).toBe(403);
  });

  it("rejects a duplicate email with 409", async () => {
    const { app, admin } = await setup();
    await request(app).post("/users").set(bearer(admin)).send(newUser);
    const again = await request(app).post("/users").set(bearer(admin)).send(newUser);
    expect(again.status).toBe(409);
  });

  it("rejects a short password and an unknown role", async () => {
    const { app, admin } = await setup();
    const short = await request(app).post("/users").set(bearer(admin)).send({ ...newUser, password: "short" });
    const role = await request(app).post("/users").set(bearer(admin)).send({ ...newUser, role: "root" });
    expect(short.status).toBe(400);
    expect(role.status).toBe(400);
  });
});
