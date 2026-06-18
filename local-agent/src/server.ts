import express from "express";
import cors from "cors";
import { agentRouter } from "./routes.js";

const PORT = Number(process.env.AGENT_PORT ?? 4001);

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));

app.use("/api/agent", agentRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, agent: "firma-digital-local-agent", status: "running" });
});

app.listen(PORT, () => {
  console.log(`[local-agent] Corriendo en http://127.0.0.1:${PORT}`);
  console.log(`[local-agent] Endpoints:`);
  console.log(`  GET  /api/agent/pkcs11/tokens?pin=xxx`);
  console.log(`  POST /api/agent/pkcs11/sign`);
  console.log(`  GET  /api/agent/windows/certs`);
  console.log(`  POST /api/agent/windows/sign`);
});
