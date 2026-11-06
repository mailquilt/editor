import type { RichTextDocument } from "@mailquilt/core";
import { Editor } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";

export interface TextBlockView {
  element: HTMLElement;
  /**
   * Shows `content` without reporting a change, and puts the cursor after the
   * text that changed.
   */
  setContent: (content: RichTextDocument) => void;
  destroy: () => void;
}

/**
 * Where the cursor belongs once `current` has become `next`, or undefined if
 * they match. Removing the "l" typed in "Hell|lo" could be read as a change at
 * several places, so the cursor's own position chooses between them.
 */
const cursorAfterChange = (
  current: ProseMirrorNode,
  next: ProseMirrorNode,
  cursor: number
) => {
  const start = current.content.findDiffStart(next.content);
  const end = next.content.findDiffEnd(current.content);
  if (start === null || !end) {
    return;
  }
  const moved = cursor + next.content.size - current.content.size;
  return Math.max(
    Math.min(start, end.a),
    Math.min(moved, Math.max(start, end.a))
  );
};

/**
 * Owns the DOM and Tiptap editor of one Text Block. Lit only places `element`
 * on the canvas, so the Tiptap editor survives re-renders.
 *
 * Tiptap's history stays off because its extension isn't loaded (ADR 0002).
 */
export const createTextBlockView = (
  content: RichTextDocument,
  onChange: (content: RichTextDocument) => void,
  /** Called when the next change shouldn't merge with the last as typing. */
  onTypingBreak: () => void
): TextBlockView => {
  const element = document.createElement("div");
  const editor = new Editor({
    content,
    editorProps: {
      attributes: {
        "aria-label": "Text Block",
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    element,
    extensions: [Document, Paragraph, Text],
    // Tiptap would add this CSS to the host page. See the canvas styles instead.
    injectCSS: false,
    onBlur: onTypingBreak,
    onSelectionUpdate: ({ transaction }) => {
      if (!transaction.docChanged) {
        onTypingBreak();
      }
    },
    onUpdate: ({ transaction }) => {
      // ProseMirror marks a paste, cut or drop, which are never typing.
      const isTyping = transaction.getMeta("uiEvent") === undefined;
      if (!isTyping) {
        onTypingBreak();
      }
      onChange(editor.getJSON() as RichTextDocument);
      if (!isTyping) {
        onTypingBreak();
      }
    },
  });

  return {
    destroy: () => editor.destroy(),
    element,
    setContent: (next) => {
      const { doc, selection } = editor.state;
      const cursor = cursorAfterChange(
        doc,
        editor.schema.nodeFromJSON(next),
        selection.head
      );
      if (cursor === undefined) {
        return;
      }
      editor
        .chain()
        .setContent(next, { emitUpdate: false })
        .command(({ tr }) => {
          // The position can fall between paragraphs, which can't hold a cursor.
          tr.setSelection(Selection.near(tr.doc.resolve(cursor)));
          return true;
        })
        .run();
    },
  };
};
