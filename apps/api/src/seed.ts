import { hashPassword } from "./auth/password.js";
import { config } from "./config.js";
import { openDb } from "./db.js";

// Demo data only. These accounts and passwords are fake and for local use.
const DEMO_PASSWORD = "demo-password-123";

const db = openDb(config.dbPath);
const { count } = db.prepare("SELECT COUNT(*) AS count FROM users").get() as unknown as {
  count: number;
};

if (count > 0) {
  console.log("Database already has users, nothing to seed.");
  db.close();
  process.exit(0);
}

const passwordHash = await hashPassword(DEMO_PASSWORD);
const insertUser = db.prepare(
  "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)",
);
const admin = Number(insertUser.run("admin@demo.test", "Ada Admin", passwordHash, "admin").lastInsertRowid);
const agent = Number(insertUser.run("agent@demo.test", "Sam Agent", passwordHash, "agent").lastInsertRowid);

const insertTicket = db.prepare(
  "INSERT INTO tickets (title, description, status, priority, created_by, assignee_id) VALUES (?, ?, ?, ?, ?, ?)",
);
const samples: [string, string, string, string, number, number | null][] = [
  ["Cannot reset my password", "The reset email never arrives.", "open", "high", admin, agent],
  ["Invoice shows the wrong total", "Tax is applied twice on invoice 1042.", "in_progress", "medium", admin, agent],
  ["Add dark mode to the dashboard", "Several users asked for it.", "open", "low", agent, null],
  ["Export to CSV fails on large reports", "Timeout after about 30 seconds.", "open", "high", agent, agent],
  ["Typo on the pricing page", "Should read 'billed annually'.", "resolved", "low", admin, admin],
  ["Mobile menu does not close", "Happens on small Android phones.", "closed", "medium", agent, agent],
];
for (const sample of samples) insertTicket.run(...sample);

console.log(`Seeded 2 users and ${samples.length} tickets.`);
console.log(`  admin@demo.test / ${DEMO_PASSWORD}  (admin)`);
console.log(`  agent@demo.test / ${DEMO_PASSWORD}  (agent)`);
db.close();
