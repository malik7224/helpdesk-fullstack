import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 16384; // scrypt N: CPU/memory cost
const PREFIX = "scrypt";

function derive(password: string, salt: Buffer, keyLength: number, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { N: cost, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/** Hashes a password with scrypt. Stored as `scrypt$cost$salt$key` (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, COST);
  return [PREFIX, COST, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Constant-time check of a password against a stored hash. Malformed hashes never match. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, cost, saltB64, keyB64] = stored.split("$");
  if (prefix !== PREFIX || !cost || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, "base64");
  const costNumber = Number(cost);
  if (!Number.isInteger(costNumber) || expected.length === 0) return false;

  const actual = await derive(password, Buffer.from(saltB64, "base64"), expected.length, costNumber);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
