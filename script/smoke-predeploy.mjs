import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";

const { Client } = pg;

const APP_ENV = process.env.APP_ENV ?? "production";
const PORT = Number(process.env.SMOKE_PORT ?? "5050");
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? "45000");
const HEALTH_PATH = process.env.SMOKE_HEALTH_PATH ?? "/api/health/db";
const HEALTH_URL =
  process.env.SMOKE_HEALTH_URL ?? `http://127.0.0.1:${PORT}${HEALTH_PATH}`;
const START_CMD = process.env.SMOKE_START_CMD ?? "node dist/index.cjs";
const SKIP_API = process.env.SMOKE_SKIP_API === "1";
const REQUIRE_DB = process.env.SMOKE_REQUIRE_DB === "1";
const VERBOSE_SERVER_LOGS = process.env.SMOKE_VERBOSE_SERVER_LOGS === "1";
const SERVER_LOG_TAIL_LINES = Number(process.env.SMOKE_SERVER_LOG_TAIL_LINES ?? "40");
const SERVER_LOG_LINE_MAX = Number(process.env.SMOKE_SERVER_LOG_LINE_MAX ?? "400");

function log(message) {
  console.log(`[smoke:${APP_ENV}] ${message}`);
}

function fail(message) {
  console.error(`[smoke:${APP_ENV}] ${message}`);
}

function formatServerLine(source, line) {
  const trimmed = line.trimEnd();
  if (!trimmed) {
    return null;
  }
  const clipped =
    trimmed.length > SERVER_LOG_LINE_MAX
      ? `${trimmed.slice(0, SERVER_LOG_LINE_MAX)} ...<truncated>`
      : trimmed;
  return `[server:${source}] ${clipped}`;
}

async function pingDatabase() {
  if (!process.env.DATABASE_URL) {
    if (REQUIRE_DB) {
      throw new Error("DATABASE_URL is missing");
    }
    log("DATABASE_URL is missing, skipping database ping");
    return false;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      "select current_database() as db, current_user as user, now() as now",
    );
    const row = result.rows[0] ?? {};
    log(
      `database ping ok (db=${row.db ?? "unknown"}, user=${row.user ?? "unknown"})`,
    );
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

function startServer() {
  log(`starting API process (${START_CMD}) on port ${PORT}`);

  const serverLogs = [];
  const child = spawn(START_CMD, {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const appendLogs = (source, chunk) => {
    const text = String(chunk).replace(/\r/g, "");
    const lines = text.split("\n");
    for (const line of lines) {
      const formatted = formatServerLine(source, line);
      if (!formatted) {
        continue;
      }
      serverLogs.push(formatted);
      if (serverLogs.length > SERVER_LOG_TAIL_LINES) {
        serverLogs.shift();
      }
      if (VERBOSE_SERVER_LOGS) {
        console.log(formatted);
      }
    }
  };

  child.stdout.on("data", (chunk) => {
    appendLogs("stdout", chunk);
  });
  child.stderr.on("data", (chunk) => {
    appendLogs("stderr", chunk);
  });

  return { child, serverLogs };
}

async function waitForHealth(server) {
  const startedAt = Date.now();
  let lastError = "no response yet";

  while (Date.now() - startedAt < TIMEOUT_MS) {
    if (server.child.exitCode !== null) {
      throw new Error(
        `API process exited early with code ${server.child.exitCode}`,
      );
    }

    try {
      const response = await fetch(HEALTH_URL, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      const body = await response.text();
      const json = body ? JSON.parse(body) : null;

      if (response.ok && json?.ok === true) {
        log("API health check ok");
        return;
      }

      lastError = `status=${response.status} body=${body}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(1000);
  }

  throw new Error(
    `timed out waiting for ${HEALTH_URL} after ${TIMEOUT_MS}ms (${lastError})`,
  );
}

async function stopServer(server) {
  if (server.child.exitCode !== null) {
    return;
  }

  server.child.kill("SIGTERM");
  const exited = await Promise.race([
    once(server.child, "exit").then(() => true),
    sleep(5000).then(() => false),
  ]);

  if (!exited) {
    server.child.kill("SIGKILL");
    await once(server.child, "exit").catch(() => {});
  }
}

async function main() {
  log("starting predeploy smoke test");
  const hasDatabase = await pingDatabase();

  if (!hasDatabase && !SKIP_API) {
    log("skipping API health check because DATABASE_URL is missing");
    log("smoke test passed (no database mode)");
    return;
  }

  if (SKIP_API) {
    log("SMOKE_SKIP_API=1 set, skipping API health check");
    log("smoke test passed");
    return;
  }

  const server = startServer();
  let passed = false;
  try {
    await waitForHealth(server);
    passed = true;
    log("smoke test passed");
  } finally {
    if (!passed && server.serverLogs.length > 0 && VERBOSE_SERVER_LOGS === false) {
      log("last server logs:");
      for (const line of server.serverLogs) {
        console.log(line);
      }
    }
    await stopServer(server);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
