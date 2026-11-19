// Prepares the fresh projects in this run's own folder, runs the checks there
// on ports of its own, and removes the folder. Arguments go to `playwright test`.
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import path from "node:path";

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

// Ctrl+C stops the child it reaches, and this process removes the folder.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    process.exitCode = 1;
  });
}

try {
  await import("./prepare.ts");
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

  const { error, status } = spawnSync(
    "playwright",
    ["test", ...process.argv.slice(2)],
    { stdio: "inherit" }
  );
  if (error) {
    throw error;
  }
  process.exitCode = status ?? 1;
} finally {
  rmSync(freshProjectsDir, { force: true, recursive: true });
}
