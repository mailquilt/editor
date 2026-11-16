# Mail Quilt

Free, MIT-licensed packages for building email design into any web app: a drag-and-drop editor, a ready-made editor page around it, and the document model and renderer they're built on.

[Docs](https://editor.mailquilt.com/docs) · [Playground](https://editor.mailquilt.com/playground) · [Examples](https://editor.mailquilt.com/examples) · [Compared with Unlayer, Beefree and GrapesJS](https://editor.mailquilt.com/compare)

[![The Mail Quilt editor: an email on the left, and Blocks to drag onto it on the right](https://editor.mailquilt.com/editor-small.webp)](https://editor.mailquilt.com/playground)

- **Any framework, or none.** The editor is a Web Component, with React components too.
- **HTML that holds up in email clients.** Checked in Gmail, Outlook, including classic Outlook for Windows, Apple Mail and Yahoo Mail. See [Tested email clients](https://editor.mailquilt.com/docs/email-clients).
- **Your emails stay yours.** Emails are JSON your app saves, in a [documented format](https://editor.mailquilt.com/docs/document-format). There's no paid tier and no hosted service.
- **Render on your server.** `@mailquilt/core` and `@mailquilt/renderer` run without a DOM, so you can change emails and turn them into HTML in Node.
- **Keyboard and screen readers.** Anything a person can do by dragging, they can also do from the keyboard. See [Keyboard and screen readers](https://editor.mailquilt.com/docs/keyboard).

## Install

```sh
npm install @mailquilt/editor   # the <mail-quilt> element, for any framework
npm install @mailquilt/react    # or the React components
```

```html
<mail-quilt></mail-quilt>
```

```js
import "@mailquilt/editor"; // registers <mail-quilt>, through your bundler
```

The docs, with a quick start for a bundler, a CDN and React, are at [editor.mailquilt.com](https://editor.mailquilt.com/docs). Their source is in [`apps/docs/docs`](apps/docs/docs).

## Packages

| Package | What it is |
| --- | --- |
| `@mailquilt/core` | The email as JSON, the Commands that change it, and undo. Runs without a DOM. |
| `@mailquilt/renderer` | Turns a document into email HTML with MJML. Runs without a DOM. |
| `@mailquilt/editor` | The `<mail-quilt>` editor and the `<mail-quilt-shell>` editor page, as Web Components. |
| `@mailquilt/react` | The editor and the Shell as React components. |

`apps/docs` is the website: the landing page, the docs and the Playground. `packages/install-checks` installs the built packages into fresh projects and tests them there.

## Working on it

You need Node 24 or later and pnpm.

```sh
pnpm install
pnpm build        # every package, with Turborepo
pnpm test         # unit tests, and Playwright tests in the browser
pnpm check-types
pnpm lint         # pnpm fix formats and fixes what it can
```

Run one package's task with a filter, such as `pnpm --filter @mailquilt/core test`. The browser tests need Playwright's browsers: `pnpm --filter @mailquilt/editor exec playwright install`.

- `PROJECT.md` explains what Mail Quilt is for, how it's designed, and where it's going.
- `GLOSSARY.md` defines the words the code and docs use.
- `docs/adr/` records the main design decisions.
- `docs/agents/testing.md` says how tests are written here.

Issues and plans are in [GitHub Issues](https://github.com/mailquilt/editor/issues).

## License

MIT. See [LICENSE](LICENSE).
