#!/usr/bin/env node
import { execFile } from "node:child_process";
import { access, readlink, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const workspaceRoot = process.cwd();
const isWindows = process.platform === "win32";
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
  if (isWindows) {
    return pidsFromNetstat(port);
  }

  const fromSs = await pidsFromSs(port);

  if (fromSs.length > 0) {
    return fromSs;
  }

  return pidsFromLsof(port);
}

async function pidsFromNetstat(port) {
  try {
    // -a: all listening/active sockets, -n: no DNS/service-name resolution, -o: include owning PID.
    const { stdout } = await execFileAsync("netstat", ["-ano"]);
    const pids = new Set();

    for (const rawLine of stdout.split("\n")) {
      const line = rawLine.trim();
      if (!line.startsWith("TCP") || !line.includes("LISTENING")) {
        continue;
      }

      const columns = line.split(/\s+/);
      const localAddress = columns[1] ?? "";
      const localPort = Number(localAddress.slice(localAddress.lastIndexOf(":") + 1));
      const pid = Number(columns[columns.length - 1]);

      if (localPort === port && Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    }

    return [...pids];
  } catch {
    return [];
  }
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
  if (isWindows) {
    return getProcessInfoWindows(pid);
  }

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

async function getProcessInfoWindows(pid) {
  try {
    // CIM/WMI is the only reliable built-in way to read another process's full
    // command line on Windows (tasklist truncates it); no /proc equivalent exists.
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
    ]);

    return { cwd: "", command: stdout.trim() };
  } catch {
    return { cwd: "", command: "" };
  }
}

function isWorkspaceProcess(processInfo) {
  return (
    processInfo.cwd.startsWith(workspaceRoot) ||
    processInfo.command.includes(workspaceRoot) ||
    processInfo.command.includes("classia-saas")
  );
}

async function stopProcess(pid, port) {
  if (isWindows) {
    await stopProcessWindows(pid, port);
    return;
  }

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

async function stopProcessWindows(pid, port) {
  // /T kills the whole process tree, not just this PID — a plain `taskkill /PID`
  // (or Node's process.kill) only ever stops the single process, which is exactly
  // how the old POSIX-only version of this script left watcher/child processes
  // (nest --watch, next dev's compiler workers) running as orphans on Windows.
  const killed = await execFileAsync("taskkill", ["/T", "/PID", String(pid)])
    .then(() => true)
    .catch(() => false);

  if (killed) {
    await wait(800);
  }

  if (await processExistsWindows(pid)) {
    await execFileAsync("taskkill", ["/F", "/T", "/PID", String(pid)]).catch(() => {});
    await wait(200);
  }

  console.log(`Stopped PID ${pid} (and its child processes) on port ${port}.`);
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

async function processExistsWindows(pid) {
  try {
    const { stdout } = await execFileAsync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV"]);
    return stdout.includes(`"${pid}"`);
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
