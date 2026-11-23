import { Router } from "express";
import type { Db } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  createTicketSchema,
  idParam,
  listTicketsQuery,
  updateTicketSchema,
} from "../schemas.js";

const SELECT_TICKET = `
  SELECT t.id, t.title, t.description, t.status, t.priority,
         t.created_by  AS createdBy,  c.name AS createdByName,
         t.assignee_id AS assigneeId, a.name AS assigneeName,
         t.created_at  AS createdAt,  t.updated_at AS updatedAt
  FROM tickets t
  JOIN users c ON c.id = t.created_by
  LEFT JOIN users a ON a.id = t.assignee_id`;

type SqlValue = string | number | null;

/** Escapes % and _ so a search for "100%" matches the text, not "everything". */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export function createTicketsRouter(db: Db, secret: string) {
  const router = Router();
  router.use(authenticate(db, secret));

  const userExists = db.prepare("SELECT 1 FROM users WHERE id = ?");
  const getTicket = db.prepare(`${SELECT_TICKET} WHERE t.id = ?`);

  function assertAssignee(assigneeId: number | null | undefined) {
    if (assigneeId != null && !userExists.get(assigneeId)) {
      throw badRequest("Assignee does not exist");
    }
  }

  router.get("/", (req, res) => {
    const query = listTicketsQuery.parse(req.query);

    const where: string[] = [];
    const params: SqlValue[] = [];
    if (query.q) {
      const pattern = `%${escapeLike(query.q)}%`;
      where.push("(t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\')");
      params.push(pattern, pattern);
    }
    if (query.status) {
      where.push("t.status = ?");
      params.push(query.status);
    }
    if (query.priority) {
      where.push("t.priority = ?");
      params.push(query.priority);
    }
    if (query.assigneeId) {
      where.push("t.assignee_id = ?");
      params.push(query.assigneeId);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM tickets t ${clause}`)
      .get(...params) as unknown as { total: number };

    const data = db
      .prepare(`${SELECT_TICKET} ${clause} ORDER BY t.updated_at DESC, t.id DESC LIMIT ? OFFSET ?`)
      .all(...params, query.pageSize, (query.page - 1) * query.pageSize);

    res.json({
      data,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    });
  });

  router.post("/", (req, res) => {
    const input = createTicketSchema.parse(req.body);
    assertAssignee(input.assigneeId);

    const result = db
      .prepare(
        "INSERT INTO tickets (title, description, priority, created_by, assignee_id) VALUES (?, ?, ?, ?, ?)",
      )
      .run(input.title, input.description, input.priority, req.user!.id, input.assigneeId ?? null);

    res.status(201).json({ ticket: getTicket.get(Number(result.lastInsertRowid)) });
  });

  router.get("/:id", (req, res) => {
    const ticket = getTicket.get(idParam.parse(req.params.id));
    if (!ticket) throw notFound("Ticket not found");
    res.json({ ticket });
  });

  router.patch("/:id", (req, res) => {
    const id = idParam.parse(req.params.id);
    const input = updateTicketSchema.parse(req.body);
    assertAssignee(input.assigneeId);

    const columns: Record<string, string> = {
      title: "title",
      description: "description",
      status: "status",
      priority: "priority",
      assigneeId: "assignee_id",
    };
    const sets: string[] = [];
    const params: SqlValue[] = [];
    for (const [key, column] of Object.entries(columns)) {
      const value = input[key as keyof typeof input];
      if (value !== undefined) {
        sets.push(`${column} = ?`);
        params.push(value);
      }
    }
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");

    const result = db.prepare(`UPDATE tickets SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
    if (result.changes === 0) throw notFound("Ticket not found");

    res.json({ ticket: getTicket.get(id) });
  });

  router.delete("/:id", requireRole("admin"), (req, res) => {
    const result = db.prepare("DELETE FROM tickets WHERE id = ?").run(idParam.parse(req.params.id));
    if (result.changes === 0) throw notFound("Ticket not found");
    res.status(204).end();
  });

  return router;
}
