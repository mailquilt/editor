# Split the editor's largest modules, and keep no state twice

The panels' interface is two parts by type, `<mail-quilt>` reads the current email from core, which checks a document once, and the selection and dragging modules are split by concern (#219).

Before, `PanelApi` was state and actions, and a comment said the last few members of each were the editor's own panels' state. Its actions held a read, the settings fields' drafts, and a raw `apply` that only the Row layout buttons called. The element kept a copy of the email it last sent or received, beside core's, against ADR 0004's "no state is kept in two places", and checked a new `value`, which `createEditor()` then checked again. The selection module held six concerns in 24 members: what's selected, whether its text is edited, what the Side panel shows, where focus goes, what scrolls into view, and what a press does. The workspace's click rule was in the element. The dragging module was 616 lines, most of it one function, with auto-scroll and the ghost inside.

## How

- `PanelApi` is `EmailPanelApi`, what a host's own panel would need, and `OwnPanelsApi`, the Side panel's view, the link field and the settings fields' drafts. The drafts are a member of their own, and the Row layout buttons call `setRowLayout`.
- `<mail-quilt>` compares a new `value` with core's current email, and keeps no copy. Core's internal `editorOfLoaded` starts an Editor from what `loadDocument` accepted, which its type asks for, so the value's setter checks it, and core doesn't again.
- `selection.ts` has what's selected, whether its text is edited, and what the Side panel shows. `focus.ts` has where focus is and goes, and what scrolls into view after an update. `presses.ts` has what a press, a click on the workspace, or the wheel does to them. Each takes only what it uses of the others.
- Focus is read from the element's shadow root, as the active element there. That holds because the root holds every place and no shadow root inside it, which the focus module now says where it takes the root, rather than leaving it assumed.
- `auto-scroll.ts` scrolls what the editor is in during a drag, and `drag-ghost.ts` makes the copy that follows the pointer.

## Measured

A keystroke and an Alt+↓ move on an email of 600 Text Blocks, 235 KB as JSON, in the Shell with `save-key`, from the key's press to `mq-change` and to the next frame, the median of 30:

| | Keystroke | Move |
| --- | --- | --- |
| Before, Chromium, Firefox, WebKit | 9, 7, 8 ms; 13, 9, 15 ms | 10, 9, 11 ms; 27, 26, 35 ms |
| After | 5, 5, 6 ms; 9, 7, 12 ms | 6, 7, 8 ms; 22, 23, 30 ms |

Saving to `localStorage` adds about a millisecond, so the Shell still saves each change at once. At 2,400 Blocks, 945 KB, a keystroke took 22 ms to the next frame in Chromium before the change.

## Alternatives

- **Keep the copy of the email, and compare against it.** It saves a copy when a host sets `value`, at the cost of a second email to keep in step with core's. A keystroke without a controlled host copies the email once less.
- **Have the element catch `createEditor()`'s error, and drop its own check.** It would make an Editor to compare a migrated document against the current email, and pass an unchecked value as a `BlocksDocument`.
- **Delay the Shell's saving.** The measurement doesn't call for it, and a delay is a window in which a closed tab loses the last change.

## Consequences

- Selection and focus each have one owner, as ADR 0004 asks, in two modules rather than one, and presses a third. What each key, press and drop does doesn't change.
- A host's own panel, if the editor is offered in parts, is documented from `EmailPanelApi`. A change to a Block's settings goes through the settings fields' drafts today, and would need an action of its own there.
- `editorOfLoaded` is in `@mailquilt/core/internal`, and not a promise to hosts.
