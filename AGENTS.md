<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues at `mailquilt/editor`, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Tests

Before writing or changing tests, read `docs/agents/testing.md`.

### Skills

Which skills to install or write, and when: see `docs/agents/skills.md`.

### Reviews

Before reviewing code, or acting on a review, read `docs/agents/review.md`. It says which kind of review to run, the bar a finding must meet, and when to stop. Decisions already taken are in `docs/agents/decisions.md`. Don't raise them again unless something has changed since.

### Design and UI

Before designing or changing the editor's interface or the site, read `docs/agents/design.md`. It sets the quality bar, the process, the brand rules, and the checklist every UI change passes. Design with the `frontend-design` skill and polish interactions with the `emil-design-eng` skill. The logo kit is in `docs/brand/`.

Two gates apply to every ticket, `ready-for-agent` ones included:

- **Stop at mockups.** Any new screen, panel, toolbar, menu, dialog or site section is shown as rendered mockups (desktop and phone, light and dark, every state) and waits for the maintainer's pick before any code. Only copy, spacing and token changes inside an existing component skip this.
- **Done means checked.** UI is done only after the evidence `docs/agents/design.md` lists has been made and inspected, and a fresh design reviewer has worked through it. The pull request says what was checked and found. Make the evidence with the `editor-screens` skill.
