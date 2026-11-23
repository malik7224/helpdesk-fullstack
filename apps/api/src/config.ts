const DEV_SECRET = "dev-only-secret-change-me";

function readJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return DEV_SECRET;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath: process.env.DB_PATH ?? "helpdesk.db",
  jwtSecret: readJwtSecret(),
  jwtExpiresIn: "8h",
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
} as const;
