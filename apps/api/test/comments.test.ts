import request from "supertest";
import { describe, expect, it } from "vitest";
import { bearer, setup } from "./helpers.js";

async function newTicket(ctx: Awaited<ReturnType<typeof setup>>) {
  const res = await request(ctx.app)
    .post("/tickets")
    .set(bearer(ctx.agent))
    .send({ title: "Printer is on fire" });
  return res.body.ticket.id as number;
}

describe("ticket comments", () => {
  it("requires a signed-in user", async () => {
    const ctx = await setup();
    const id = await newTicket(ctx);
    expect((await request(ctx.app).get(`/tickets/${id}/comments`)).status).toBe(401);
    expect((await request(ctx.app).post(`/tickets/${id}/comments`).send({ body: "hi" })).status).toBe(401);
  });

  it("adds a comment and lists comments oldest first", async () => {
    const ctx = await setup();
    const id = await newTicket(ctx);

    const first = await request(ctx.app)
      .post(`/tickets/${id}/comments`)
      .set(bearer(ctx.agent))
      .send({ body: "  Looking into it.  " });
    expect(first.status).toBe(201);
    expect(first.body.comment).toMatchObject({
      ticketId: id,
      body: "Looking into it.",
      authorId: ctx.agentId,
      authorName: "Agent",
    });

    await request(ctx.app).post(`/tickets/${id}/comments`).set(bearer(ctx.admin)).send({ body: "Any update?" });

    const list = await request(ctx.app).get(`/tickets/${id}/comments`).set(bearer(ctx.agent));
    expect(list.status).toBe(200);
    expect(list.body.comments.map((c: { body: string }) => c.body)).toEqual([
      "Looking into it.",
      "Any update?",
    ]);
  });

  it("rejects empty and oversized comments", async () => {
    const ctx = await setup();
    const id = await newTicket(ctx);
    const empty = await request(ctx.app).post(`/tickets/${id}/comments`).set(bearer(ctx.agent)).send({ body: "   " });
    expect(empty.status).toBe(400);
    const long = await request(ctx.app)
      .post(`/tickets/${id}/comments`)
      .set(bearer(ctx.agent))
      .send({ body: "x".repeat(2001) });
    expect(long.status).toBe(400);
  });

  it("returns 404 for a ticket that does not exist", async () => {
    const ctx = await setup();
    expect((await request(ctx.app).get("/tickets/999/comments").set(bearer(ctx.agent))).status).toBe(404);
    const res = await request(ctx.app).post("/tickets/999/comments").set(bearer(ctx.agent)).send({ body: "hi" });
    expect(res.status).toBe(404);
  });

  it("deletes comments together with their ticket", async () => {
    const ctx = await setup();
    const id = await newTicket(ctx);
    await request(ctx.app).post(`/tickets/${id}/comments`).set(bearer(ctx.agent)).send({ body: "hello" });
    await request(ctx.app).delete(`/tickets/${id}`).set(bearer(ctx.admin));
    const row = ctx.db.prepare("SELECT COUNT(*) AS n FROM comments").get() as unknown as { n: number };
    expect(row.n).toBe(0);
  });
});
