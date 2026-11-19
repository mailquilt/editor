# Writing tests

Each test should fail for one reason no other test fails for. Before adding a
test, search for one that already covers the same code, and extend it instead.

## Test each rule once, at the lowest layer that can see it

- Rules about documents, Commands, validation and undo belong in `core` unit
  tests. Rendering belongs in `renderer` tests. What a key does in each place
  belongs in the editor's key map tests.
- A browser test proves the UI is wired up: the control, focus, keyboard,
  layout, what the screen shows. For a rule that `core` already tests, use one
  case to show the UI handles the refusal or result. Don't repeat the list of
  values.
- A wrapper or page test (React, the Shell, the Playground) proves only what
  that layer adds: its props, events and layout. Don't re-test the editor
  through it.
- Browser tests run in three browsers, so each one costs three runs. Use a unit
  test where one will do.

## Test shared code once, not once per type

- When Block types share a code path (undo, loading, moving, the palette, link
  checks), test it once with one representative type.
- Per type, test only what that type adds: its own settings, limits, rendering
  and keyboard behaviour.
- Read the source to confirm the path really is shared before you rely on one
  representative.

## Each case must reach a different branch

- In `it.each` and loops, every row should exercise a different code path or
  limit. Values that fail the same check are one case.
- Don't run a whole table again to check a second property. Pick one or two
  cases.

## Don't test

- Constants, lists of fields or tabs, labels, link targets or CSS values,
  unless the value is a promise to hosts. Tests that use a control by its
  name already check its name.
- Libraries and the browser: validation library behaviour, native dialog
  focus, JSON turning a literal into text and back.
- Output a saved expected-HTML file already pins. Choose either the saved file
  or a specific check.
- Compatibility with data, keys or APIs no release has had.

## Always keep

- Security checks (escaping, link and URL allowlists): the full table of values
  where the check lives, and one case wherever it's used.
- The public contract: `value`, `mq-change`, `mq-error`, `exportHtml()`,
  Operations and the saved document format. `0.1.0` is released, so emails
  saved with it must keep opening.
- Accessibility checks, and the only test of an edge case or past bug.

## Naming

- Name a test for the behaviour it checks, using `GLOSSARY.md` terms. Not for
  the PR, review or library it came from.
- When a library is removed, remove the tests that only checked its settings
  or quirks. Keep the ones our code now has to get right.
