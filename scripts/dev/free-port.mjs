#!/usr/bin/env node
import { execFile } from "node:child_process";
import { access, readlink, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const workspaceRoot = process.cwd();
const args = process.argv.slice(2);
const force = args.includes("--force");
const ports = args
  .filter((arg) => arg !== "--force")
  .map((arg) => Number(arg))
  .filter((port) => Number.isInteger(port) && port > 0);

if (ports.length === 0) {
  console.error("Usage: node scripts/dev/free-port.mjs <port...> [--force]");
  process.exit(1);
}

let failed = false;

for (const port of ports) {
  const pids = await findListeningPids(port);

  if (pids.length === 0) {
    console.log(`Port ${port} is free.`);
    continue;
  }

  for (const pid of pids) {
    const processInfo = await getProcessInfo(pid);
    const canKill = force || isWorkspaceProcess(processInfo);

    if (!canKill) {
      failed = true;
      console.error(
        `Port ${port} is used by PID ${pid}, but it does not look like a Classia dev process.`,
      );
      console.error(`Command: ${processInfo.command || "unknown"}`);
      console.error("Use --force only if you are sure this process can be stopped.");
      continue;
    }

    await stopProcess(pid, port);
  }
}

if (failed) {
  process.exit(1);
}

async function findListeningPids(port) {
  const fromSs = await pidsFromSs(port);

  if (fromSs.length > 0) {
    return fromSs;
  }

  return pidsFromLsof(port);
}

async function pidsFromSs(port) {
  try {
    const { stdout } = await execFileAsync("ss", ["-ltnp"]);
    const pids = new Set();

    for (const line of stdout.split("\n")) {
      if (!line.includes(`:${port}`)) {
        continue;
      }

      const matches = line.matchAll(/pid=(\d+)/g);
      for (const match of matches) {
        pids.add(Number(match[1]));
      }
    }

    return [...pids];
  } catch {
    return [];
  }
}

async function pidsFromLsof(port) {
  try {
    const { stdout } = await execFileAsync("lsof", [
      "-tiTCP:" + port,
      "-sTCP:LISTEN",
    ]);

    return stdout
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

async function getProcessInfo(pid) {
  const [cwd, command] = await Promise.all([
    readlink(`/proc/${pid}/cwd`).catch(() => ""),
    readFile(`/proc/${pid}/cmdline`, "utf8")
      .then((value) => value.replaceAll("\0", " ").trim())
      .catch(() => ""),
  ]);

  return {
    cwd,
    command,
  };
}

function isWorkspaceProcess(processInfo) {
  return (
    processInfo.cwd.startsWith(workspaceRoot) ||
    processInfo.command.includes(workspaceRoot) ||
    processInfo.command.includes("classia-saas")
  );
}

async function stopProcess(pid, port) {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  await wait(800);

  if (await processExists(pid)) {
    process.kill(pid, "SIGKILL");
    await wait(200);
  }

  console.log(`Stopped PID ${pid} on port ${port}.`);
}

async function processExists(pid) {
  try {
    process.kill(pid, 0);
    await access(`/proc/${pid}`);
    return true;
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
