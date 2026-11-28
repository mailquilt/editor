// When each page under pages/ last changed, as Blume dates the docs pages: by
// the last commit that changed the page's own file.
import { execFileSync } from "node:child_process";
import path from "node:path";

const git = (args: string[], cwd: string) =>
  execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();

/** The site's folder in the repo, wherever the build runs from inside it. */
const SITE_IN_REPO = "apps/docs";

/**
 * The date of the last commit that changed the page served at `route`, such as
 * `/compare/unlayer`. Undefined outside a git checkout, in a shallow one, for a
 * file not yet committed, and for an address with no file of its own, as the not-found page
 * has in `blume dev`.
 */
export const pageLastModified = (route: string) => {
  const name = route.replace(/\/$/u, "") || "/index";
  const file = path.join(SITE_IN_REPO, "pages", `${name}.astro`);
  let root: string;
  try {
    root = git(["rev-parse", "--show-toplevel"], process.cwd());
  } catch {
    return;
  }
  // A shallow clone has one commit, which `git log` gives for every file.
  if (git(["rev-parse", "--is-shallow-repository"], root) === "true") {
    return;
  }
  return git(["log", "-1", "--format=%cI", "--", file], root) || undefined;
};
