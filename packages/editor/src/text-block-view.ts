import { isAllowedLinkHref } from "@mailquilt/core";
import type { RichTextDocument } from "@mailquilt/core";
import { Editor, Mark } from "@tiptap/core";
import { Bold } from "@tiptap/extension-bold";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Italic } from "@tiptap/extension-italic";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Underline } from "@tiptap/extension-underline";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import { AddMarkStep, RemoveMarkStep, ReplaceStep } from "@tiptap/pm/transform";

export type ToggleableMark = "bold" | "italic" | "underline";

/** What the toolbar shows for the cursor or selection. */
export type TextFormats = Record<ToggleableMark, boolean> & {
  linkHref: string | undefined;
};

export interface TextBlockView {
  element: HTMLElement;
  /**
   * Shows `content` without reporting a change, and puts the cursor after the
   * text that changed.
   */
  setContent: (content: RichTextDocument) => void;
  focus: () => void;
  formats: () => TextFormats;
  toggleMark: (mark: ToggleableMark) => void;
  insertLineBreak: () => void;
  /** Links the selected text. With none, adds the URL as the linked text. */
  setLink: (href: string) => void;
  removeLink: () => void;
  destroy: () => void;
}

/**
 * Stores only the URL, as `core` requires. Tiptap's own Link extension brings
 * more attributes and auto-linking that would need turning off, and its library.
 * Parsing goes through core's check, so a pasted link can't get past it.
 */
const Link = Mark.create({
  addAttributes: () => ({ href: { default: null } }),
  inclusive: false,
  name: "link",
  parseHTML: () => [
    {
      getAttrs: (element) =>
        isAllowedLinkHref(element.getAttribute("href") ?? "") ? null : false,
      tag: "a[href]",
    },
  ],
  // Above the other marks, so that a link stays in one piece on the canvas.
  priority: 1000,
  renderHTML: ({ HTMLAttributes }) => ["a", HTMLAttributes, 0],
});

/** Formatting is its own undo step, unlike the typing around it. */
const changesFormatting = ({ steps }: Transaction) =>
  steps.some(
    (step) =>
      step instanceof AddMarkStep ||
      step instanceof RemoveMarkStep ||
      (step instanceof ReplaceStep &&
        step.slice.content.firstChild?.type.name === "hardBreak")
  );

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
export const createTextBlockView = ({
  content,
  onChange,
  onFocus,
  onStateChange,
  onTypingBreak,
}: {
  content: RichTextDocument;
  onChange: (content: RichTextDocument) => void;
  onFocus: () => void;
  /** Called after anything that may change what `formats` returns. */
  onStateChange: () => void;
  /** Called when the next change shouldn't merge with the last as typing. */
  onTypingBreak: () => void;
}): TextBlockView => {
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
    // These would turn typed or pasted text such as *this* into formatting.
    enableInputRules: false,
    enablePasteRules: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Underline,
      HardBreak,
      Link,
    ],
    // Tiptap would add this CSS to the host page. See the canvas styles instead.
    injectCSS: false,
    onBlur: onTypingBreak,
    onFocus,
    onSelectionUpdate: ({ transaction }) => {
      if (!transaction.docChanged) {
        onTypingBreak();
      }
    },
    onTransaction: ({ transaction }) => {
      // Turning bold on at the cursor changes the next text but not the email.
      if (transaction.storedMarksSet && !transaction.docChanged) {
        onTypingBreak();
      }
      onStateChange();
    },
    onUpdate: ({ transaction }) => {
      // ProseMirror marks a paste, cut or drop, which are never typing.
      const isTyping =
        transaction.getMeta("uiEvent") === undefined &&
        !changesFormatting(transaction);
      if (!isTyping) {
        onTypingBreak();
      }
      onChange(editor.getJSON() as RichTextDocument);
      if (!isTyping) {
        onTypingBreak();
      }
    },
  });

  /**
   * Not Tiptap's focus command, which restores the selection a frame after
   * focusing. WebKit overwrites the selection in between.
   */
  const focus = () => editor.view.focus();

  return {
    destroy: () => editor.destroy(),
    element,
    focus,
    formats: () => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      linkHref: editor.isActive("link")
        ? (editor.getAttributes("link").href as string)
        : undefined,
      underline: editor.isActive("underline"),
    }),
    insertLineBreak: () => {
      editor.commands.setHardBreak();
      focus();
    },
    removeLink: () => {
      editor.commands.unsetMark("link", { extendEmptyMarkRange: true });
      focus();
    },
    setContent: (next) => {
      const { doc, selection } = editor.state;
      const nextDoc = editor.schema.nodeFromJSON(next);
      const cursor = cursorAfterChange(doc, nextDoc, selection.head);
      if (cursor === undefined) {
        return;
      }
      // Undoing a format change leaves every position where it was.
      const keepsSelection =
        doc.content.size === nextDoc.content.size &&
        doc.textContent === nextDoc.textContent;
      editor
        .chain()
        .setContent(next, { emitUpdate: false })
        .command(({ tr }) => {
          // The position can fall between paragraphs, which can't hold a cursor.
          const moved = Selection.near(tr.doc.resolve(cursor));
          tr.setSelection(
            keepsSelection ? selection.getBookmark().resolve(tr.doc) : moved
          );
          return true;
        })
        .run();
    },
    setLink: (href) => {
      const { doc, selection } = editor.state;
      const { empty, from, to } = selection;
      const chain = editor.chain();
      if (doc.textBetween(from, to)) {
        chain.setMark("link", { href }).run();
      } else if (empty && editor.isActive("link")) {
        chain
          .extendMarkRange("link")
          .setMark("link", { href })
          .setTextSelection(from)
          .run();
      } else {
        chain
          .command(({ state, tr }) => {
            tr.insertText(href);
            const end = tr.selection.from;
            tr.addMark(
              end - href.length,
              end,
              state.schema.mark("link", { href })
            );
            return true;
          })
          .run();
      }
      focus();
    },
    toggleMark: (mark) => {
      editor.commands.toggleMark(mark);
      focus();
    },
  };
};
