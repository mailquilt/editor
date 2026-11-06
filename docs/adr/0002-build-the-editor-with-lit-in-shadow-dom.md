# Build the editor with Lit in Shadow DOM

The editor is a Lit Web Component that renders in Shadow DOM, with `@dnd-kit/dom` for dragging and Tiptap for text, because that isolates the canvas from host-page CSS and adds no framework for non-React hosts. Lit added 5.8 KB gzipped against 69 KB for React and React DOM, which would also have meant a hidden React in Vue, Svelte and plain JS apps and a second copy in React apps. A throwaway test on a React page with Tailwind's reset and unfriendly CSS passed drag and drop, text editing, copy/paste and undo in Chromium, Firefox and WebKit, and the drag, selection, bold and copy/paste checks passed by hand in real Safari. Simulated Japanese input passed in Chromium.

## Consequences

- Dragging uses `Draggable` and `Droppable` with the drop position worked out when the drag ends, not `Sortable`, which has an open Shadow DOM issue (dnd-kit #1967) and was not tested.
- Block elements are created once and moved between Columns rather than re-rendered, so each Tiptap editor survives a move.
- ProseMirror's base styles are defined inside the Shadow DOM.
- Not yet tested: Japanese input in real Safari and Firefox, touch, and auto-scrolling while dragging. If any of these fail, the fallbacks are custom pointer events for dragging and an iframe canvas for text editing, then light DOM.
