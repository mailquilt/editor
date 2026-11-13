# Mail Quilt: Project Brief

> **Status:** `0.1.0` is built: the four packages, the docs site and the Playground. It isn't released yet. The release waits on the steps in #18: tests with real email clients and by hand, an accessibility audit, making the repository public, and publishing the packages.
> **How to read this:** Section 21 defines what ships first. Sections 13–20 are non-binding ideas unless section 21 includes them, and only the items listed in section 21 may shape the `0.1.0` design. Terms are defined in `GLOSSARY.md`.

## 1. Summary

Mail Quilt is a set of free, open-source, MIT-licensed packages for building email design into any web app. The packages are the product, and a developer takes as many of them as they need:

- **The Shell:** a whole editor page, ready-made. They build nothing.
- **The editor:** the `<mail-quilt>` Web Component, with a wrapper for React, and Vue and Svelte wrappers to come. They build their own page around it.
- **The core and the renderer:** the email as data, the Commands that change it, and the HTML. The editor is built on them, and a developer can build on them too: an interface of their own, or none.

The editor is what most apps start with, and it is one part of Mail Quilt, not the whole of it.

Users can create the same email in three ways:

- **Drag and drop:** build visually with Blocks and detailed settings.
- **HTML:** write or edit the email's HTML directly.
- **AI:** generate and edit emails with prompts, using the user's own AI provider.

Coding tools such as Claude Code can also create and edit emails through a local mode and an MCP server.

**Positioning:** free, MIT-licensed packages for building email design into your app, in any framework: use the Shell, build your own page around the editor, or build on the document model underneath. Do not sell the editor as the whole product. Building a whole interface on `core` is possible, as the editor does it, but it is not documented or tested as a supported path yet, and the custom-block API is private until after `0.1.0`, so do not promise a kit for custom editors. Once they ship, AI features will use the same editing Commands as the UI. Do not claim AI features before they exist.

## 2. Goals

1. Embed in any supported framework through one consistent API.
2. Produce HTML that works reliably across major email clients. `0.1.0` is tested in Gmail and Apple Mail only; Outlook relies on MJML and is documented as untested.
3. Give full visual control without allowing layouts email clients cannot render.
4. Make AI edits validated, reviewable and undoable.
5. Work for developers through packages, a CLI, a local mode and MCP.
6. Let developers extend the builder without forking it.
7. Keep everything free and self-hostable.

## 3. Non-goals

- Sending infrastructure
- Contact or audience management
- Campaign analytics
- A/B testing
- Paid plans, gated features or a paid hosted tier
- A hosted real-time collaboration service
- Editing existing React Email templates in the builder
- Importing arbitrary React Email code

Mail Quilt should integrate with email providers rather than compete with them.

## 4. Audience

`0.1.0` is built for the first two groups. The others come later.

- **Developers** building email design into their product, with the editor or on the packages under it
- **Their end users**, such as marketers and founders, who design emails without code
- **Developers using coding tools** who want agents to build emails in their repo
- **Individuals** using the free Playground to design and export an email

## 5. Business and open-source model

- MIT license, with all features free
- Optional sponsorships only, such as GitHub Sponsors
- Public roadmap kept in GitHub Issues
- No dates on the roadmap, since this is a solo project
- The Playground must stay cheap to run, so it is a static page with no accounts or central database

## 6. Naming

| Item | Value |
|---|---|
| Product | Mail Quilt |
| Repository | `github.com/yourcodebuddy-in/mailquilt` |
| npm scope | `@mailquilt/*` |
| Custom element | `<mail-quilt>` |
| Docs | A static site served from its root, on a domain the maintainer chooses |

Still to confirm: that the `@mailquilt` org can be created on npm (`@mailquilt/core` and `mailquilt` currently return 404, which does not prove the org is free) and that the name has no trademark conflict.

## 7. Architecture

```text
Drag and drop ─┐
Keyboard ──────┤
AI ────────────┼─> Commands ──> Operations ──> "blocks" document ──> renderer ──> MJML ──> HTML
MCP / CLI ─────┘                                    │
                                                    ├──> email checker
                                                    └──> React Email export (.tsx)

HTML mode ─────────────────────> "html" document ───────────────────────> HTML
```

Keyboard, drag and drop, and the document path are part of `0.1.0`. AI, MCP, CLI, the checker, React Email export and HTML mode come later.

### Principles

- **The document is the source of truth.** Block-based emails are stored as JSON, not HTML.
- **All edits go through Commands.** A Command is a request that can be rejected. An accepted Command produces one or more Operations and counts as one undo step. Undo applies the reverse Operations.
- **Operations are a small fixed set:** insert, remove, move, set properties and set Column width. Move is its own Operation, so later collaboration does not treat it as a delete plus a new Block.
- **A null removes a property.** A Command that sets properties merges them like JSON Merge Patch, so Commands stay plain JSON. The schema decides whether that property can go.
- **There is one undo history.** ProseMirror's history isn't loaded. Typing in one Block merges into one undo step until the user pauses or leaves that Block.
- **The core is framework-free.** `core` and `renderer` must run without a browser DOM or UI framework.
- **The UI is written once.** The editor is a Web Component, and framework wrappers stay thin.
- **The renderer works on its own.** A server can render an email without loading any editor code.
- **MJML is internal to `renderer`.** It uses `mjml-browser` on servers and in browsers, which keeps the full `mjml` package and its dependencies out of every install. In a browser, MJML and the `cheerio` it needs are about 423 KB gzipped, so they load only for preview or export.
- **The canvas does not run MJML.** It is a fast Lit view. Preview shows the real exported HTML in a sandboxed iframe. Each Block uses one shared function to turn its properties into styles for both.
- **Block definitions are split by package.** See section 11. Their definitions drive the settings UI and validation, and later AI schemas and MCP tools.
- **Documents are versioned.** Every saved format has a version and a migration path.
- **Layouts are constrained.** The row → column → block structure prevents layouts email clients cannot render.

## 8. Technology stack

| Area | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript, strict mode |
| Editor UI | Lit Web Component (see ADR 0002) |
| Validation | Valibot, used internally. It also generates JSON Schema when AI and MCP need it |
| Drag and drop | The editor's own pointer events (see ADR 0002) |
| Rich text | ProseMirror (see ADR 0003) |
| HTML editor | CodeMirror (later) |
| Email output | MJML |
| Canvas isolation | Shadow DOM (see ADR 0002) |
| Preview | Sandboxed iframe showing the real exported HTML |
| Package builds | `tsdown` |
| Docs and Playground | Blume, with the landing page and the Playground as custom pages under `pages/`. The Playground holds a React island |
| Unit tests | Vitest |
| Browser tests | Playwright |
| Linting and formatting | Ultracite with Oxlint + Oxfmt |
| Versioning | Changesets |

Effect stays out of `core`, `renderer`, `editor` and the wrappers. Reconsider it only when `cli` or `mcp` work starts.

## 9. Repository structure

Packages are created only when their work starts. `0.1.0` needs `apps/docs`, `core`, `renderer`, `editor` and `react`.

```text
mailquilt/
├── apps/
│   └── docs/            # Docs site and the Playground page
├── packages/
│   ├── typescript-config/  # Shared tsconfig files
│   ├── core/            # Document types, Commands, Operations, history, migrations
│   ├── renderer/        # JSON -> MJML -> HTML
│   ├── editor/          # <mail-quilt> Web Component, plus a CDN build
│   ├── react/           # Thin wrapper
│   ├── vue/             # Thin wrapper (after 0.1.0)
│   ├── svelte/          # Thin wrapper (after 0.1.0)
│   ├── checker/         # Email checks (later)
│   ├── ai/              # Prompts, schemas, adapter types (later)
│   ├── react-email/     # One-way .tsx export (later)
│   ├── mcp/             # MCP server (later)
│   └── cli/             # CLI and local mode (later)
├── .changeset/
├── pnpm-workspace.yaml
└── turbo.json
```

### Dependency rules

- `core` has no DOM, UI framework or app dependencies.
- `renderer` depends on `core` and MJML.
- `checker` depends on `core`, and can inspect rendered HTML passed to it.
- `editor` depends on `core` and `renderer`, loading `renderer`'s MJML path only when needed. It depends on `checker` once that exists.
- Framework wrappers depend only on `editor`.
- `ai` depends on `core` and contains no API keys or required AI provider.
- `react-email` depends on `core`, so non-React users never install React.
- `mcp` and `cli` may depend on the headless packages.
- `packages/*` must never import from `apps/*`.
- Framework packages use peer dependencies.

## 10. Document model

The `0.1.0` format:

```ts
type BlocksDocument = {
  kind: "blocks";
  version: number;
  settings: EmailSettings;
  rows: Row[];
};

type EmailSettings = {
  width: number;
  backgroundColor: string;
  fontFamily: string;
  preheader?: string;
  language?: string;
};

type Row = {
  id: string;
  props: Record<string, unknown>;
  columns: Column[];
};

type Column = {
  id: string;
  width: number; // Percentage. A Row's Column widths add up to 100.
  props: Record<string, unknown>;
  blocks: Block[];
};

type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};
```

Migrations add these only when their features are built:

- `brand` and style tokens
- `rules` for display rules
- `mobile` overrides
- `HtmlDocument`. Section 13 keeps the block version when switching to HTML, which this type must allow for when HTML mode is designed.

### Document rules

- IDs are stable and unique, which supports later AI edits and collaboration.
- Saved documents contain a version. Older versions are migrated when loaded.
- `kind` is kept so HTML documents can be added later.
- A Row has 1–4 Columns, chosen from presets such as equal widths or ⅓ + ⅔. There is no drag-to-resize in `0.1.0`.
- Moving the last Block out of a Column leaves it empty. It stays until the user changes the layout.
- Text and Heading Blocks store limited ProseMirror JSON (see `docs/adr/0001-store-rich-text-as-limited-json.md`). A Heading also has a level from 1 to 3, and exports as one heading however many lines it has.
- Button Blocks store a plain-text label and a link, which may be a Merge Tag such as `{{cta_url}}`. Links in any Block are limited to `http:`, `https:`, `mailto:`, `tel:` and Merge Tags, so an executable scheme can't load or export.
- Image Blocks take a URL, which may be a Merge Tag such as `{{logo_url}}`, limited to `http:`, `https:` and Merge Tags. Until it has a URL, an Image shows a placeholder on the canvas and leaves nothing in the export. On the canvas, a URL with a Merge Tag also shows a placeholder, as there's nothing to load, and so does a URL that failed to load. An Image needs alt text before it can have a link, and keeps it for as long as it has one, because alt text is all that can name that link. Uploads come later through an adapter.
- `editor` and `renderer` refuse documents they cannot trust: malformed documents, unknown Block types, and versions newer than they support. They never repair or change them, so a host's auto-save cannot overwrite the original.
- Anything that loads must also export, so values follow what MJML accepts. Colors are written as `#rgb`, `#rrggbb`, `rgb()` or `rgba()`, the email width is a whole number of pixels, and a Column is at least 1% wide. A language set through a Command must be a code such as `en` or `pt-BR`. A saved one loads whatever it is, so that its email can still be opened and fixed, and the renderer escapes it.

## 11. Blocks and settings

### Layout

- Rows
- Columns

### Blocks

- Text and heading
- Image
- Button
- Divider and spacer
- Social links
- List and table
- Video thumbnail
- Header and footer
- Custom HTML

### Settings

- **Spacing:** padding and margin where email clients support them
- **Color:** text, background and border
- **Typography:** font, size, weight, line height and alignment
- **Borders:** width, style, color and radius
- **Backgrounds:** color and image, with fallbacks
- **Links:** URL, title and target
- **Images:** source, alt text, size and link
- **Mobile:** overrides, stacking and hiding
- **Email-wide:** width, default fonts and colors, brand styles and preheader

Settings are defined as data and rendered by one shared panel:

```ts
{ type: "color", key: "backgroundColor", label: "Background" }
```

### Block definition

A Block's definition is split by package, so a server can render an email without loading editor code:

| Package | Part of the definition |
|---|---|
| `core` | Type, label, defaults, schema, settings fields and document-level checks |
| `renderer` | Email output |
| `editor` | Canvas view |
| `react-email` (later) | Its own export mapping |

The custom-block API stays private until after `0.1.0`, because authors will have to register more than one piece and the shape needs time to settle.

## 12. Editor features

- Block palette, canvas and settings panel
- Drag to add, reorder and move between columns
- Undo/redo, with each user action as one step
- Copy, paste and duplicate
- Desktop, mobile and dark-mode preview
- Saved rows and templates
- Brand styles
- Merge tag picker, display rules and sample-data preview
- Email checker panel
- Read-only generated-code view
- Light and dark editor themes
- Translatable, white-label UI

### Accessibility

- Every drag-and-drop action has a keyboard alternative, using the same Commands as dragging. `0.1.0` uses Tab or arrow keys to select a Block, Alt+Arrow keys or toolbar buttons to move it, Enter on a palette item to insert it after the selected Block, and a screen reader announcement after each move.
- Controls have proper labels, focus states and screen reader announcements.
- The editor targets WCAG 2.2 AA.
- Exported emails use appropriate table roles, alt text, language attributes and readable contrast.

## 13. HTML mode

There are three levels of HTML access:

1. **View code:** read-only generated HTML.
2. **HTML block:** custom HTML inside a block-based email.
3. **Full HTML mode:** edit the entire email in CodeMirror with a live iframe preview.

### Switching rules

- **Blocks to HTML:** always works. Warn that the email leaves the visual editor. Keep the block version so the user can go back, while warning that going back discards HTML edits.
- **HTML to blocks:** best-effort import. Recognized content becomes blocks, and anything else becomes HTML blocks so nothing is lost.

Visual and hand-edited HTML are not kept in continuous two-way sync.

## 14. Brand styles, merge tags and display rules

### Brand styles

Blocks can reference shared colors, fonts and button styles. Changing one value updates every reference in the email. Renderers resolve references to direct values because email clients have limited CSS variable support.

### Merge tags and conditional content

- Inline tags such as `{{first_name}}`
- Show/hide rules on rows and blocks
- Repeating content such as product lists
- Sample data for preview
- Output for plain values, Handlebars and Liquid
- Merge tags stay intact through editing, AI changes and rendering

Conditional and repeating content must be stored as structured rules, not as template syntax mixed into content.

## 15. Email checker

The checker runs in the editor, CLI and MCP server.

| Category | Examples |
|---|---|
| Compatibility | CSS or HTML features unsupported by target clients |
| Size | HTML large enough for Gmail to clip |
| Accessibility | Missing alt text, low contrast, missing language, poor link text |
| Links | Empty, malformed or broken URLs |
| Content | Missing preheader or missing unsubscribe link |
| Merge tags | Unknown tags or missing fallback values |
| Custom | Rules added by custom blocks or developers |

Each result has a severity, explanation, affected block and suggested fix. Broken-link checks use a network request, so they should be optional. Compatibility data should come from a maintained source such as Can I email, subject to confirming its license.

## 16. AI builder

### Features

- Generate a full email from a prompt
- Edit through chat, such as "make the header darker"
- Rewrite, shorten or translate text
- Convert HTML into blocks

### Design

- AI returns structured documents or commands, not raw HTML for block-based emails.
- Schemas are generated from Block definitions, so custom Blocks work automatically.
- Every response is validated, then retried or shown as an error if invalid.
- Changes appear as a preview to accept or reject.
- Each accepted AI change is one undo step.
- AI must preserve merge tags.
- AI must not invent image URLs and should use placeholders or the user's image library.
- Any generated HTML is sanitized.

### Provider model

There is no default paid AI service. The editor accepts a small adapter:

```ts
editor.ai = {
  stream: (request) => fetch("/api/ai", { /* ... */ }),
};
```

| Where it runs | How keys work |
|---|---|
| Embedded in a developer's app | Stored on the developer's server |
| Local mode | Stored in the user's local environment |
| Playground | Supplied by the user, never stored by Mail Quilt |

The Playground must not log user keys or prompts.

**Open question:** how Playground AI requests reach providers. The Playground is a static page, so it cannot run a proxy itself. Any proxy must be hosted separately and be stateless. Decide this when the AI builder is designed.

## 17. Developer tools and local mode

### MCP server

The MCP server exposes the headless engine to AI agents. `@mailquilt/mcp` runs on its own, so it does not need the CLI. It starts with the first five tools below, and the others arrive with the features they need:

| Tool | Purpose | Available |
|---|---|---|
| `list_block_types` | Lists Blocks and their schemas | First version |
| `create_email` | Creates an email document | First version |
| `read_email` | Reads a document | First version |
| `apply_commands` | Applies validated Commands | First version |
| `render_html` | Returns the final HTML | First version |
| `check_email` | Runs the email checker | With the checker |
| `import_html` | Converts HTML into a document | With HTML import |
| `export_react_email` | Exports a `.tsx` template | With React Email export |
| `get_preview_url` | Returns the local preview URL | With local mode |

### CLI

```bash
mailquilt dev
mailquilt render email.json
mailquilt check email.json
mailquilt export email.json --format react-email
mailquilt mcp # Starts the same server as @mailquilt/mcp
```

### Local mode

Local mode lets someone clone the repo or run the CLI, open the full editor, and connect a coding tool such as Claude Code or another MCP-compatible tool.

```text
Coding tool ──> MCP server ──> commands ──> ./emails/welcome.json
                                                  │
                         local editor and preview ┘
```

- Emails are JSON files, so they work with Git and code review.
- Agent edits appear live in the local editor.
- Edits made in the editor save back to the files.
- Rendered HTML can be generated into the project.
- No account or hosted service is required.
- Provider keys come from the local environment.

Local mode security:

- Bind to `localhost` by default.
- Check request origins.
- Restrict file access to the chosen project folder.
- Treat HTML and email content as untrusted.

## 18. Public API

### Plain JavaScript

With a bundler, import `"@mailquilt/editor"`. Without one, such as in Rails, Laravel or plain HTML, load the ready-to-use CDN build, because a browser cannot resolve that bare import on its own:

```html
<mail-quilt id="builder"></mail-quilt>
<script type="module">
  // The full path to the CDN build of @mailquilt/editor.
  import "https://cdn.example/@mailquilt/editor@0.1.0/dist/cdn/index.js";

  const builder = document.querySelector("#builder");
  builder.value = savedDocument;
  builder.addEventListener("mq-change", (event) => {
    save(event.detail.document);
  });
  builder.addEventListener("mq-error", (event) => {
    showLoadError(event.detail.reason);
  });

  const html = await builder.exportHtml();
</script>
```

- **`value`** sets the document. If its content matches the last document the editor received or sent out, it is ignored, even if the host cloned it or its keys came back in another order. Any other document loads and clears undo history, and setting `undefined` empties the editor. Without this rule, a host that passes each change straight back would wipe undo and lose the cursor on every edit.
- **Only pass back the latest document.** An earlier one counts as different and loads. A host that saves each change to a server should not set `value` from each response, because a late response would replace newer typing and clear undo.
- **`mq-change`** fires after each committed change and carries the new document. The prefix avoids confusion with native `change` events from inputs.
- **`mq-error`** fires when a document is refused, and nothing is changed. `event.detail.reason` says why. It fires just after the code that set `value` finishes, so a listener added straight after setting `value` still hears it. A listener added later, such as in a React `useEffect`, misses a refused first document, so add it before setting `value` or use a ref callback.
- **`exportHtml()`** returns the final HTML and loads MJML only when called.

The CDN build must also load MJML only when needed.

### React

```tsx
<MailQuilt value={document} onChange={setDocument} onError={showLoadError} />
```

Vue and Svelte wrappers expose the same concepts in their own conventions. They ship after `0.1.0`, with very thin code and browser tests in real Vue and Svelte apps as the main proof they work. Solid and Angular get no wrappers but can use `<mail-quilt>` directly.

### Headless

```ts
import { createEditor } from "@mailquilt/core";
import { renderEmail } from "@mailquilt/renderer";

const editor = createEditor({ document });
editor.apply({ type: "updateBlockProps", blockId: "abc", props: { alt: "Company logo" } });
const html = await renderEmail(editor.getDocument());
```

### Extension points

- Custom blocks and settings fields
- Custom checker rules
- Image upload and media library adapters
- AI adapter
- Merge tag provider
- Sending integration adapter
- UI theme tokens and translations
- White-labeling, with no required Mail Quilt branding

### Server-side rendering

Only register the custom element in the browser. Framework wrappers should make this safe for Next.js, SvelteKit, TanStack Start and similar tools.

The custom-block extension point stays private until after `0.1.0`.

## 19. Real-time collaboration support

Mail Quilt will not host collaboration, but it gives developers what they need to build it:

- A stream of serializable operations
- A way to apply remote operations without adding them to local undo history
- Stable IDs for rows, columns and blocks
- Presence hooks for cursors and selected blocks
- A rich text integration point for ProseMirror collaboration, such as `y-prosemirror`
- A documented example, likely using Yjs

Possible shape:

```ts
editor.subscribe((operation) => transport.send(operation));
transport.onMessage((operation) => editor.applyRemote(operation));
editor.setPresence(user.id, { selectedBlockId: "abc" });
```

Conflict handling and the transport layer belong to the developer or their chosen library. The core design should be tested against this use case before the API is called stable.

## 20. Output and integrations

- **HTML:** primary output, generated through MJML.
- **MJML:** optional export and import.
- **JSON:** the saved document format.
- **React Email:** one-way `.tsx` export from block-based emails. MJML output remains the reference, and the two outputs will not be pixel-identical. Generated files are not imported back.
- **Sending integrations:** push templates to services such as Resend, SES and Mailchimp through user-supplied credentials.
- **Translations:** multiple language versions of one email, reusing the same layout.

## 21. Docs, Playground and first release

### Docs and Playground (`apps/docs`)

There is one app, built with Blume as a static site served from its root, with no base path. It doesn't depend on any one host.

`0.1.0` docs:

- Quick start
- Document format reference
- Tested email clients, stating plainly that Outlook is untested
- The Playground

The Playground is one page where anyone can try the editor. It is also the development page, and it uses `@mailquilt/react`, so it tests the wrapper too. Emails are saved in the browser, with JSON import/export and HTML export. There is one Playground, not one per framework.

Plain JS and React install checks stay as test projects, not apps.

### First release: `0.1.0`

There is no alpha phase. `0.x` signals that the API may change.

Included:

- `core`, `renderer`, `editor` (including a CDN build), `react`
- Text, heading, image (by URL), button, divider and spacer Blocks
- Multi-column Rows, with 1–4 Columns chosen from presets
- Basic settings, drag and drop, the keyboard alternative, undo/redo
- Typed Merge Tags kept intact through editing and rendering, with no tag picker
- JSON save and load
- Preview showing the real exported HTML in a sandboxed iframe
- HTML export tested in Gmail and Apple Mail, with Outlook relying on MJML and documented as untested
- Working installs in fresh plain JS and React projects
- An editor and Playground redesign in the style of established embedded email builders, with UI theme tokens a host can override (#33)
- The Shell: a ready-made editor page, with Import, Export and messages (#34)
- Docs and the Playground

Before release:

- Make the repository public, because this is an open-source project with a public roadmap in GitHub Issues.
- Complete the npm org and trademark checks in section 6.

Only these may shape the `0.1.0` architecture beyond its own features: serializable Operations, stable IDs, versioned documents, a keyboard path for every drag action, and Merge Tags in text. Migrations add everything else when it is built.

## 22. Roadmap

No dates. Items can be reordered. The roadmap itself lives in GitHub Issues.

### Now

1. One Text Block through `core`, `renderer`, `editor` and the Playground.
2. The other Blocks, columns, the React wrapper and the docs.
3. The editor and Playground redesign, and the Shell.
4. The `0.1.0` release.

### Next

1. Vue and Svelte wrappers
2. More Blocks and settings
3. MCP server, standalone and with its first five tools
4. AI builder

### Later

- CLI and local mode
- Copy, paste and duplicate
- Read-only generated-code view
- Light and dark editor themes
- Brand styles, the Merge Tag picker and display rules
- Email checker
- Mobile and dark-mode previews
- HTML mode
- React Email export
- Saved rows and MJML/HTML import
- Sending integrations
- Translated emails
- Collaboration primitives and example

## 23. Development workflow

### Setup

```bash
pnpm dlx ultracite init --linter oxlint --frameworks vitest \
  --workspace-framework apps/docs=react packages/react=react
```

Vue and Svelte are added per package when they exist. The presets are not applied across the whole repo because framework rules can conflict.

### Git

- Use short-lived branches and pull requests for every change. Don't commit directly to `main`.
- Use messages such as `feat(core): add moveBlock command` and `fix(editor): keep selection after undo`.

### Versioning and release

All publishable packages share one version through Changesets.

```bash
pnpm changeset
pnpm changeset version
git add . && git commit -m "chore: release"
pnpm build
pnpm changeset publish
git push --follow-tags
```

- **Patch:** bug fixes.
- **Minor:** new features or breaking changes while on `0.x`.
- **`1.0.0`:** when the API is proven by real users.
- Before publishing, install the `pnpm pack` output in a fresh project.
- Fix bad releases by publishing a new version and deprecating the bad one if needed.
- Automate releases and add `pkg.pr.new` previews once there are users.

### Agent skills

Skills are only for areas where they change how an agent works, not for every package. They are installed per project, in `.agents/skills/`, with links in `.claude/skills/`. Install or write each later skill when its work starts, and check that it still exists first.

Planning and build flow: `grill-with-docs` → `to-spec` → `to-tickets` → `implement` for each ticket.

**Install later** with `npx skills add <skill> -y`

| When | Skill | Purpose |
|---|---|---|
| Installing Ultracite | `haydenbleasel/ultracite@ultracite` | Linting and formatting setup and rules |
| Building the MCP server | `anthropics/skills@mcp-builder` | Designing the MCP server and its tools |
| Building the React Email export | `resend/react-email@react-email` | Generating `.tsx` that uses real React Email components |
| Building the collaboration primitives | `liveblocks/skills@yjs-best-practices` | The Yjs collaboration example and testing the operation model against it |

**Write later**

| When | Skill | Purpose |
|---|---|---|
| The first Block works | `add-block` | The full Block definition checklist across packages, including schema, settings, rendering, checks and tests |
| The first commands work | `add-command` | Validation, one undo step per action, serializable operations and remote application |
| The first document format change | `doc-migration` | Version bumps, migration paths and fixture tests |
| The first real email client tests | `email-compat-check` | Target clients, Gmail clipping limits and comparing the canvas with exported HTML |

## 24. Quality and testing

- **Vitest:** commands, undo/redo, migrations, renderer, checker and exporters.
- **Playwright:** drag and drop, undo, settings, export, keyboard use and each framework wrapper.
- **Visual tests:** rendered output snapshots.
- **Email client testing:** real emails sent to Gmail and Apple Mail for `0.1.0`. Outlook is not tested, and the docs say so. Other clients and paid services such as Litmus can come later.
- **Package tests:** install and run built packages in fresh projects.
- **AI tests:** a fixed prompt set checked for schema validity and preserved merge tags.
- **Accessibility tests:** automated checks plus manual keyboard and screen reader testing.
- **Input method tests:** type Japanese by hand in real Safari, Firefox and Chrome before `0.1.0`, because automated tests can only simulate this in Chromium.
- **Drag edge cases:** test touch and auto-scrolling before `0.1.0`.

## 25. Security

- Treat pasted content, imported HTML, image URLs, merge values and AI output as untrusted.
- Sanitize HTML and escape merge values appropriately.
- Run previews in a sandboxed iframe.
- Never store or log user provider keys in the Playground.
- Follow the local mode rules in section 17.
- Validate commands from AI, MCP and collaboration sources the same way as UI commands.

## 26. Known risks

| Risk | Plan |
|---|---|
| Drag and drop or rich text misbehaves in Shadow DOM | A throwaway test passed (ADR 0002). Dragging uses the editor's own pointer events. If text editing fails in a later case, try an iframe canvas before light DOM |
| The maintainer knows React but not Lit, Vue or Svelte | Keep Lit limited to rendering and state, with logic in plain TypeScript. Keep Vue and Svelte wrappers thin and covered by browser tests |
| The vision is too large for a solo project | Ship a small `0.1.0` and keep each release usable |
| Canvas and exported HTML differ | Provide a real preview and test against rendered output |
| Outlook and other client quirks | Rely on MJML, test Gmail and Apple Mail early, and document Outlook as untested |
| MJML adds bundle size in the browser | Load it only for preview or export |
| Early API changes hurt users | Use `0.x`, versioned documents and clear changelogs |
| AI generates invalid or poor emails | Use schemas, validation, previews and evaluation prompts |
| Maintenance load grows | Keep wrappers thin and use Block definitions to avoid duplicated UI |

## 27. Unverified assumptions

- Japanese and other IME input works inside Shadow DOM in real Safari and Firefox. It has only been simulated in Chromium.
- Drag and drop works with touch inside Shadow DOM.
- MJML's output meets the project's needs in real email clients, and `mjml-browser` handles Merge Tags as `mjml` did in testing.
- Blume hosts the editor well inside this monorepo, including on a real deploy and across page navigation.
- `tsdown` builds correctly with the repo's TypeScript 7.
- Can I email data can be used under its license.
- Sending provider APIs support the planned template integrations.
- The operation model can support Yjs-based collaboration without major changes.
