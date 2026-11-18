# Restructure the editor for 0.2

In 0.2 the editor is restructured around two owners: one key map for every key it answers to, and one module for selection and focus. Six broad reviews before 0.1.0 patched these at each place a problem showed, so the source grew by 13% and about a third of the last review's bugs were in code an earlier review wrote. Patching again would repeat that. `<mail-quilt>` is 1,249 lines with 30 private fields and 51 private methods. Its 18 keydown handler references handle Escape in 7 places, each with its own rule, and focus is put back after an update by hand.

The features that follow 0.2 land on exactly these two: copy, paste and duplicate add keys, lists add rules for Tab and Enter inside text, and the Merge Tag picker takes focus and gives it back.

The Shell needs an owner too. It decides which email opens from four pieces of state, changed in three review rounds. Nothing planned next touches that, so it has an issue of its own and doesn't hold up 0.2. It changes no behavior, and ships in 0.2 or in a patch after it.

The work is tracked in #85. The code is judged against the standard below. When every check passes, the work is done. A finding that no check covers goes to the backlog, as `docs/agents/review.md` says.

## The standard

### Editor

- Every key the editor answers to is in one key map. For each place it can be pressed, the map says what the key does and whether it stops there.
- Selection and focus have one owner. No state is kept in two places.
- The Side panel, its settings and the toolbars read the editor's state and change the email through one interface, and nothing else. None of them reaches into `<mail-quilt>`'s private fields or the Canvas's DOM.
- Every workaround for a browser has a comment naming the browser, and a test that fails without it. No other code needs a comment explaining why it's odd.

### Tests

- No selector uses a private class. Tests find things by role, name, test ID or a documented part.
- Each test checks one rule, at the lowest layer that can see it, as `docs/agents/testing.md` says.

### Core

- The main entry exports only what the docs describe. Helpers for Mail Quilt's own packages move to `@mailquilt/core/internal`.

### Renderer and React

- They meet the standard as they are. The renderer keeps writing MJML as strings, since it's small, escapes everything in one place and is tested against saved HTML.

### Not checks

- A source file over about 500 lines in the editor, or 300 in core, is a sign to look for a split. A file can be longer and fine, so no length is a check.
- The work has no score to reach and no closing review of the whole design. Either would have no end, and the features wait on this.

## Consequences

- The work goes in this order: the key map, then selection and focus, with each one's tests moved off private classes as its code changes. Core's internal entry is separate and small.
- The interface between the panels and the Canvas stays private in 0.2. It's kept to what a host's own panel would need, so that offering the editor in parts later is a matter of documenting it, not of untangling the panels first.
- What each key does doesn't change. Where the rules differ today, `docs/agents/decisions.md` says which is right, and `keyboard.mdx` stays true.
- `@mailquilt/core/internal` is a breaking change for anyone who imported those helpers from the main entry. They're marked as not a promise to hosts, and 0.x allows it.
- A browser test run in three browsers, and the install checks, pass before each step merges.
