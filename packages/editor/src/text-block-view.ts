import type { RichTextDocument } from "@mailquilt/core";
import { Editor } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";

export interface TextBlockView {
  element: HTMLElement;
  destroy: () => void;
}

/**
 * Owns the DOM and Tiptap editor of one Text Block. Lit only places `element`
 * on the canvas, so the Tiptap editor survives re-renders.
 *
 * Tiptap's history stays off because its extension isn't loaded (ADR 0002).
 */
export const createTextBlockView = (
  content: RichTextDocument,
  onChange: (content: RichTextDocument) => void
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
    onUpdate: () => onChange(editor.getJSON() as RichTextDocument),
  });

  return { destroy: () => editor.destroy(), element };
};
