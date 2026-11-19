# Name the text's keys in the key map

Every key a Block's text has a rule for is named in the key map, `packages/editor/src/key-map.ts`, under `TEXT_KEYS`, with the other keys the editor answers to (#176). The text view binds them and holds no key of its own.

Before, the key map named the text's formatting keys and line break, but the text view kept its own rules for Enter and Delete. It went through ProseMirror's base keys and swapped in its own command wherever ProseMirror's Enter or Delete command was bound. So the key map didn't show that Enter keeps the formatting, or that Delete removes an empty paragraph, and a list's Tab and Enter rules would have had two places to go.

The text view was one file of over 700 lines, with one schema for Text and Heading.

## How

- `TEXT_KEYS` names Enter and Delete with what they do, `newParagraph` and `deleteForward`. The keys that delete forward only on Apple devices, such as Ctrl+D and Alt+Delete, are named there too, as ProseMirror binds them, so they still remove an empty paragraph.
- `text-commands.ts` has the command for each of those actions, and the others the format bar runs. The view binds each key to its command, then ProseMirror's base keys that the key map doesn't name, such as Backspace and select all.
- `text-schema.ts` has a schema for each Block type with text. Text and Heading hold the same for now, but each has its own, so Text can get lists without Heading.
- `text-block-view.ts` keeps the view: focus, changes, undo steps, Merge Tags and paste.

## Alternatives

- **The text view owns all of the text's keys.** The key map would say so and name none of them. But tooltips and `aria-keyshortcuts` already read the text's keys from the key map, and the rest of the editor's keys are there.
- **Swap ProseMirror's commands, as before.** It catches every key ProseMirror binds to Delete without naming them, but the rule stays out of sight.

## Consequences

- A new key in a Block's text, such as Tab in a list, is one entry in `TEXT_KEYS` and one command in `text-commands.ts`.
- If a ProseMirror update binds another key to Enter or Delete, the key map's tests fail until it's added to `TEXT_KEYS`.
- What each key does doesn't change.
