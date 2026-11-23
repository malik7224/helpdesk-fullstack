import type { RequestHandler } from "express";
import { readCookie, SESSION_COOKIE } from "../auth/cookie.js";
import { forbidden } from "../errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookies are sent automatically by the browser, so a request that changes data and relies
 * on the session cookie must come from the web app's own origin. Requests without the cookie
 * (login, or API clients using an Authorization header) are not affected.
 */
export function requireTrustedOrigin(allowedOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method) || req.headers.authorization) return next();
    if (!readCookie(req, SESSION_COOKIE)) return next();
    if (req.headers.origin !== allowedOrigin) throw forbidden("Untrusted origin");
    next();
  };
}
