// Prepares the fresh projects in this run's own folder, runs the checks there
// on ports of its own, and removes the folder. Arguments go to `playwright test`.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

import {
  freshProjectDir,
  freshProjectsDir,
  portsVariable,
  projectNames,
} from "./fresh-projects.ts";
import type { Ports } from "./ports.ts";

/** The CDN build's URL in the quick start, served from this machine instead. */
const cdnBuildUrl =
  /https:\/\/cdn\.jsdelivr\.net\/npm\/@mailquilt\/editor@[^/]+\//gu;

/** Ports nothing else is using now, each different. */
const freePorts = async (count: number) => {
  const servers = Array.from({ length: count }, () => createServer().listen(0));
  await Promise.all(servers.map((server) => once(server, "listening")));
  const ports = servers.map((server) => (server.address() as AddressInfo).port);
  await Promise.all(
    servers.map((server) => {
      server.close();
      return once(server, "close");
    })
  );
  return ports;
};

/** Points the CDN quick start at the CDN build this run serves. */
const serveCdnBuildAt = (port: number) => {
  const page = path.join(freshProjectDir("cdn"), "index.html");
  const html = readFileSync(page, "utf-8");
  const localHtml = html.replaceAll(cdnBuildUrl, `http://localhost:${port}/`);
  // Otherwise the check would pass without loading what the quick start shows.
  if (localHtml === html) {
    throw new Error(`The CDN quick start doesn't load ${cdnBuildUrl}`);
  }
  writeFileSync(page, localHtml);
};

let running: ChildProcess | undefined;
let interrupted = false;

// Each command runs in a session of its own, so a signal sent only to this
// process, as CI sends one, reaches it and every command it started. Ctrl+C
// and closing the terminal reach only this process too, so each is sent once.
const stop = () => {
  interrupted = true;
  if (running?.pid === undefined) {
    return;
  }
  try {
    // As Ctrl+C does. Playwright stops its web servers for SIGINT, and leaves
    // them running for SIGTERM.
    process.kill(-running.pid, "SIGINT");
  } catch {
    // It had already exited, and `run` hasn't heard yet.
  }
};
for (const signal of ["SIGHUP", "SIGINT", "SIGTERM"] as const) {
  process.on(signal, stop);
}

/** Whether any process the command started is still running. */
const groupRuns = (pid: number) => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Runs a command until it exits, and gives its exit code, or 1 if it was stopped. */
const run = async (command: string, args: string[]) => {
  if (interrupted) {
    return 1;
  }
  const child = spawn(command, args, { detached: true, stdio: "inherit" });
  running = child;
  const [code] = await once(child, "exit");
  if (interrupted) {
    // Once stopped, the processes it started can still be using the folder.
    while (child.pid !== undefined && groupRuns(child.pid)) {
      // oxlint-disable-next-line no-await-in-loop -- Waits for the last of them.
      await setTimeout(100);
    }
  }
  running = undefined;
  return interrupted ? 1 : (code ?? 1);
};

try {
  process.exitCode = await run(process.execPath, [
    path.join(import.meta.dirname, "prepare.ts"),
  ]);
  if (process.exitCode === 0) {
    // Picked once the projects are built, just before the servers start, so
    // another run can't be given the same ports in between.
    const [cdnPort = 0, ...ports] = await freePorts(projectNames.length + 1);
    const picked: Ports = {
      cdnPort,
      freshProjects: Object.fromEntries(
        projectNames.map((name, index) => [name, { port: ports[index] }])
      ) as Ports["freshProjects"],
    };
    process.env[portsVariable] = JSON.stringify(picked);
    serveCdnBuildAt(cdnPort);

    process.exitCode = await run("playwright", [
      "test",
      ...process.argv.slice(2),
    ]);
  }
} finally {
  rmSync(freshProjectsDir, { force: true, recursive: true });
}
