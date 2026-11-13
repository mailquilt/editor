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
