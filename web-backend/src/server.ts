import fs from "node:fs";
import path from "node:path";
import { createApp } from "./app.js";
import { config } from "./config/env.js";

for (const dir of ["certificates", "identity", "incoming"]) {
  const p = path.resolve(config.uploadDir, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const app = createApp();

app.listen(config.port, () => {
  console.log(`Firma Digital API listening on http://127.0.0.1:${config.port}`);
});

