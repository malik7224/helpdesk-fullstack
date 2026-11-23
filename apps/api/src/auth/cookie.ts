import type { CookieOptions, Request, Response } from "express";

export const SESSION_COOKIE = "helpdesk_session";

/** Reads one cookie from the Cookie header. Small enough that we skip a cookie-parser dependency. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function baseOptions(secure: boolean): CookieOptions {
  // httpOnly keeps the token out of reach of page scripts (XSS). SameSite=Lax stops
  // other sites from sending it on cross-site POST requests.
  return { httpOnly: true, sameSite: "lax", secure, path: "/" };
}

export function setSessionCookie(res: Response, token: string, maxAgeMs: number, secure: boolean) {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(secure), maxAge: maxAgeMs });
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, baseOptions(secure));
}
