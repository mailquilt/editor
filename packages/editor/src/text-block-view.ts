import type { RichTextDocument } from "@mailquilt/core";
import { EMAIL_LOOK } from "@mailquilt/core/internal";
import { css, unsafeCSS } from "lit";
import { baseKeymap } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";
import { Fragment, Slice } from "prosemirror-model";
import type { MarkType, Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, Plugin, Selection } from "prosemirror-state";
import type { Command as TextCommand, Transaction } from "prosemirror-state";
import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceStep,
} from "prosemirror-transform";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";

import { place } from "./editor-places.js";
import { proseMirrorKeys } from "./key-map.js";
import { mergeTagsFromText } from "./merge-tags.js";
import { pastedHtmlParser, withoutStyles } from "./pasted-html.js";
import { createTextCommands } from "./text-commands.js";
import type { TextFormats, ToggleableMark } from "./text-commands.js";
import type { TextSchema } from "./text-schema.js";

/** ProseMirror's base styles, for a Block's text (ADR 0002). */
export const textBlockStyles = css`
  .ProseMirror {
    font-variant-ligatures: none;
    overflow-wrap: break-word;
    padding: ${unsafeCSS(EMAIL_LOOK.blockPadding)};
    position: relative;
    white-space: pre-wrap;
    white-space: break-spaces;
  }

  .ProseMirror:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  .ProseMirror p {
    margin: 0;
  }

  /* In the Block's color, as the export writes it, and underlined. */
  .ProseMirror a {
    color: inherit;
  }

  /* A Merge Tag, one unit showing its name, in the text's own color. */
  .ProseMirror [data-merge-tag] {
    background: var(--mq-color-accent-soft);
    border-radius: var(--mq-radius-small);
    box-shadow: inset 0 0 0 1px var(--mq-color-outline-hover);
    padding: 0 var(--mq-space-1);
  }

  /*
   * Hidden, but still inline, so a screen reader reads {{name}} with no space
   * added inside the braces, as it would around a block.
   */
  .ProseMirror .merge-tag-brace {
    font-size: 0;
  }
`;

export interface TextBlockView {
  element: HTMLElement;
  /**
   * Shows `content` without reporting a change, and puts the cursor after the
   * text that changed.
   */
  setContent: (content: RichTextDocument) => void;
  /**
   * The email's language, on each paragraph. The text box around them keeps the
   * editor's, as its name is the editor's own.
   */
  setLang: (lang: string) => void;
  focus: () => void;
  formats: () => TextFormats;
  toggleMark: (mark: ToggleableMark) => void;
  insertLineBreak: () => void;
  /**
   * Links the selected text. With none, changes the link the cursor is in, or
   * else adds the URL as the linked text.
   */
  setLink: (href: string) => void;
  removeLink: () => void;
  destroy: () => void;
}

/**
 * Formatting is its own undo step, unlike the typing around it. A line break
 * counts as formatting, as it's added from the format bar too.
 */
const changesFormatting = ({ steps }: Transaction) =>
  steps.some(
    (step) =>
      step instanceof AddMarkStep ||
      step instanceof RemoveMarkStep ||
      (step instanceof ReplaceStep &&
        step.slice.content.firstChild?.type.name === "hardBreak")
  );

/** Marks what `setContent` shows, as on undo, which isn't the user's to report. */
const FROM_SET_CONTENT = "mailquilt:fromSetContent";

/**
 * Where the cursor belongs once `current` has become `next`, or undefined if
 * they match. Removing the "l" typed in "Hell|lo" could be read as a change at
 * several points, so the cursor's own position chooses between them.
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

/** Marks a focus change: true when the text gains focus, false when it loses it. */
const FOCUSED = "mailquilt:focused";

/**
 * Pasted or dropped text with each tab as a space, and no bold for a Block that
 * can't have it. The canvas would show a tab at a tab stop, which no email
 * client can draw, and the export as one space.
 */
const asPasted = (fragment: Fragment, bold?: MarkType): Fragment =>
  Fragment.from(
    fragment.content.map((node) => {
      if (!node.isLeaf) {
        return node.copy(asPasted(node.content, bold));
      }
      const marks = bold ? bold.removeFromSet(node.marks) : node.marks;
      const text = node.text ?? "";
      return node.isText && text.includes("\t")
        ? node.type.schema.text(text.replaceAll("\t", " "), marks)
        : node.mark(marks);
    })
  );

interface TextBlockViewHost {
  /** False for text that's bold already, where the mark would change nothing. */
  canBold: boolean;
  content: RichTextDocument;
  /** What a screen reader calls the text box. */
  label: string;
  onChange: (content: RichTextDocument) => void;
  onFocus: () => void;
  /**
   * Called for each key the text's own keys, or ProseMirror's base keys,
   * answered, which the key map then leaves alone.
   */
  onKeyAnswered: (event: KeyboardEvent) => void;
  /** Called after anything that may change what `formats` returns. */
  onStateChange: () => void;
  /** Called when the next change shouldn't merge with the last as typing. */
  onTypingBreak: () => void;
  /** What the Block's type of text can hold. */
  schema: TextSchema;
}

/**
 * Owns the DOM and ProseMirror view of one Block's text. Lit only puts
 * `element` on the canvas, so the view survives re-renders. The editor keeps
 * the one undo history, so ProseMirror's isn't loaded.
 */
export const createTextBlockView = ({
  canBold,
  content,
  label,
  onChange,
  onFocus,
  onKeyAnswered,
  onStateChange,
  onTypingBreak,
  schema,
}: TextBlockViewHost): TextBlockView => {
  const element = document.createElement("div");
  // Unknown until set, as in the export of an email with no language.
  let lang = "";
  const commands = createTextCommands(schema, { canBold });
  const textKeys = proseMirrorKeys();
  const answerTextKey = keydownHandler(
    Object.fromEntries(
      textKeys.map(([key, action]) => [key, commands.forKey[action]])
    )
  );
  // The keys the key map leaves to ProseMirror, such as Backspace.
  const answerBaseKey = keydownHandler(
    Object.fromEntries(
      Object.entries(baseKeymap).filter(
        ([key]) => !textKeys.some(([named]) => named === key)
      )
    )
  );

  const view = new EditorView(element, {
    attributes: {
      "aria-label": label,
      "aria-multiline": "true",
      "data-place": place("text"),
      role: "textbox",
      tabindex: "0",
    },
    clipboardParser: pastedHtmlParser(schema),
    decorations: ({ doc }) => {
      const paragraphs: Decoration[] = [];
      let offset = 0;
      for (const paragraph of doc.content.content) {
        paragraphs.push(
          Decoration.node(offset, offset + paragraph.nodeSize, { lang })
        );
        offset += paragraph.nodeSize;
      }
      return DecorationSet.create(doc, paragraphs);
    },
    dispatchTransaction(this: EditorView, transaction: Transaction) {
      // The editor can still call a view it has taken down.
      if (this.isDestroyed) {
        return;
      }
      const before = this.state;
      // With what plugins add to it.
      const { state: after } = before.applyTransaction(transaction);
      this.updateState(after);
      // Turning bold on at the cursor changes the next text but not the email.
      if (transaction.storedMarksSet && !transaction.docChanged) {
        onTypingBreak();
      }
      onStateChange();
      if (!before.selection.eq(after.selection) && !transaction.docChanged) {
        onTypingBreak();
      }
      const focused = transaction.getMeta(FOCUSED) as boolean | undefined;
      if (focused === true) {
        onFocus();
      } else if (focused === false) {
        onTypingBreak();
      }
      if (transaction.getMeta(FROM_SET_CONTENT) || before.doc.eq(after.doc)) {
        return;
      }
      // ProseMirror marks a paste, cut or drop, which are never typing.
      const isTyping =
        transaction.getMeta("uiEvent") === undefined &&
        !changesFormatting(transaction);
      if (!isTyping) {
        onTypingBreak();
      }
      onChange(after.doc.toJSON() as RichTextDocument);
      if (!isTyping) {
        onTypingBreak();
      }
    },
    handleDOMEvents: {
      blur: ({ dispatch, state }) => {
        dispatch(state.tr.setMeta(FOCUSED, false));
        return false;
      },
      // A page's router, such as Astro's or Turbo's, follows a click on any
      // link to its own site, even inside the editor, unless it's handled.
      click: (_view, event) => {
        if ((event.target as Element).closest("a")) {
          event.preventDefault();
        }
        return false;
      },
      focus: ({ dispatch, state }) => {
        dispatch(state.tr.setMeta(FOCUSED, true));
        return false;
      },
    },
    state: EditorState.create({
      doc: schema.nodeFromJSON(content),
      plugins: [
        new Plugin({
          props: {
            handleKeyDown: (target, event) => {
              const answered =
                answerTextKey(target, event) || answerBaseKey(target, event);
              if (answered) {
                onKeyAnswered(event);
              }
              return answered;
            },
          },
        }),
        mergeTagsFromText(
          schema,
          (transaction) => transaction.getMeta(FROM_SET_CONTENT) === true
        ),
      ],
    }),
    transformPasted: (slice) =>
      new Slice(
        asPasted(slice.content, canBold ? undefined : schema.marks.bold),
        slice.openStart,
        slice.openEnd
      ),
    transformPastedHTML: withoutStyles,
  });

  /** Runs a command on the text, then puts focus back in it. */
  const run = (command: TextCommand) => {
    command(view.state, view.dispatch);
    view.focus();
  };

  return {
    destroy: () => view.destroy(),
    element,
    focus: () => view.focus(),
    formats: () => commands.formats(view.state),
    insertLineBreak: () => run(commands.insertLineBreak),
    removeLink: () => run(commands.removeLink),
    setContent: (next) => {
      const { doc, selection } = view.state;
      const nextDoc = schema.nodeFromJSON(next);
      const cursor = cursorAfterChange(doc, nextDoc, selection.head);
      if (cursor === undefined) {
        return;
      }
      // Undoing a format change leaves every position where it was.
      const keepsSelection =
        doc.content.size === nextDoc.content.size &&
        doc.textContent === nextDoc.textContent;
      const tr = view.state.tr.replaceWith(
        0,
        doc.content.size,
        nextDoc.content
      );
      // The position can fall between paragraphs, which can't hold a cursor.
      tr.setSelection(
        keepsSelection
          ? selection.getBookmark().resolve(tr.doc)
          : Selection.near(tr.doc.resolve(cursor))
      );
      view.dispatch(tr.setMeta(FROM_SET_CONTENT, true));
    },
    setLang: (next) => {
      if (next !== lang) {
        lang = next;
        // Reads the decorations again.
        view.updateState(view.state);
      }
    },
    setLink: (href) => run(commands.setLink(href)),
    toggleMark: (mark) => run(commands.toggleMark(mark)),
  };
};
