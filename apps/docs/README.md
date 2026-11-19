# The Mail Quilt site

The landing page, the docs and the Playground, built with [Blume](https://github.com/haydenbleasel/blume).

## Where things are

| Folder | What's in it |
| --- | --- |
| `docs/` | The docs pages, served under `/docs`. Folders starting with `_` hold code the pages include. |
| `pages/` | The other pages: the landing page, Examples, Compare, Why, Roadmap, the Playground and the 404. |
| `components/` | The frame those pages share, the footer, and the landing page's sections under `home/`. |
| `styles/` | `site.css` has the pieces every page under `pages/` is built from. `home.css` has the landing page's own. |
| `theme.css` | The colors and type, and the restyling of Blume's header, sidebar and docs pages. |
| `site/` | Data and code the pages use, such as the example emails. |
| `browser-tests/` | Playwright tests, run against a build of the site. |

## Where the site is served

The site is served from the root of `SITE_URL` in `site/project.ts`. The packages' `homepage` and READMEs link to the same address.

## Before upgrading Blume

Blume's version is pinned, so an upgrade only comes when you choose one. The site uses a few parts of Blume that its docs don't promise to keep. Check these still work after an upgrade:

- `withBase` from `blume/components/islands/base-path.ts`, which puts the base path on a link.
- `codeBlockHtml` from `blume/components/content/code-block.ts`, which highlights the landing page's code as the docs' own is.
- `Tabs` and `Tab` from `blume/components/content/`, the landing page's tabs of code.
- The selectors in `theme.css` that restyle Blume's header, sidebar, table of contents, cards and page-end links. They match Blume's own attributes and classes, such as `[data-blume-header]` and `a.bg-accent`.
- `[data-blume-tab-panel]` in `styles/home.css`, which joins an install command to the file under it.
- `publicHoistPattern` in the root `pnpm-workspace.yaml`, which hoists Blume's `astro` so `blume check` can type-check the `.astro` files.
- The `_headers` file Blume writes, which `blume.config.ts` adds the security headers to.
