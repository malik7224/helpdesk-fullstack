import express, { type ErrorRequestHandler, type Express } from "express";
import type { SignOptions } from "jsonwebtoken";
import { ZodError } from "zod";
import { config } from "./config.js";
import type { Db } from "./db.js";
import { HttpError } from "./errors.js";
import { cors } from "./middleware/cors.js";
import { requireTrustedOrigin } from "./middleware/csrf.js";
import { createRateLimiter, type RateLimitOptions } from "./middleware/rateLimit.js";
import { createAuthRouter } from "./routes/auth.js";
import { createTicketsRouter } from "./routes/tickets.js";
import { createUsersRouter } from "./routes/users.js";
import "./types.js";

export interface AppDeps {
  db: Db;
  jwtSecret?: string;
  jwtExpiresIn?: SignOptions["expiresIn"];
  webOrigin?: string;
  loginRateLimit?: RateLimitOptions;
  cookieSecure?: boolean;
  sessionMaxAgeMs?: number;
}

export function createApp({
  db,
  jwtSecret = config.jwtSecret,
  jwtExpiresIn = config.jwtExpiresIn,
  webOrigin = config.webOrigin,
  loginRateLimit = { max: 10, windowMs: 15 * 60 * 1000 },
  cookieSecure = config.cookieSecure,
  sessionMaxAgeMs = config.sessionMaxAgeMs,
}: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(cors(webOrigin));
  app.use(requireTrustedOrigin(webOrigin));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    // A cheap query proves the database is reachable, not just the process.
    db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });

  app.use(
    "/auth",
    createAuthRouter({
      db,
      secret: jwtSecret,
      expiresIn: jwtExpiresIn,
      loginLimiter: createRateLimiter(loginRateLimit),
      cookieSecure,
      cookieMaxAgeMs: sessionMaxAgeMs,
    }),
  );
  app.use("/users", createUsersRouter(db, jwtSecret));
  app.use("/tickets", createTicketsRouter(db, jwtSecret));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "Validation failed",
        issues: err.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message,
        })),
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    const type = (err as { type?: string }).type;
    if (type === "entity.parse.failed") {
      res.status(400).json({ error: "Request body is not valid JSON" });
      return;
    }
    if (type === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(onError);

  return app;
}
