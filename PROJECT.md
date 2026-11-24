# Mail Quilt: design and roadmap

This document explains what Mail Quilt is for, how it's designed, and where it's going. It's for anyone who wants to understand the project or contribute to it.

- To use the packages, read the [docs](apps/docs/docs).
- Words such as Block, Row, Command and Merge Tag are defined in [`GLOSSARY.md`](GLOSSARY.md).
- The main design decisions, and why they were made, are in [`docs/adr/`](docs/adr).
- Plans and progress are tracked in [GitHub Issues](https://github.com/mailquilt/editor/issues).

**Status:** Mail Quilt is on `0.x`, so the API can still change between minor versions. Each package's changelog says what a release changed. Sections marked _planned_ describe intended designs, not promises, and can change before they're built.

## Contents

1. [What Mail Quilt is](#1-what-mail-quilt-is)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [How it works](#3-how-it-works)
4. [The document](#4-the-document)
5. [Blocks and settings](#5-blocks-and-settings)
6. [Public API](#6-public-api)
7. [Packages](#7-packages)
8. [What's released](#8-whats-released)
9. [Roadmap](#9-roadmap)
10. [Planned features](#10-planned-features)
11. [Quality and testing](#11-quality-and-testing)
12. [Security](#12-security)
13. [Risks and open questions](#13-risks-and-open-questions)
14. [Versioning and releases](#14-versioning-and-releases)
15. [Open source model](#15-open-source-model)

## 1. What Mail Quilt is

Mail Quilt is a set of free, MIT-licensed packages for adding a drag-and-drop email editor to any web app. Each app takes as much of it as it needs:

| If you want… | Use |
|---|---|
| A whole editor page, ready-made | The Shell, `<mail-quilt-shell>` |
| An editor inside a page of your own | The editor, `<mail-quilt>`, or its React component |
| The email as data, and the HTML for it | `@mailquilt/core` and `@mailquilt/renderer` |

The editor is a Web Component, so it works in any framework or none. A React wrapper ships today, and Vue and Svelte wrappers follow if the element alone isn't enough. The editor is built on `core` and `renderer`, and an app can build on them too, for example to change emails on a server.

Today, people build emails by dragging Blocks into Rows and Columns, or with the keyboard. Planned are editing the HTML directly, an AI builder that uses your own AI provider, and an MCP server so coding tools can create and edit emails.

### Who it's for

- **Developers** building email design into their product.
- **Their users**, such as marketers and founders, who design emails without code.
- Later, **developers using coding tools** who want agents to build emails in their repo, and **anyone** who wants to design and export an email in the free Playground.

## 2. Goals and non-goals

### Goals

1. Embed in any framework through one consistent API.
2. Produce HTML that works in the major email clients. The export is checked in Gmail, Apple Mail, Outlook, Yahoo and others through Email on Acid, and the docs list the limits found.
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
- Web pages, popups or AMP emails

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

Drag and drop, the keyboard and the path from Commands to HTML are released. AI, MCP, the CLI, the email checker, React Email export and HTML mode are planned.

### Design principles

- **The document is the source of truth.** An email is stored as JSON, not HTML. The HTML is generated from it.
- **Every edit is a Command.** A Command is a request that can be refused. An accepted one produces Operations and is one undo step. Undo applies the reverse Operations.
- **Operations are a small, fixed set:** insert, remove, move, set properties and set a Column's width. Moving is its own Operation, so collaboration can later tell a move from a delete and a new Block.
- **Commands are plain JSON.** Setting properties merges their top-level keys, so a nested value is replaced whole, and `null` removes one where the schema allows it.
- **There's one undo history.** Typing in a Block merges into one undo step until the user pauses or leaves it.
- **`core` and `renderer` need no browser.** They run on a server without a DOM or a UI framework, and a server can render an email without loading any editor code.
- **The interface is written once.** The editor is a Web Component, and each framework wrapper stays thin.
- **MJML stays inside `renderer`.** It uses `mjml-browser` on servers and in browsers alike. In a browser, MJML is several times the size of the rest of the editor, so the editor loads it only for Preview and export.
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
- **Whatever loads also exports,** so values follow what MJML accepts. Colors are `#rgb`, `#rrggbb`, `rgb()` or `rgba()`, the email width is a whole number of pixels up to 1200, and a Column is at least 1% wide. A language set by a Command must be a code such as `en` or `pt-BR`, or one Merge Tag as its whole value, such as `{{language}}`. A saved one loads whatever it is, so the email can still be opened and fixed, and the renderer escapes it.

### Planned additions

Version 4 adds Email style, fuller settings with Phone values, decorative images, web fonts, and the Menu and Video Blocks, in one change to the format. Later versions add display rules, more Phone values and HTML documents, each through a migration, as its feature is built.

## 5. Blocks and settings

| | Released | Planned |
|---|---|---|
| **Layout** | Rows, and Columns from preset layouts | — |
| **Blocks** | Text (with Lists), Heading, Image, Button, Divider, Spacer, Social | Menus and video thumbnails in `0.4.0`. Tables, headers and footers, custom HTML |
| **Settings** | Alignment, colors, font size, sizes, links and alt text. Email width, background, font, preheader and language. Row background and padding, and hiding or stacking a Row on phones | Email style, spacing, borders, corners, Column settings, showing on one device and Phone values in `0.4.0`. Background images, more Phone values |

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
  import "https://cdn.jsdelivr.net/npm/@mailquilt/editor@0.3.0/dist/cdn/index.js";

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
- **`uploadImage`, `mergeTags` and `socialIconsUrl`** are optional properties for what the Host app supplies: a function that uploads an image to its own storage, its list of Merge Tags, and where the Social Block's icons are served from.

### The Shell

`<mail-quilt-shell>` is a ready-made editor page: the editor with a header, Import and Export, and messages. It takes the same `value`, events and `exportHtml()` as `<mail-quilt>`, plus `heading`, `actions` to choose its buttons, and `save-key` to keep the email in the browser. React has it as `MailQuiltShell`. The [Shell page](apps/docs/docs/shell.mdx) has the details.

### React

```tsx
<MailQuilt value={document} onChange={setDocument} onError={showError} />
```

The custom element is only registered in the browser, so the components are safe in server-rendered apps such as Next.js. Other frameworks, such as Vue, Svelte, Solid and Angular, use `<mail-quilt>` directly. Vue and Svelte wrappers follow if the element alone isn't enough, with the same ideas in each framework's conventions.

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

Planned packages are added when their work starts: `checker`, `ai`, `react-email`, `mcp` and `cli`, and `vue` and `svelte` if the element alone isn't enough.

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

## 8. What's released

- The packages `core`, `renderer`, `editor` (with a CDN build) and `react`
- Text, Heading, Image, Button, Divider, Spacer and Social Blocks
- Bulleted and numbered Lists in Text Blocks, one level deep
- Rows of 1 to 4 Columns, from preset layouts, with padding, and settings to hide a Row on phones or keep its Columns side by side there
- Settings for each Block, Row and the email
- Drag and drop, with a keyboard path for every drag action
- Copy, cut, paste and duplicate for Blocks and Rows, in one email, between emails and from other apps
- Image upload to the Host app's storage, from the Image settings or by dropping files on the email
- Undo and redo
- Merge Tags as one unit in text, a list of the Host app's Merge Tags that typing `{{` opens in text and in every text or URL setting, and tags kept through rendering, with any `&`, `<` or `>` in them escaped, and a `"` too in a link or image URL
- Save and load as JSON
- Preview of the real exported HTML, in a sandboxed iframe, at desktop or phone width
- HTML export, tested in Gmail, Apple Mail, Outlook and other major email clients
- Theme tokens to match the editor to the host app
- An editor that works on a page with a strict Content Security Policy
- In `core`: `canUndo()`, `canRedo()`, and a code for each Command it refuses
- The Shell: a ready-made editor page with Import, Export and messages
- The docs and the Playground

It doesn't include anything in [Planned features](#10-planned-features).

### The docs and the Playground

`apps/docs` is one static site, built with Blume and served from its root. It has the docs, a page of tested email clients that lists where the export was checked and its known limits, and the Playground: one page where anyone can try the editor. The Playground keeps emails in the browser, imports and exports JSON, and exports HTML. It runs on `@mailquilt/react`, so it tests the wrapper too.

## 9. Roadmap

There are no dates, and items can move. Each item is tracked in GitHub Issues.

**Next: `0.4.0`**

The redesign, and everything that fits it, in one release with one change to the saved format, version 4. The line under a feature is what its spec has to settle first, because the code doesn't allow for it yet.

1. A redesign of the editor's interface ([ADR 0021](docs/adr/0021-three-modes-and-a-selection-bar.md))
   - Three Modes: Edit, Style and Check. Edit has the Rows list and one Selection bar above the email for what's selected, in place of the side panel and the Block toolbars, and works on phones. The Rows list, the Selection bar and the Canvas are built as separate parts, so they can be offered to hosts later without a rewrite.
   - A start screen of Starter emails, and Saved Rows to add, when the Host app supplies them. One sample value for each Merge Tag, which Check can show.
2. Email style ([ADR 0022](docs/adr/0022-email-style-between-a-block-and-the-defaults.md))
   - The email's own colors, a heading and a body font, Heading 1 to 3 and body sizes, and button corners, which a Block's own value overrides.
   - First: a value a Block leaves unset and takes from Email style, as every Block stores each of its values today.
3. Fuller settings for every Block, Row and Column
   - Padding, a background color, a border and corners for every Block. Settings for a Column: background color, padding, vertical alignment and a border. Every Block and Row shows on all devices, on desktop only or on phones only. A Phone value for font size, padding and an Image's width.
   - First: settings for a Column, as it has none. What each setting falls back to in Outlook on Windows, which ignores rounded corners.
4. A "decorative" choice for every image, exported with empty alt text and never linked
5. Web fonts, from a list the Host app supplies, for Email style's fonts
6. Menu and Video Blocks
7. Check
   - The email in an inbox at desktop and phone width, its plain-text version, and its HTML, read-only. Sending a test email, through a function the Host app supplies.
   - Its first Problems: an Image with no image or no alt text, a Button with no link, a Merge Tag not in the Host app's list, an empty preheader, HTML over 102 KB, no language, low contrast, link text such as "click here", and no unsubscribe link when the Host app names its unsubscribe Merge Tag. Each warns, and says what to fix.
   - First: the rules as a function of their own in the renderer, outside the editor, so a host's server, the CLI and the MCP server can run them too.
8. The editor's English strings in one place, which a Host app can replace
   - First: about 90 strings in the editor and 35 in core are written inline and joined together. Core's own messages stay in English, for developers.
9. A built-in dark theme for the editor, which a Host app turns on
10. React 18 in `@mailquilt/react`
    - First: where the components rely on React 19, such as taking `ref` as a plain prop.
11. Vue, Angular and Svelte tested in `install-checks`, with types for the element
12. A JSON Schema for the email format, generated from core's own checks
13. A docs page for each sending service

**After `0.4.0`**

Left out of `0.4.0` on purpose, to keep it to what fits the redesign. These come first in the release after it, in no order yet.

- Background images for Rows and Columns
  - First: the VML that Outlook on Windows needs to draw them.
- Phone values for more settings than font size, padding and an Image's width
- Table and HTML Blocks
  - First: for the HTML Block, how its content is sanitized and how a Host app turns it off. For the Table, how a person edits its grid.
- Right-to-left emails
  - First: left and right as directions, as they're a Column index of −1 and +1.
- Translations of the editor's interface, shipped with it
- A plain-text version a person can edit
  - First: where it's kept in the email, and what happens to it when the email changes after.
- More of the email checker: rules from a maintained source such as Can I email, once the HTML Block or HTML mode exists; broken links, through a function the Host app supplies; Merge Tags without a fallback; rules the Host app adds; and `check` in the CLI and the MCP server, as they arrive
  - First: for fallbacks, a fallback for a Merge Tag, which the format doesn't have.

**Later**

Wanted. The first five open the editor up to the Host app, so they come first, in this order. The rest have no order yet.

- Custom Blocks
  - First: the settings fields' interface made public, which `0.4.0`'s fields are built to allow.
- The editor in parts a Host app arranges itself, with the text editor as its own element, and the selection and Commands reachable from outside
- Saving a Row from the editor, through a function the Host app supplies
- Display rules
  - First: their output in each sending service's template language, such as Liquid or Handlebars.
- Parts of an email that can't be changed
  - First: who can unlock them, which needs the Host app's roles.
- A dark-mode preview
- HTML mode
- Import from HTML, MJML and other editors' formats
- An MCP server, on its own, with its first five tools, then a CLI and local mode
- The AI builder
- Vue and Svelte wrappers, if the tested and typed element isn't enough
- React Email export
- Sending integrations
- Translated emails
- A Countdown Block, with a timer image the Host app serves
- Collaboration support, with an example
  - First: a Block's text view that follows every change to the email, as it follows one only on undo and redo.

**Before `1.0.0`**

- Measure the editor's speed on a large email, and set a limit to keep to
- Confirm that dragging works by touch on a tablet
- Say how soon an issue gets a first reply
- Freeze the document format and the API, with a written promise of what won't change

## 10. Planned features

These are the intended designs. Each is settled in its own issue before it's built.

### HTML mode

There are three levels of access to HTML:

1. **View code:** the generated HTML, read-only.
2. **HTML Block:** custom HTML inside a Block-based email.
3. **Full HTML mode:** the whole email in a code editor (CodeMirror), with a live preview.

Switching from Blocks to HTML always works. It warns that the email leaves the visual editor, and keeps the Block version so the user can go back, losing their HTML edits. Switching from HTML to Blocks is best effort: what's recognized becomes Blocks, and the rest becomes HTML Blocks, so nothing is lost. The two are never kept in continuous sync.

The HTML Block comes first, on its own. It's the one Block that lets a person put markup of their own on the canvas, so how its content is sanitized, and how a Host app turns the Block off, are settled before it's built. The Block is off unless the Host app turns it on.

### Email style, Merge Tags and display rules

- **Email style:** Blocks use the email's own colors, fonts, sizes and button corners unless they set their own, so changing one updates the whole email. The renderer writes the values in directly, because email clients support CSS variables poorly.
- **Merge Tags:** groups in the picker, sample data for Preview, and output for Handlebars and Liquid. Merge Tags stay intact through editing, AI changes and rendering.
- **Display rules:** show or hide Rows and Blocks, and repeat content such as product lists. Rules are stored as structured data, not as template syntax mixed into the content.

### Email checker

The checker will run in the editor, the CLI and the MCP server. Its rules are a function of their own in the renderer, which Check calls. Each Problem has an explanation, the Block or Row it's about and a fix. A severity comes once something can block an export or be turned off. `0.4.0` has the size, accessibility and content rules, and the Merge Tags not in the Host app's list.

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

Custom Blocks and settings fields, custom checker rules, a media library adapter, the AI adapter, sending adapters, translations of the editor's interface, and white-labeling with no required Mail Quilt branding. Theme tokens, `uploadImage`, `mergeTags` and `socialIconsUrl` are already available.

## 11. Quality and testing

- **Unit tests (Vitest):** Commands, undo and redo, migrations, the renderer and the editor's key map.
- **Browser tests (Playwright):** drag and drop, the keyboard, undo, settings, export and the React wrapper, in Chromium, Firefox and WebKit, with automated accessibility checks.
- **Install checks:** the packed packages are installed in fresh plain JavaScript, CDN, React with Vite, and Next.js projects, and tested there.
- **Email clients:** the export is checked in Email on Acid, in Gmail, Apple Mail, iOS Mail, every version of Outlook, Yahoo, AOL and European webmail, in light and dark mode. The docs list the clients, when they were checked, and the known limits.
- **By hand, before each release that adds a Block or changes what the renderer writes:** the same check in Email on Acid, with a fixed set of test emails that use every Block and layout. The docs' page of tested clients then gets the new date.
- **By hand, before `0.1.0`:** typing Japanese in Safari, Firefox and Chrome (automated tests can only simulate it in Chromium), and touch.

[`docs/agents/testing.md`](docs/agents/testing.md) says how tests are written here.

## 12. Security

Pasted content, imported files, links, image URLs, Merge Tags and, later, AI output are untrusted.

What's built:

- No email holds HTML of its own yet, so nothing is sanitized. Pasted HTML is read through the text's schema, so it keeps only what a Text or Heading can store, and a link only if its URL is allowed.
- An email that doesn't match the document format is refused, never repaired.
- Links and image URLs are limited to the schemes in [the document's rules](#rules). So are the URLs of a Social Block's links, and the URL an image upload returns.
- A pasted Block or Row is checked as an imported email is, and gets new IDs, so a crafted clipboard can't put in an email anything a saved email couldn't hold.
- The renderer escapes what it writes in one place. Any `&`, `<` or `>` in a Merge Tag is escaped, and a `"` too in a link or image URL. The value a sending service fills a Merge Tag with is the service's to escape.
- Preview runs in a sandboxed iframe, with no scripts.
- Commands from code are validated exactly like the editor's own.

Planned:

- The HTML Block's content, and any HTML the AI writes, are sanitized.
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

- Can I email's data can be used under its license.
- Sending services' APIs support the planned integrations.
- The Operation model supports Yjs collaboration without major changes.

## 14. Versioning and releases

- All the published packages share one version, managed with Changesets.
- On `0.x`, a patch fixes bugs, and a minor version adds features or makes breaking changes. `1.0.0` comes once real users have proven the API.
- A bad release is fixed by publishing a new version, and deprecating the bad one if needed.
- A release that changes the saved format raises its version once, however many changes it holds. Until the release is published, that version is open on `main`: each pull request extends it, and an email saved from `main` in between isn't supported. The versioning step waits until the release's features are all in, so nothing is published with half the format.
- Each change goes through a short-lived branch and a pull request, with a title that says what's true after it, such as `fix: the Shell keeps a first-time visitor's work`. Pull requests are squashed, so the title becomes the commit.

To release, version on a branch. CI publishes the commit it checked:

```bash
pnpm changeset version   # bumps the versions in package.json and writes the changelogs
# Then, by hand, what names the version or says what's in a release:
# 1. The CDN links. The install checks fail until each one in this file, the
#    docs pages, the READMEs and the skill matches. These are the files:
git grep -l "/@mailquilt/editor@[0-9]" -- PROJECT.md README.md apps/docs/docs "packages/*/README.md" skills
# 2. The version placeholder in the bug report form, .github/ISSUE_TEMPLATE/bug.yml.
# 3. The roadmap in this file: take out what shipped, and add it to "What's released".
# 4. The roadmap page, apps/docs/pages/roadmap.astro: move what shipped from
#    "Next" to "Now".
git add -A && git commit -m "chore: release"
# Push, open a pull request, and merge it once CI passes.
```

On `main`, CI's release job runs once every check has passed. It publishes each package whose version isn't on npm yet, with provenance, and pushes a tag for each. Any other commit on `main` publishes nothing, as its versions are already on npm. If a publish fails, rerun the job.

npm lets the job publish without a token because each package has this repository's `ci.yml` as its trusted publisher, with publishing that skips 2FA turned off.

Once the packages are on npm, two steps are by hand:

- **The docs site.** The live site is built from the `docs-live` branch, so its docs match the packages on npm. Move the branch to the release commit: `git push origin <release commit>:docs-live`.
- **The GitHub release.** Make one named `Mail Quilt <version>`, on the tag `@mailquilt/editor@<version>`, with a line on what the release brings, the install command, links to the docs and the Playground, and each package's changelog entry.

## 15. Open source model

- MIT licensed, with every feature free.
- Supported by optional sponsorships only, such as GitHub Sponsors.
- The roadmap is public, in GitHub Issues, and has no dates, because this is a one-person project.
- The Playground stays cheap to run: a static page with no accounts and no central database.
