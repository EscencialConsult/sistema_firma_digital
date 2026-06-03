import { pool } from "./pool.js";
import { initialSchemaSql } from "./schema.js";

async function migrate() {
  await pool.query(initialSchemaSql);
  await pool.end();
  console.log("Database migration completed");
}

migrate().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
