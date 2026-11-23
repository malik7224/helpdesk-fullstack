import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { Db, Role } from "../db.js";
import { forbidden, unauthorized } from "../errors.js";
import type { AuthUser } from "../types.js";

/** Reads `Authorization: Bearer <token>`, verifies it, and loads the user from the database. */
export function authenticate(db: Db, secret: string): RequestHandler {
  const findUser = db.prepare("SELECT id, email, name, role FROM users WHERE id = ?");

  return (req, _res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    if (!token) throw unauthorized();

    let subject: number;
    try {
      const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
      subject = Number(typeof payload === "string" ? NaN : payload.sub);
    } catch {
      throw unauthorized("Invalid or expired token");
    }

    // Load the user fresh so a deleted user or changed role takes effect immediately.
    const user = findUser.get(subject) as unknown as AuthUser | undefined;
    if (!user) throw unauthorized("Invalid or expired token");

    req.user = user;
    next();
  };
}

/** Allows the request only if the signed-in user has one of the given roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
