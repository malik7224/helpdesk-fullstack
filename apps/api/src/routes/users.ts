import { Router } from "express";
import { hashPassword } from "../auth/password.js";
import type { Db } from "../db.js";
import { conflict } from "../errors.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { createUserSchema } from "../schemas.js";

export function createUsersRouter(db: Db, secret: string) {
  const router = Router();
  router.use(authenticate(db, secret));

  // Any signed-in team member can list users (to pick an assignee).
  router.get("/", (_req, res) => {
    const users = db.prepare("SELECT id, email, name, role FROM users ORDER BY name").all();
    res.json({ data: users });
  });

  // Only admins create accounts. There is no open sign-up.
  router.post("/", requireRole("admin"), async (req, res) => {
    const input = createUserSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);

    try {
      const result = db
        .prepare("INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)")
        .run(input.email, input.name, passwordHash, input.role);
      res.status(201).json({
        user: { id: Number(result.lastInsertRowid), email: input.email, name: input.name, role: input.role },
      });
    } catch (err) {
      if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
        throw conflict("A user with this email already exists");
      }
      throw err;
    }
  });

  return router;
}
