# Agent skills

Skills are only for areas where they change how an agent works, not for every package. They're installed per project, in `.agents/skills/`, with links in `.claude/skills/`. Install or write each skill below when its work starts, and check first that it still exists.

The planning and build flow is `grill-with-docs` → `to-spec` → `to-tickets` → `implement` for each ticket.

## To install later

Install with `npx skills add <skill> -y`.

| When | Skill | For |
|---|---|---|
| Building the MCP server | `anthropics/skills@mcp-builder` | Designing the MCP server and its tools |
| Building the React Email export | `resend/react-email@react-email` | Generating `.tsx` that uses real React Email components |
| Building the collaboration support | `liveblocks/skills@yjs-best-practices` | The Yjs example, and testing the Operation model against it |

## To write later

| When | Skill | For |
|---|---|---|
| Adding the next Block | `add-block` | The whole Block definition across packages: schema, settings, rendering, checks and tests |
| Adding the next Command | `add-command` | Validation, one undo step per action, serializable Operations and applying remote ones |
| The first change to the document format | `doc-migration` | Version bumps, migrations and fixture tests |
| Setting up email client tests | `email-compat-check` | Target clients, Gmail's clipping limit, and comparing the canvas with the exported HTML |

## Mail Quilt's own skill

`skills/mail-quilt/` is the skill people install to use Mail Quilt in their own apps: `npx skills add mailquilt/editor --skill mail-quilt`. The docs site publishes it too, through `agents.skills` in `apps/docs/blume.config.ts`, at `/skill.md` and `/.well-known/agent-skills/`.

It holds what the docs don't: which package to pick, the order of work and the mistakes to avoid. Facts stay in the docs, and the skill links to them. Update it in the same PR when a change:

- renames or moves a docs page it links to
- changes the API it names, such as `value`, `mq-error`, `save-key` or a theme token
- fixes or adds a mistake people make, such as a new pairing of theme tokens

Test a change by giving an agent a real task with and without the skill, as in #87, and check the code it writes.
