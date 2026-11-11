# Edit text with ProseMirror directly

Text and Heading Blocks are edited with ProseMirror's own modules, not Tiptap. Tiptap is a layer over ProseMirror, and the editor used little of it: a schema of paragraphs, line breaks and four marks, and a few commands such as toggling a mark. Its core still brought about 90 KB minified, about a fifth of the editor's page load, and ProseMirror modules the editor didn't use, such as lists and history. ProseMirror itself stays, because its view is what makes editable text work across browsers, input methods and mobile keyboards.

## Consequences

- The stored JSON doesn't change. Tiptap's JSON is ProseMirror's, and the schema keeps Tiptap's names (`hardBreak`, `bold`, `italic`, `underline`, `link`) and mark order, so saved emails open as before (ADR 0001).
- The schema keeps the HTML rules of Tiptap's extensions, so pasted text is read the same way. Links still go through `core`'s check.
- The editor keeps Tiptap's behaviour where ProseMirror's own commands differ. Formatting part of a selection formats all of it, Enter and line breaks keep the formatting, and Delete in an empty paragraph removes it.
- Roadmap features use ProseMirror modules directly: `prosemirror-schema-list` for lists and `y-prosemirror` for collaboration. The Merge Tag picker needs its own plugin, which Tiptap would otherwise have provided.
