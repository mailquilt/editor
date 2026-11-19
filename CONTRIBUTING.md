# Contributing

Mail Quilt is run by one maintainer, so changes start as a conversation.

## Issues first

- **A bug or an idea:** [open an issue](https://github.com/mailquilt/editor/issues/new/choose). Search the open and closed issues first.
- **A pull request:** open one once its change is agreed in an issue, and link that issue. A PR for something nobody agreed to may be closed, however good it is.
- **A small fix,** such as a typo or a broken link, can skip the issue.
- **A security problem:** report it privately, as [SECURITY.md](SECURITY.md) says, never in an issue.

Before you suggest a change to how something works, read [`docs/adr/`](docs/adr) and [`docs/agents/decisions.md`](docs/agents/decisions.md). They record what was decided and why, and a decision there stands unless something has changed since.

## Making a change

The README's [Working on it](README.md#working-on-it) section has the setup and commands. A pull request needs:

- **Tests** for what it changes, written as [`docs/agents/testing.md`](docs/agents/testing.md) says.
- **Every check passing:** `pnpm lint`, `pnpm check-types` and `pnpm test`. CI runs them too, in Chromium, Firefox and WebKit.
- **A changeset** if it changes a published package. Run `pnpm changeset` and describe the change for people who use the package. CI fails without one. If the change needs no release, such as a test, run `pnpm changeset add --empty`.
- **The words in [`GLOSSARY.md`](GLOSSARY.md),** in code and docs, such as Row, Column and Block.
- **A title in the repo's style:** `fix:`, `feat:`, `docs:`, `perf:`, `refactor:` or `test:`, then what changes, such as `fix: long words wrap in Yahoo`. Pull requests are squashed, so the title becomes the commit.

## License

By contributing, you agree that your work is released under the [MIT license](LICENSE), like the rest of Mail Quilt.
