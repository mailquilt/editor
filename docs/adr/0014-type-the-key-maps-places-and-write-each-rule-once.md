# Type the key map's places, and write each rule once

The key map's key scopes are places by type, every `data-place` is written with a place's name by type, a key rule that holds in more than one scope is written once, and the key map leaves alone a key that a Block's text answered (#217).

Before, the key map and the DOM agreed only through strings. A key scope renamed in the key map, or a `data-place` misspelled in a template, compiled, and the place quietly lost its keys. One key scope, a settings field holding a draft, wasn't a place at all: key dispatch decided it from the field's draft. Alt+← and Alt+→, undo and redo, and Ctrl/⌘+K were copied into the list of each scope they hold in, and the unit test listed those scopes by hand. Key dispatch heard a key in a Block's text after ProseMirror, whether or not ProseMirror had acted on it, which was safe only because no key was in both lists.

## How

- `editor-places.ts` exports the `Place` type and `place()`, which every template uses for its `data-place`. The key map's scopes are declared `satisfies Partial<Record<Place, …>>`, so a key scope is a place's name or it doesn't compile.
- A settings field holding a draft is the place `settingsDraft`. The drafts module asks for an update when a field's draft begins or ends, so the field's `data-place` follows it.
- Each key scope lists only its own keys, and what it's within: the email, the editor, a field, or outside the editor. Ctrl/⌘+K, undo and redo are written once, for what holds them, and Alt+← and Alt+→ once, for every scope. A field that keeps every key, the link field, says so, and its keys all stop there.
- The text view answers its keys in one ProseMirror plugin: `TEXT_KEYS`, then ProseMirror's base keys. It tells key dispatch of each key that plugin answered, and key dispatch leaves that key alone, so the text's keys and the key map never both act on one, whatever either list holds.
- The unit tests take the key scopes from the key map, and test each shared rule in every scope it holds in.

## Alternatives

- **Key dispatch skips a key whose default ProseMirror prevented.** ProseMirror prevents the default of keys it doesn't act on, such as Escape and Ctrl/⌘+Z, so a key it answered can't be told from the event.
- **The text view gives each key to the key map first, through ProseMirror's `handleDOMEvents.keydown`, and ProseMirror skips one it answered.** ProseMirror would then skip its own work on that key too, such as reading a change still pending in the page, and it drops a key whose default a host page has already prevented, so those keys would act everywhere but in the text.
- **A key the innermost scope doesn't answer goes on to the one around it.** It writes each rule once without the grouping, but a Block's text is inside the Block, whose arrow keys select another Block, so each scope would have to stop the keys it doesn't want.
- **A test that reads the templates for `data-place` values.** It would catch a misspelling only when the tests run, and a value built in code would escape it.

## Consequences

- A new place with keys is one name in `editor-places.ts`, `place()` on its element, and an entry in the key map that says what it's within.
- A key in both lists would be the text's, and the key map's rule for it would never act, so a unit test fails on any key the text or ProseMirror's base keys answer.
- What every key does doesn't change.
