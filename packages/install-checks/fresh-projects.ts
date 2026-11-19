import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

export const projectNames = [
  "cdn",
  "nextjs",
  "plain-js",
  "react-vite",
] as const;
type ProjectName = (typeof projectNames)[number];

interface Run {
  cdnPort: number;
  dir: string;
  ports: Record<ProjectName, number>;
}

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

const pickRun = async (): Promise<Run> => {
  const [cdnPort = 0, ...ports] = await freePorts(projectNames.length + 1);
  return {
    cdnPort,
    // Outside the repo, so pnpm can't find its workspace from a fresh project.
    dir: path.join(tmpdir(), `mailquilt-install-checks-${randomUUID()}`),
    ports: Object.fromEntries(
      projectNames.map((name, index) => [name, ports[index]])
    ) as Record<ProjectName, number>,
  };
};

// Each run has its own folder and ports, so two checkouts can run the checks
// at once. `run.ts` picks them, and Playwright and its workers inherit them.
const variable = "MAILQUILT_INSTALL_CHECKS";
process.env[variable] ??= JSON.stringify(await pickRun());
const run: Run = JSON.parse(process.env[variable]);

export const freshProjectsDir = run.dir;

export const freshProjects = Object.fromEntries(
  projectNames.map((name) => [name, { port: run.ports[name] }])
) as Record<ProjectName, { port: number }>;

/** Serves `@mailquilt/editor` as a CDN would. */
export const { cdnPort } = run;

export const freshProjectDir = (name: ProjectName) =>
  path.join(freshProjectsDir, name);
