# Build the editor with Lit in Shadow DOM

The editor is a Lit Web Component that renders in Shadow DOM, with `@dnd-kit/dom` for dragging and Tiptap for text, because that isolates the canvas from host-page CSS and adds no framework for non-React hosts. Lit added 5.8 KB gzipped against 69 KB for React and React DOM, which would also have meant a hidden React in Vue, Svelte and plain JS apps and a second copy in React apps. A throwaway test on a React page with Tailwind's reset and unfriendly CSS passed drag and drop, text editing, copy/paste and undo in Chromium, Firefox and WebKit, and the drag, selection, bold and copy/paste checks passed by hand in real Safari. Simulated Japanese input passed in Chromium.

## Consequences

- The drop position is worked out when the drag ends, so nothing on the canvas moves until then.
- Each text editor's element is created once and moved between Columns rather than re-rendered, so it survives a move. The rest of a Block is drawn again in its new Column. Text is edited with ProseMirror directly since ADR 0003.
- ProseMirror's base styles are defined inside the Shadow DOM.
- Auto-scrolling uses the host element's scroll containers, outside the Shadow DOM. Browser tests cover this in Chromium, Firefox and WebKit.
- Not yet tested: Japanese input in real Safari and Firefox, and touch. If text editing fails, the fallbacks are an iframe canvas, then light DOM.

## Amendment: dragging with our own pointer events

`@dnd-kit/dom` was replaced with the editor's own pointer-event dragging, under 600 lines with comments. By then the editor already worked out drop positions itself, because dnd-kit's own target lagged behind the pointer. It avoided dnd-kit's `Sortable` because of its Shadow DOM issue, and gave dnd-kit's auto-scrolling the scroll containers it couldn't find past the Shadow DOM boundary. What dnd-kit still did was start a drag after 5px, show a copy that follows the pointer, auto-scroll and set the cursor. That was 92 KB minified, about 17% of the editor, from a pre-1.0 library.

The copy that follows the pointer is an inert clone, fixed to the window and shown as a popover so that it's in the top layer. The dragged Block or Row stays where it is, unseen, so its text editor, focus and cursor never move. Later drags on the roadmap, such as saved Rows and a media library, can use the same code.
