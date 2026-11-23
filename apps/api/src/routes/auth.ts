import { randomBytes } from "node:crypto";
import { Router, type RequestHandler } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { clearSessionCookie, setSessionCookie } from "../auth/cookie.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import type { Db } from "../db.js";
import { unauthorized } from "../errors.js";
import { authenticate } from "../middleware/auth.js";
import { loginSchema } from "../schemas.js";
import type { AuthUser } from "../types.js";

interface AuthRouterOptions {
  db: Db;
  secret: string;
  expiresIn: SignOptions["expiresIn"];
  loginLimiter: RequestHandler;
  cookieSecure: boolean;
  cookieMaxAgeMs: number;
}

// Hashed once at startup so unknown emails cost the same time as wrong passwords.
const dummyHash = hashPassword(randomBytes(16).toString("hex"));

export function createAuthRouter({
  db,
  secret,
  expiresIn,
  loginLimiter,
  cookieSecure,
  cookieMaxAgeMs,
}: AuthRouterOptions) {
  const router = Router();
  const findByEmail = db.prepare(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = ?",
  );

  router.post("/login", loginLimiter, async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const row = findByEmail.get(email) as unknown as
      | (AuthUser & { password_hash: string })
      | undefined;

    const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
    if (!row || !ok) throw unauthorized("Invalid email or password");

    const user: AuthUser = { id: row.id, email: row.email, name: row.name, role: row.role };
    const token = jwt.sign({ sub: String(user.id) }, secret, { algorithm: "HS256", expiresIn });
    // Browsers get an httpOnly cookie. The token is also returned for non-browser API clients.
    setSessionCookie(res, token, cookieMaxAgeMs, cookieSecure);
    res.json({ token, user });
  });

  router.post("/logout", (_req, res) => {
    clearSessionCookie(res, cookieSecure);
    res.status(204).end();
  });

  router.get("/me", authenticate(db, secret), (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
