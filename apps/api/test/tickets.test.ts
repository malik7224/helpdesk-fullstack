import request from "supertest";
import { describe, expect, it } from "vitest";
import { bearer, setup } from "./helpers.js";

type Ctx = Awaited<ReturnType<typeof setup>>;

async function createTicket(ctx: Ctx, body: Record<string, unknown>) {
  const res = await request(ctx.app).post("/tickets").set(bearer(ctx.agent)).send(body);
  expect(res.status).toBe(201);
  return res.body.ticket as { id: number };
}

describe("authentication", () => {
  it("is required for every ticket route", async () => {
    const { app } = await setup();
    expect((await request(app).get("/tickets")).status).toBe(401);
    expect((await request(app).post("/tickets").send({ title: "abc" })).status).toBe(401);
    expect((await request(app).get("/tickets/1")).status).toBe(401);
    expect((await request(app).patch("/tickets/1").send({ status: "closed" })).status).toBe(401);
    expect((await request(app).delete("/tickets/1")).status).toBe(401);
  });
});

describe("POST /tickets", () => {
  it("creates a ticket with defaults and records who created it", async () => {
    const ctx = await setup();
    const res = await request(ctx.app).post("/tickets").set(bearer(ctx.agent)).send({ title: "Printer is on fire" });

    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({
      title: "Printer is on fire",
      status: "open",
      priority: "medium",
      description: "",
      createdBy: ctx.agentId,
      createdByName: "Agent",
      assigneeId: null,
    });
  });

  it("validates input", async () => {
    const ctx = await setup();
    const res = await request(ctx.app).post("/tickets").set(bearer(ctx.agent)).send({ title: "ab", priority: "urgent" });
    expect(res.status).toBe(400);
    expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual(["priority", "title"]);
  });

  it("rejects an assignee who does not exist", async () => {
    const ctx = await setup();
    const res = await request(ctx.app).post("/tickets").set(bearer(ctx.agent)).send({ title: "Valid title", assigneeId: 999 });
    expect(res.status).toBe(400);
  });
});

describe("GET /tickets", () => {
  it("paginates and reports totals", async () => {
    const ctx = await setup();
    for (let i = 1; i <= 5; i++) await createTicket(ctx, { title: `Ticket number ${i}` });

    const page1 = await request(ctx.app).get("/tickets?page=1&pageSize=2").set(bearer(ctx.agent));
    const page3 = await request(ctx.app).get("/tickets?page=3&pageSize=2").set(bearer(ctx.agent));

    expect(page1.body).toMatchObject({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
    expect(page1.body.data).toHaveLength(2);
    expect(page3.body.data).toHaveLength(1);
    expect(page1.body.data[0].title).toBe("Ticket number 5"); // newest first
  });

  it("searches title and description", async () => {
    const ctx = await setup();
    await createTicket(ctx, { title: "Login page broken", description: "Users see a blank screen" });
    await createTicket(ctx, { title: "Invoice typo" });

    const byTitle = await request(ctx.app).get("/tickets?q=login").set(bearer(ctx.agent));
    const byDescription = await request(ctx.app).get("/tickets?q=blank").set(bearer(ctx.agent));

    expect(byTitle.body.data.map((t: { title: string }) => t.title)).toEqual(["Login page broken"]);
    expect(byDescription.body.total).toBe(1);
  });

  it("treats % and _ in a search as plain text", async () => {
    const ctx = await setup();
    await createTicket(ctx, { title: "Discount of 100% applied" });
    await createTicket(ctx, { title: "Something else entirely" });

    const res = await request(ctx.app).get("/tickets").query({ q: "%" }).set(bearer(ctx.agent));
    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(["Discount of 100% applied"]);
  });

  it("filters by status, priority and assignee", async () => {
    const ctx = await setup();
    await createTicket(ctx, { title: "Urgent for admin", priority: "high", assigneeId: ctx.adminId });
    await createTicket(ctx, { title: "Low and unassigned", priority: "low" });

    const high = await request(ctx.app).get("/tickets?priority=high").set(bearer(ctx.agent));
    const mine = await request(ctx.app).get(`/tickets?assigneeId=${ctx.adminId}`).set(bearer(ctx.agent));
    const closed = await request(ctx.app).get("/tickets?status=closed").set(bearer(ctx.agent));

    expect(high.body.total).toBe(1);
    expect(mine.body.data[0].assigneeName).toBe("Admin");
    expect(closed.body.total).toBe(0);
  });

  it("rejects invalid query values", async () => {
    const ctx = await setup();
    const res = await request(ctx.app).get("/tickets?pageSize=1000&status=bogus").set(bearer(ctx.agent));
    expect(res.status).toBe(400);
  });
});

describe("GET /tickets/:id", () => {
  it("returns a ticket, 404 when missing, 400 for a bad id", async () => {
    const ctx = await setup();
    const { id } = await createTicket(ctx, { title: "Find me please" });

    expect((await request(ctx.app).get(`/tickets/${id}`).set(bearer(ctx.agent))).body.ticket.title).toBe("Find me please");
    expect((await request(ctx.app).get("/tickets/9999").set(bearer(ctx.agent))).status).toBe(404);
    expect((await request(ctx.app).get("/tickets/abc").set(bearer(ctx.agent))).status).toBe(400);
  });
});

describe("PATCH /tickets/:id", () => {
  it("updates only the fields provided and bumps updatedAt", async () => {
    const ctx = await setup();
    const { id } = await createTicket(ctx, { title: "Original title", priority: "low" });
    const before = (await request(ctx.app).get(`/tickets/${id}`).set(bearer(ctx.agent))).body.ticket;

    await new Promise((resolve) => setTimeout(resolve, 5));
    const res = await request(ctx.app)
      .patch(`/tickets/${id}`)
      .set(bearer(ctx.agent))
      .send({ status: "in_progress", assigneeId: ctx.agentId });

    expect(res.status).toBe(200);
    expect(res.body.ticket).toMatchObject({
      title: "Original title",
      priority: "low",
      status: "in_progress",
      assigneeId: ctx.agentId,
      assigneeName: "Agent",
    });
    expect(res.body.ticket.updatedAt > before.updatedAt).toBe(true);
  });

  it("can unassign with null", async () => {
    const ctx = await setup();
    const { id } = await createTicket(ctx, { title: "Has an owner", assigneeId: ctx.agentId });
    const res = await request(ctx.app).patch(`/tickets/${id}`).set(bearer(ctx.agent)).send({ assigneeId: null });
    expect(res.body.ticket.assigneeId).toBeNull();
  });

  it("validates input, assignee and existence", async () => {
    const ctx = await setup();
    const { id } = await createTicket(ctx, { title: "Some ticket" });

    expect((await request(ctx.app).patch(`/tickets/${id}`).set(bearer(ctx.agent)).send({})).status).toBe(400);
    expect((await request(ctx.app).patch(`/tickets/${id}`).set(bearer(ctx.agent)).send({ status: "bogus" })).status).toBe(400);
    expect((await request(ctx.app).patch(`/tickets/${id}`).set(bearer(ctx.agent)).send({ assigneeId: 999 })).status).toBe(400);
    expect((await request(ctx.app).patch("/tickets/9999").set(bearer(ctx.agent)).send({ status: "closed" })).status).toBe(404);
  });
});

describe("DELETE /tickets/:id", () => {
  it("is admin only", async () => {
    const ctx = await setup();
    const { id } = await createTicket(ctx, { title: "Delete me" });

    expect((await request(ctx.app).delete(`/tickets/${id}`).set(bearer(ctx.agent))).status).toBe(403);
    expect((await request(ctx.app).delete(`/tickets/${id}`).set(bearer(ctx.admin))).status).toBe(204);
    expect((await request(ctx.app).get(`/tickets/${id}`).set(bearer(ctx.agent))).status).toBe(404);
    expect((await request(ctx.app).delete(`/tickets/${id}`).set(bearer(ctx.admin))).status).toBe(404);
  });
});
