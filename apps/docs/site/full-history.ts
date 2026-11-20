// Run before the build. Each page's date comes from the last commit that
// changed its file, so a host that checks out only the last commit would leave
// every page undated. This fetches the rest of the history first. Outside a
// git checkout, or without a network, the build goes on without it.
import { execFileSync } from "node:child_process";

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf-8", stdio: "pipe" }).trim();

try {
  if (git("rev-parse", "--is-shallow-repository") === "true") {
    git("fetch", "--unshallow", "--quiet");
  }
} catch {
  // Dated pages are worth having, but not worth failing the build for.
}
