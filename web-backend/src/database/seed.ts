import { pool } from "./pool.js";
import { config } from "../config/env.js";
import { hashPassword } from "../utils/crypto.js";

async function seed() {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [config.adminEmail.toLowerCase()]);
  if ((existing.rowCount ?? 0) > 0) {
    console.log(`Admin already exists: ${config.adminEmail}`);
    return;
  }

  const passwordHash = await hashPassword(config.adminPassword);
  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role, verification_status)
     VALUES ($1, $2, $3, 'ADMIN', 'VERIFIED')`,
    [config.adminEmail.toLowerCase(), passwordHash, "Platform Admin"]
  );
  console.log(`Admin created: ${config.adminEmail}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

