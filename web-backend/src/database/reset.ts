import { pool } from "./pool.js";
import { initialSchemaSql } from "./schema.js";

const dropSql = `
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS conformity_acceptances CASCADE;
DROP TABLE IF EXISTS signatures CASCADE;
DROP TABLE IF EXISTS signature_requests CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS identity_audit_logs CASCADE;
DROP TABLE IF EXISTS identity_documents CASCADE;
DROP TABLE IF EXISTS identity_verifications CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
`;

async function reset() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset database in production.");
  }
  await pool.query(dropSql);
  await pool.query(initialSchemaSql);
  console.log("Database reset completed");
}

reset()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

