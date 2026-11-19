# Split key dispatch, announcements and editing actions from the element

`<mail-quilt>` holds `value`, its events, its lifecycle, the text views and the render. Key dispatch, what's announced to screen readers, and the editing actions are modules of their own, each made with a small host interface, as the selection and the Preview already are (#177).

Before, the element's file was 990 lines. Beside its own work, it dispatched every key, kept the status region's words, and added, deleted and moved Blocks and Rows. Copy, paste and duplicate come next, and each adds keys, a change to the email and an announcement. In the element they would have made the file longer and mixed with its lifecycle.

## How

- `key-dispatch.ts` hears every key pressed in the editor, a held key's repeats and input to a Block's text. It finds where the key was pressed, takes what the key map says for that place, and says what each action does there. It holds no rules of its own: they stay in the key map.
- `announcements.ts` holds the status region and what it says, and how a moved Block or Row is described.
- `editing-actions.ts` adds, deletes and moves Blocks and Rows, handles a drop, and selects a neighbouring Block. After each change it selects, focuses or announces what it should. It also records what the latest change moved, so it can say what an undo or redo moved.
- The element still applies every Command, through one function that fires `mq-change`, and steps undo history, because that updates the text views.
- Each module's host interface takes only the parts of the selection it uses, through the `Selection` type that `selection.ts` exports.

## Alternatives

- **Keep them in the element, in sections.** Shorter imports, but the element would keep every field these need, and copy, paste and duplicate would make it longer again.
- **One module for keys and editing actions together.** Most key actions call an editing action, but the Side panel and the toolbars call the same actions without a key, through `PanelActions`.

## Consequences

- Copy, paste and duplicate each go in `editing-actions.ts`, with their keys in the key map and a key action in `key-dispatch.ts`.
- A new announcement is a call to the announcements module, from the module whose change it describes.
- What each key, drop and announcement does doesn't change.
