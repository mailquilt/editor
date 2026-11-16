# Mail Quilt: design and roadmap

This document explains what Mail Quilt is for, how it's designed, and where it's going. It's for anyone who wants to understand the project or contribute to it.

- To use the packages, read the [docs](apps/docs/docs).
- Words such as Block, Row, Command and Merge Tag are defined in [`GLOSSARY.md`](GLOSSARY.md).
- The main design decisions, and why they were made, are in [`docs/adr/`](docs/adr).
- Plans and progress are tracked in [GitHub Issues](https://github.com/mailquilt/editor/issues).

**Status:** `0.1.0` is the first release. While Mail Quilt is on `0.x`, the API can still change between minor versions. Sections marked _planned_ describe intended designs, not promises, and can change before they're built.

## Contents

1. [What Mail Quilt is](#1-what-mail-quilt-is)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [How it works](#3-how-it-works)
4. [The document](#4-the-document)
5. [Blocks and settings](#5-blocks-and-settings)
6. [Public API](#6-public-api)
7. [Packages](#7-packages)
8. [What `0.1.0` includes](#8-what-010-includes)
9. [Roadmap](#9-roadmap)
10. [Planned features](#10-planned-features)
11. [Quality and testing](#11-quality-and-testing)
12. [Security](#12-security)
13. [Risks and open questions](#13-risks-and-open-questions)
14. [Versioning and releases](#14-versioning-and-releases)
15. [Open source model](#15-open-source-model)

## 1. What Mail Quilt is

Mail Quilt is a set of free, MIT-licensed packages for building email design into any web app. Each app takes as much of it as it needs:

| If you want… | Use |
|---|---|
| A whole editor page, ready-made | The Shell, `<mail-quilt-shell>` |
| An editor inside a page of your own | The editor, `<mail-quilt>`, or its React component |
| The email as data, and the HTML for it | `@mailquilt/core` and `@mailquilt/renderer` |

The editor is a Web Component, so it works in any framework or none. A React wrapper ships today, and Vue and Svelte wrappers are planned. The editor is built on `core` and `renderer`, and an app can build on them too, for example to change emails on a server.

In `0.1.0`, people build emails by dragging Blocks into Rows and Columns, or with the keyboard. Planned are editing the HTML directly, an AI builder that uses your own AI provider, and an MCP server so coding tools can create and edit emails.

### Who it's for

- **Developers** building email design into their product.
- **Their users**, such as marketers and founders, who design emails without code.
- Later, **developers using coding tools** who want agents to build emails in their repo, and **anyone** who wants to design and export an email in the free Playground.

## 2. Goals and non-goals

### Goals

1. Embed in any framework through one consistent API.
2. Produce HTML that works in the major email clients. `0.1.0` is checked in Gmail, Apple Mail, Outlook, Yahoo and others through Email on Acid, and the docs list the limits found.
3. Give full visual control, without allowing layouts that email clients can't render.
4. Make AI edits validated, reviewable and undoable.
5. Work for developers through packages, a CLI, a local mode and MCP.
6. Let developers extend the editor without forking it.
7. Keep everything free and self-hostable.

### Non-goals

The editor designs emails. It works alongside whatever sends them, so it doesn't do the following. Sending and lists belong in a separate Mail Quilt project, with its own repository.

- Sending, contact lists or audiences
- Campaign analytics or A/B testing
- Paid plans, gated features or a paid hosted tier
- A hosted real-time collaboration service
- Editing or importing React Email code

## 3. How it works

```text
Drag and drop ─┐
Keyboard ──────┤
AI ────────────┼─> Commands ──> Operations ──> "blocks" document ──> renderer ──> MJML ──> HTML
MCP / CLI ─────┘                                    │
                                                    ├──> email checker
                                                    └──> React Email export (.tsx)

HTML mode ─────────────────────> "html" document ───────────────────────> HTML
```

`0.1.0` has drag and drop, the keyboard and the path from Commands to HTML. AI, MCP, the CLI, the email checker, React Email export and HTML mode are planned.

### Design principles

- **The document is the source of truth.** An email is stored as JSON, not HTML. The HTML is generated from it.
- **Every edit is a Command.** A Command is a request that can be refused. An accepted one produces Operations and is one undo step. Undo applies the reverse Operations.
- **Operations are a small, fixed set:** insert, remove, move, set properties and set a Column's width. Moving is its own Operation, so collaboration can later tell a move from a delete and a new Block.
- **Commands are plain JSON.** Setting properties merges their top-level keys, so a nested value is replaced whole, and `null` removes one where the schema allows it.
- **There's one undo history.** Typing in a Block merges into one undo step until the user pauses or leaves it.
- **`core` and `renderer` need no browser.** They run on a server without a DOM or a UI framework, and a server can render an email without loading any editor code.
- **The interface is written once.** The editor is a Web Component, and each framework wrapper stays thin.
- **MJML stays inside `renderer`.** It uses `mjml-browser` on servers and in browsers alike. In a browser, MJML is about 423 KB gzipped, so the editor loads it only for Preview and export.
- **The canvas doesn't run MJML.** It's a fast Lit view, while Preview shows the real exported HTML in a sandboxed iframe. Both get each Block's styles from one shared function.
- **Documents are versioned.** Every saved format has a version, and older versions are migrated as they load.
- **Layouts are constrained.** Rows, Columns and Blocks only allow layouts that email clients can render.

## 4. The document

An email is a `BlocksDocument`:

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
  width: number; // A percentage. A Row's Column widths add up to 100.
  props: Record<string, unknown>;
  blocks: Block[];
};

type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};
```

The [document format reference](apps/docs/docs/document-format.mdx) lists every Block's props.

### Rules

- **IDs are stable and unique,** which later AI edits and collaboration rely on.
- **`kind` leaves room for HTML documents,** which HTML mode will add.
- **A Row has 1 to 4 Columns,** chosen from preset layouts such as equal widths or ⅓ + ⅔. Columns can't be resized by dragging.
- **A Column can be empty.** Moving its last Block out leaves it in place until the Row's layout changes.
- **Text and Heading Blocks store limited ProseMirror JSON** ([ADR 0001](docs/adr/0001-store-rich-text-as-limited-json.md)). A Heading has a level from 1 to 3, and exports as one heading however many lines it has.
- **Links are limited** to `http:`, `https:`, `mailto:`, `tel:` and Merge Tags such as `{{cta_url}}`, so a link can't run code. Image URLs are limited to `http:`, `https:` and Merge Tags.
- **An Image without a URL** shows a placeholder on the canvas and is left out of the export. An Image needs alt text before it can have a link, because alt text is all that can name that link.
- **Documents that can't be trusted are refused, never repaired:** malformed ones, unknown Block types and versions newer than the package supports. Nothing changes them, so a host's auto-save can't overwrite the original.
- **Whatever loads also exports,** so values follow what MJML accepts. Colors are `#rgb`, `#rrggbb`, `rgb()` or `rgba()`, the email width is a whole number of pixels up to 1200, and a Column is at least 1% wide. A language set by a Command must be a code such as `en` or `pt-BR`. A saved one loads whatever it is, so the email can still be opened and fixed, and the renderer escapes it.

### Planned additions

Later versions add these through migrations, as their features are built: brand styles, display rules, mobile overrides and HTML documents.

## 5. Blocks and settings

| | `0.1.0` | Planned |
|---|---|---|
| **Layout** | Rows, and Columns from preset layouts | — |
| **Blocks** | Text, Heading, Image (by URL), Button, Divider, Spacer | Social links, lists and tables, video thumbnails, headers and footers, custom HTML |
| **Settings** | Alignment, colors, font size, sizes, links and alt text. Email width, background, font, preheader and language. Row background | Spacing, borders, background images, typography in full, mobile overrides, brand styles |

Settings are defined as data and drawn by one shared panel:

```ts
{ type: "color", key: "backgroundColor", label: "Background color" }
```

### How a Block is defined

A Block's definition is split across packages, so a server can render an email without loading editor code:

| Package | Part of the definition |
|---|---|
| `core` | Type, label, defaults, schema, settings fields and checks |
| `renderer` | Email output |
| `editor` | Canvas view |

Because a custom Block needs a piece in each package, the API for custom Blocks stays private until its shape has settled.

## 6. Public API

The [quick start](apps/docs/docs/quick-start.mdx) has complete examples. In short:

### The `<mail-quilt>` element

With a bundler, import `@mailquilt/editor`. Without one, such as in Rails, Laravel or plain HTML, load the CDN build by its full path:

```html
<mail-quilt id="builder"></mail-quilt>
<script type="module">
  import "https://cdn.jsdelivr.net/npm/@mailquilt/editor@0.1.0/dist/cdn/index.js";

  const builder = document.querySelector("#builder");
  builder.addEventListener("mq-change", (event) => save(event.detail.document));
  builder.addEventListener("mq-error", (event) => showError(event.detail.reason));
  builder.value = savedDocument;

  const html = await builder.exportHtml();
</script>
```

- **`value`** sets the email. A document with the same content as the last one the editor received or sent is ignored, even if it was cloned or its keys were reordered. So a host can pass each change straight back without wiping undo or losing the cursor. Any other document loads and clears undo, and `undefined` or `null` empties the editor.
- **Only pass back the latest document.** An earlier one counts as different, and loads. A host that saves to a server shouldn't set `value` from each response, because a late response would replace newer typing.
- **`mq-change`** fires after each change, with the new document. The `mq-` prefix keeps it apart from the native `change` event of inputs.
- **`mq-error`** fires when a document is refused, and nothing changes. `event.detail.reason` says why. It fires just after the code that set `value` finishes, so add the listener before setting `value`.
- **`exportHtml()`** returns the email's HTML, and loads MJML the first time it's called.

### The Shell

`<mail-quilt-shell>` is a ready-made editor page: the editor with a header, Import and Export, and messages. It takes the same `value`, events and `exportHtml()` as `<mail-quilt>`, plus `heading`, `actions` to choose its buttons, and `save-key` to keep the email in the browser. React has it as `MailQuiltShell`. The [Shell page](apps/docs/docs/shell.mdx) has the details.

### React

```tsx
<MailQuilt value={document} onChange={setDocument} onError={showError} />
```

The custom element is only registered in the browser, so the components are safe in server-rendered apps such as Next.js. Vue and Svelte wrappers are planned, with the same ideas in each framework's conventions. Other frameworks, such as Solid and Angular, can use `<mail-quilt>` directly.

### Without the editor

```ts
import { createEditor } from "@mailquilt/core";
import { renderEmail } from "@mailquilt/renderer";

const editor = createEditor({ document });
editor.apply({ type: "updateBlockProps", blockId: "abc", props: { alt: "Company logo" } });
const html = await renderEmail(editor.getDocument());
```

## 7. Packages

```text
mailquilt/
├── apps/
│   └── docs/                # The website: landing page, docs and Playground
└── packages/
    ├── core/                # The document, Commands, Operations, undo and migrations
    ├── renderer/            # Document → MJML → HTML
    ├── editor/              # <mail-quilt> and <mail-quilt-shell>, plus a CDN build
    ├── react/               # React components
    ├── install-checks/      # Installs the packed packages in fresh projects and tests them
    └── typescript-config/   # Shared tsconfig files
```

Planned packages are added when their work starts: `vue`, `svelte`, `checker`, `ai`, `react-email`, `mcp` and `cli`.

### Dependency rules

- `core` has no DOM, UI framework or app dependencies.
- `renderer` depends on `core` and MJML.
- `editor` depends on `core` and `renderer`, and loads MJML only when it's needed.
- Framework wrappers depend only on `editor`, and take their framework as a peer dependency.
- `packages/*` never import from `apps/*`.
- Planned: `checker` and `ai` depend on `core`, and `ai` holds no API keys and requires no AI provider. `react-email` depends on `core`, so apps that don't use React never install it.

### Technology

| Area | Choice |
|---|---|
| Monorepo | pnpm workspaces and Turborepo |
| Language | TypeScript, strict |
| Editor | A Lit Web Component in Shadow DOM ([ADR 0002](docs/adr/0002-build-the-editor-with-lit-in-shadow-dom.md)) |
| Rich text | ProseMirror ([ADR 0003](docs/adr/0003-edit-text-with-prosemirror-directly.md)) |
| Drag and drop | The editor's own pointer events |
| Validation | Valibot |
| Email output | MJML |
| Builds | tsdown |
| Docs and Playground | Blume |
| Tests | Vitest and Playwright |
| Linting and formatting | Ultracite, with Oxlint and Oxfmt |
| Versioning | Changesets |

Effect isn't used in the published packages, and may be reconsidered for the CLI and the MCP server. Ultracite's framework rules are set per package, because the rules of different frameworks can conflict.

## 8. What `0.1.0` includes

- The packages `core`, `renderer`, `editor` (with a CDN build) and `react`
- Text, Heading, Image (by URL), Button, Divider and Spacer Blocks
- Rows of 1 to 4 Columns, from preset layouts
- Settings for each Block, Row and the email
- Drag and drop, with a keyboard path for every drag action
- Undo and redo
- Merge Tags typed into text and links, kept through editing and rendering, with any `&`, `<`, `>` or `"` in them escaped
- Save and load as JSON
- Preview of the real exported HTML, in a sandboxed iframe
- HTML export, tested in Gmail and Apple Mail
- Theme tokens to match the editor to the host app
- The Shell: a ready-made editor page with Import, Export and messages
- The docs and the Playground

It doesn't include a Merge Tag picker, image uploads, or anything in [Planned features](#10-planned-features).

### The docs and the Playground

`apps/docs` is one static site, built with Blume and served from its root. It has the docs, a page of tested email clients that lists where the export was checked and its known limits, and the Playground: one page where anyone can try the editor. The Playground keeps emails in the browser, imports and exports JSON, and exports HTML. It runs on `@mailquilt/react`, so it tests the wrapper too.

## 9. Roadmap

There are no dates, and items can move. Each item is tracked in GitHub Issues.

**Next**

1. Vue and Svelte wrappers
2. More Blocks and settings
3. An MCP server, on its own, with its first five tools
4. The AI builder

**Later**

- A CLI and local mode
- Copy, paste and duplicate
- A read-only view of the generated code
- Light and dark editor themes
- Brand styles, a Merge Tag picker and display rules
- The email checker
- Mobile and dark-mode previews
- HTML mode
- React Email export
- Saved Rows, and MJML and HTML import
- Sending integrations
- Translated emails
- Collaboration support, with an example

## 10. Planned features

These are the intended designs. Each is settled in its own issue before it's built.

### HTML mode

There are three levels of access to HTML:

1. **View code:** the generated HTML, read-only.
2. **HTML Block:** custom HTML inside a Block-based email.
3. **Full HTML mode:** the whole email in a code editor (CodeMirror), with a live preview.

Switching from Blocks to HTML always works. It warns that the email leaves the visual editor, and keeps the Block version so the user can go back, losing their HTML edits. Switching from HTML to Blocks is best effort: what's recognized becomes Blocks, and the rest becomes HTML Blocks, so nothing is lost. The two are never kept in continuous sync.

### Brand styles, Merge Tags and display rules

- **Brand styles:** Blocks refer to shared colors, fonts and button styles, so changing one updates the whole email. The renderer writes the values in directly, because email clients support CSS variables poorly.
- **Merge Tags:** a picker, sample data for Preview, and output for plain values, Handlebars and Liquid. Merge Tags stay intact through editing, AI changes and rendering.
- **Display rules:** show or hide Rows and Blocks, and repeat content such as product lists. Rules are stored as structured data, not as template syntax mixed into the content.

### Email checker

The checker will run in the editor, the CLI and the MCP server. Each result has a severity, an explanation, the Block it's about and a suggested fix.

| Category | Examples |
|---|---|
| Compatibility | CSS or HTML that target clients don't support |
| Size | HTML large enough for Gmail to clip |
| Accessibility | Missing alt text or language, low contrast, unclear link text |
| Links | Empty, malformed or broken URLs. Checking for broken links needs the network, so it's optional |
| Content | A missing preheader or unsubscribe link |
| Merge Tags | Unknown tags, or tags without a fallback |
| Custom | Rules added by developers |

Compatibility data would come from a maintained source such as Can I email, if its license allows.

### AI builder

- Generate an email from a prompt, edit it through chat ("make the header darker"), rewrite, shorten or translate text, and turn HTML into Blocks.
- The AI returns documents or Commands, never raw HTML for a Block-based email. Its schemas come from the Block definitions, so custom Blocks work too.
- Every response is validated, then retried or shown as an error. Changes appear as a preview to accept or reject, and each accepted change is one undo step.
- The AI must keep Merge Tags, must not invent image URLs, and any HTML it writes is sanitized.

There's no default AI service. The editor takes a small adapter, and keys stay with whoever runs it:

```ts
editor.ai = {
  stream: (request) => fetch("/api/ai", { /* … */ }),
};
```

| Where it runs | Where the keys are |
|---|---|
| In a developer's app | On the developer's server |
| Local mode | In the user's local environment |
| The Playground | Supplied by the user, never stored or logged |

**Open question:** the Playground is a static page, so it can't run a proxy for AI requests. Any proxy would have to be hosted separately, and hold no state.

### MCP server, CLI and local mode

The MCP server gives AI agents the same engine as the editor. `@mailquilt/mcp` runs on its own and starts with five tools. The others come with the features they need.

| Tool | What it does | When |
|---|---|---|
| `list_block_types` | Lists Blocks and their schemas | First version |
| `create_email` | Creates an email | First version |
| `read_email` | Reads an email | First version |
| `apply_commands` | Applies validated Commands | First version |
| `render_html` | Returns the HTML | First version |
| `check_email` | Runs the email checker | With the checker |
| `import_html` | Turns HTML into an email | With HTML import |
| `export_react_email` | Exports a `.tsx` template | With React Email export |
| `get_preview_url` | Returns the local preview URL | With local mode |

The CLI:

```bash
mailquilt dev
mailquilt render email.json
mailquilt check email.json
mailquilt export email.json --format react-email
mailquilt mcp   # the same server as @mailquilt/mcp
```

Local mode opens the full editor on a project's own files and connects a coding tool through MCP:

```text
Coding tool ──> MCP server ──> Commands ──> ./emails/welcome.json
                                                  │
                         local editor and preview ┘
```

Emails are JSON files, so they work with Git and code review. An agent's edits appear live in the editor, and edits in the editor save back to the files. No account or hosted service is needed. Local mode listens on `localhost` only, checks where requests come from, reads and writes only the chosen project folder, and treats all email content as untrusted.

### Collaboration support

Mail Quilt won't host real-time collaboration, but it will give developers what they need to build it:

- A stream of serializable Operations, and a way to apply remote ones without adding them to local undo
- Stable IDs for Rows, Columns and Blocks
- Presence hooks, for cursors and selected Blocks
- A point to plug in ProseMirror collaboration, such as `y-prosemirror`
- A documented example, probably with Yjs

```ts
editor.subscribe((operations) => transport.send(operations));
transport.onMessage((operations) => editor.applyRemote(operations));
editor.setPresence(user.id, { selectedBlockId: "abc" });
```

Conflicts and the transport belong to the developer or their library. The design will be tested against this before the API is called stable.

### Output and integrations

- **HTML:** the main output, through MJML.
- **MJML:** export and import.
- **React Email:** a one-way `.tsx` export. MJML stays the reference, so the two won't match pixel for pixel, and `.tsx` files aren't imported back.
- **Sending integrations:** push templates to services such as Resend, SES and Mailchimp, with the user's own credentials.
- **Translations:** several language versions of one email, sharing its layout.

### Extension points

Custom Blocks and settings fields, custom checker rules, image upload and media library adapters, the AI adapter, a Merge Tag provider, sending adapters, translations of the editor's interface, and white-labeling with no required Mail Quilt branding. Theme tokens are already available.

## 11. Quality and testing

- **Unit tests (Vitest):** Commands, undo and redo, migrations and the renderer.
- **Browser tests (Playwright):** drag and drop, the keyboard, undo, settings, export and the React wrapper, in Chromium, Firefox and WebKit, with automated accessibility checks.
- **Install checks:** the packed packages are installed in fresh plain JavaScript, CDN and Next.js projects, and tested there.
- **Email clients:** `0.1.0` is checked in Email on Acid, in Gmail, Apple Mail, iOS Mail, every version of Outlook, Yahoo, AOL and European webmail, in light and dark mode. The docs list the clients and the known limits.
- **By hand, for `0.1.0`:** keyboard and screen reader use, typing Japanese in Safari, Firefox and Chrome (automated tests can only simulate it in Chromium), and touch.

[`docs/agents/testing.md`](docs/agents/testing.md) says how tests are written here.

## 12. Security

- Pasted content, imported files, image URLs, Merge Tag values and AI output are untrusted.
- HTML is sanitized, and Merge Tag values are escaped.
- Preview runs in a sandboxed iframe.
- Commands from AI, MCP and collaboration are validated exactly like the editor's own.
- The Playground never stores or logs anyone's AI keys or prompts.

## 13. Risks and open questions

| Risk | How it's handled |
|---|---|
| Rich text or dragging misbehaves in Shadow DOM | Tested early ([ADR 0002](docs/adr/0002-build-the-editor-with-lit-in-shadow-dom.md)). If text editing fails in a later case, the fallbacks are an iframe canvas, then light DOM |
| The canvas and the exported HTML differ | Preview shows the real export, and tests compare the two |
| Email client quirks, Outlook especially | MJML handles most of them. The export is checked in Email on Acid, and the docs list the known limits |
| MJML is large in the browser | It loads only for Preview and export |
| Early API changes hurt users | `0.x` versions, versioned documents and clear changelogs |
| AI writes invalid or poor emails | Schemas, validation, previews and a fixed set of test prompts |
| The project is large for one maintainer | Small releases that each work on their own, thin wrappers, and Block definitions that drive the interface |

Not yet confirmed:

- Typing with an input method editor, such as for Japanese, works in Shadow DOM in real Safari and Firefox. So far it has only been simulated in Chromium.
- Drag and drop works with touch.
- MJML's output, and `mjml-browser`'s handling of Merge Tags, hold up in real email clients.
- Can I email's data can be used under its license.
- Sending services' APIs support the planned integrations.
- The Operation model supports Yjs collaboration without major changes.

## 14. Versioning and releases

- All the published packages share one version, managed with Changesets.
- On `0.x`, a patch fixes bugs, and a minor version adds features or makes breaking changes. `1.0.0` comes once real users have proven the API.
- A bad release is fixed by publishing a new version, and deprecating the bad one if needed.
- Each change goes through a short-lived branch and a pull request, with messages such as `feat(core): add moveBlock command` or `fix(editor): keep selection after undo`.

To release, version on a branch, so CI checks the exact commit that's published:

```bash
pnpm changeset version   # bumps versions and writes the changelogs
# The CDN links name the version, and no check can tell they're out of date.
git grep -l "@mailquilt/editor@" -- PROJECT.md apps packages
# Set each to the new version, and move what shipped out of the roadmap's "Now".
git add -A && git commit -m "chore: release"
# Push, open a pull request, and merge it once CI passes. Then, on main:
git pull
pnpm release             # builds, then publishes to npm and tags the release
git push --follow-tags
```

## 15. Open source model

- MIT licensed, with every feature free.
- Supported by optional sponsorships only, such as GitHub Sponsors.
- The roadmap is public, in GitHub Issues, and has no dates, because this is a one-person project.
- The Playground stays cheap to run: a static page with no accounts and no central database.
