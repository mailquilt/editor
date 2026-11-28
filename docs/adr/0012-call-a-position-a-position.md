# Call a position a position

Each meaning that "place" had in the editor's code has a name of its own, each type and helper is in the module that owns it, and the modules the element makes take their host in one way (#215).

Before, "place" meant five things: an element found by its `data-place`, where in the editor a key is answered, where a Block or Row is in the email, the words a screen reader hears for that, and moving a tool or tooltip. Core already called where a Block is its position, as `findBlockPosition` does. The editor's `Selection` was also the name of a ProseMirror class it uses beside it, as was core's and ProseMirror's `Command`, and several modules named a local `document` in a file that also used the page's.

## How

- **Place** is only an element of the editor's own interface that focus, keys, a press or a drag finds by its `data-place`, declared in `editor-places.ts` (ADR 0007).
- **Key scope** is where a key is answered, as the key map names it: the innermost place with keys of its own, or a settings field holding a draft. Its type is `KeyScope`, and the scopes heard before any place are `HeardFirst`.
- **Position** is where a Block or Row is in the email. `positions.ts` holds `BlockPosition`, `RowPosition` and `DropPosition`, the arrow keys' `Direction`, and the Commands that move a Block or Row from one position to another, the drop's too.
- **Label** is how a position is said in words, such as `blockPositionLabel` and the label a Column passes to its Blocks.
- Moving a tool back inside the canvas is **fitting** it, in `tool-fitting.ts`, and a tooltip **moves beside** its control.
- The Side panel's `PanelTab` is the selection module's, which keeps the tab. The dragging module, which drags Rows and palette items as well as Blocks, is `dragging.ts`.
- The selection module's type is `EditorSelection`, and ProseMirror's `Command` is imported as `TextCommand`. An email held in a variable is `email`, never `document`.
- A module the element makes takes one object, typed by its own `…Host` interface and destructured where it's taken. Each takes only what it uses: key dispatch takes three editing actions, and moves along a toolbar by a `ToolbarStep` rather than a key event and the key map's binding.

## Alternatives

- **Keep "place" for the key map too.** A key scope is a place for all but a settings draft, but it's what the key map is keyed by, and the scopes heard first aren't places at all. Joining a place's definition to the key map's is #217's.
- **Keep the host as an object named `host`.** It's the same contract. Destructuring names what each module takes where it's taken, and four modules already did.
- **Call a position a location, or a slot.** Core calls it a position, and a screen reader already hears "position 2 of 3".

## Consequences

- A new name for where something is picks one of these: a place in the interface, a key scope, or a position in the email.
- `data-place`, `editor-places.ts` and its helpers keep their names, as they're the one meaning of place that's left.
- What every key, press, drag and announcement does doesn't change.

## Amendment, 2026-11-28

The Side panel and `PanelTab` are gone ([ADR 0021](./0021-three-modes-and-a-selection-bar.md)), and the selection module no longer keeps a tab. A position is still called a position, and the dragging module is still `dragging.ts`.
