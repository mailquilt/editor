// Run by `pnpm release` before it builds. A release is published from a clean
// tree at a commit on main, which is what CI has checked.
import { execFileSync, spawnSync } from "node:child_process";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf-8" }).trim();

const refusal = () => {
  if (git("status", "--porcelain") !== "") {
    return "the tree has changes. Commit or remove them first.";
  }
  git("fetch", "--quiet", "origin", "main");
  const onMain =
    spawnSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"])
      .status === 0;
  return onMain
    ? undefined
    : "this commit isn't on main. Pull main and release from there.";
};

const reason = refusal();
if (reason) {
  console.error(`Not releasing: ${reason}`);
  process.exitCode = 1;
}
