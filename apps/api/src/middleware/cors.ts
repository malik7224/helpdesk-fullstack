import type { RequestHandler } from "express";

/** Allows the web app's origin (and only that origin) to call the API from a browser. */
export function cors(allowedOrigin: string): RequestHandler {
  return (req, res, next) => {
    res.setHeader("Vary", "Origin");
    if (req.headers.origin === allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      // Needed so the browser sends and accepts the session cookie.
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}
