import { portsVariable } from "./fresh-projects.ts";
import type { ProjectName } from "./fresh-projects.ts";

export interface Ports {
  /** Serves `@mailquilt/editor` as a CDN would. */
  cdnPort: number;
  freshProjects: Record<ProjectName, { port: number }>;
}

const picked = process.env[portsVariable];
if (!picked) {
  throw new Error(
    "Run the install checks with `pnpm test`, which prepares the fresh projects first."
  );
}

export const { cdnPort, freshProjects }: Ports = JSON.parse(picked);
