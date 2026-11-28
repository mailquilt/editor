# Find the editor's places by name

Each place in the editor that focus, keys, a press or a drag finds is declared once, in `packages/editor/src/editor-places.ts`, and an element is one by its `data-place`. Nothing finds the editor's own elements by a class, which is for styles (#175).

Before, selection, key handling and dragging each kept their own list of class selectors. The key handler matched eight of them in order to learn where a key was pressed, selection matched another six to learn where focus was, and dragging found Blocks, Rows and Columns with a third set. A popup that takes focus, such as the Merge Tag picker that comes next, would have meant editing all three lists and keeping their order in step.

## How

- `editor-places.ts` names every place and what each one does about a press. `closestPlace`, `findPlace` and `placeOf` find them, and leave out the copy a drag shows under the pointer.
- A place with keys of its own has them in the key map under the same name. The key handler takes the innermost place around the key that the key map has keys for, so a new place needs no list kept in order.
- A press on a drag handle, a Row's tag, a toolbar, the format bar, the floating toolbar or a group of the Side panel's buttons leaves focus where it is. Each of those places says what a press does where it's declared, and selection hears every press in the editor in one listener, so the templates pass no mouse events on.
- Input to a Block's text is checked where the email hears it, and nothing else is. A field drawn inside a Block, such as the link field, keeps its own typing and undo without stopping the event itself.
- The panel interface carries no DOM events or elements. A settings field reports what's typed in it, and a refused one is tried again from what it reported. Back is found by its `data-action`, as the toolbars' buttons are.
- The Side panel's tab moved to the selection module, beside whether the panel shows what's selected, so its view has one owner.

## Alternatives

- **One table of selectors.** It would gather the lists, but a class would still do two jobs, and a style change could break focus.
- **Test IDs.** They're for tests, and a test ID isn't there for every place, such as the link field.

## Consequences

- A new place is one name in `editor-places.ts`, `data-place` on its element, and its keys in the key map if it has any. Focus moving into it is a target in the selection module, as for the link field.
- The editor's CSS keeps its classes, and they can change without touching behaviour.
- What each key, press and drag does doesn't change.

## Amendment, 2026-11-28

The Side panel is gone, replaced by the Modes and the Selection bar ([ADR 0021](./0021-three-modes-and-a-selection-bar.md)), so its tab and the group of its buttons are no longer places. The decision, that a place is found by name and says what a press does where it's declared, stands.
