# Mail Quilt

Free, MIT-licensed packages for building email design into any web app: a ready-made drag-and-drop editor, and the document model and renderer it's built on.

## Install

```sh
npm install @mailquilt/editor   # the <mail-quilt> element, for any framework
npm install @mailquilt/react    # or the React components
```

The docs, with a quick start for a bundler, a CDN and React, are in [`apps/docs/docs`](apps/docs/docs).

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

- `PROJECT.md` describes what Mail Quilt is for and what ships first.
- `GLOSSARY.md` defines the words the code and docs use.
- `docs/adr/` records the main design decisions.
- `docs/agents/testing.md` says how tests are written here.

Issues and plans are in [GitHub Issues](https://github.com/yourcodebuddy-in/mailquilt/issues).

## License

MIT. See [LICENSE](LICENSE).
