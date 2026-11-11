import { isAllowedLinkHref } from "@mailquilt/core";
import type { RichTextDocument } from "@mailquilt/core";
import {
  baseKeymap,
  chainCommands,
  createParagraphNear,
  deleteSelection,
  joinForward,
  liftEmptyBlock,
  newlineInCode,
  selectNodeForward,
  splitBlockKeepMarks,
} from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import type {
  Mark,
  MarkType,
  Node as ProseMirrorNode,
  ResolvedPos,
} from "prosemirror-model";
import { EditorState, Selection, TextSelection } from "prosemirror-state";
import type { Command, Transaction } from "prosemirror-state";
import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceStep,
} from "prosemirror-transform";
import { EditorView } from "prosemirror-view";

export type ToggleableMark = "bold" | "italic" | "underline";

/** What the toolbar shows for the cursor or selection. */
export type TextFormats = Record<ToggleableMark, boolean> & {
  canBold: boolean;
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
 * The JSON of ADR 0001, with the names and HTML rules Tiptap's extensions had
 * (ADR 0003), so saved and pasted text read as they did. Marks are listed in the
 * order the JSON lists them, with links first so they stay around the others.
 */
const schema = new Schema({
  // oxlint-disable-next-line sort-keys -- The order is the JSON's.
  marks: {
    // Only the URL, as `core` requires. Parsing goes through core's check, so a
    // pasted link can't get past it.
    link: {
      attrs: { href: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          getAttrs: (element) => {
            const href = element.getAttribute("href") ?? "";
            return isAllowedLinkHref(href) ? { href } : false;
          },
          tag: "a[href]",
        },
      ],
      toDOM: ({ attrs }) => ["a", { href: attrs.href }, 0],
    },
    bold: {
      parseDOM: [
        { tag: "strong" },
        {
          getAttrs: (element) => element.style.fontWeight !== "normal" && null,
          tag: "b",
        },
        {
          clearMark: (mark) => mark.type.name === "bold",
          style: "font-weight=400",
        },
        {
          getAttrs: (value) =>
            /^(?:bold(?:er)?|[5-9]\d{2,})$/u.test(value) && null,
          style: "font-weight",
        },
      ],
      toDOM: () => ["strong", 0],
    },
    italic: {
      parseDOM: [
        { tag: "em" },
        {
          getAttrs: (element) => element.style.fontStyle !== "normal" && null,
          tag: "i",
        },
        {
          clearMark: (mark) => mark.type.name === "italic",
          style: "font-style=normal",
        },
        { style: "font-style=italic" },
      ],
      toDOM: () => ["em", 0],
    },
    underline: {
      parseDOM: [
        { tag: "u" },
        {
          consuming: false,
          getAttrs: (value) => (value.includes("underline") ? {} : false),
          style: "text-decoration",
        },
      ],
      toDOM: () => ["u", 0],
    },
  },
  nodes: {
    doc: { content: "block+" },
    hardBreak: {
      group: "inline",
      inline: true,
      // A line of its own when copied as plain text.
      leafText: () => "\n",
      linebreakReplacement: true,
      parseDOM: [{ tag: "br" }],
      selectable: false,
      toDOM: () => ["br"],
    },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    text: { group: "inline" },
  },
});

const { link } = schema.marks;

/**
 * At a cursor, whether typing would get the mark. Over a selection, whether all
 * of its text has it, so that formatting part of a selection formats all of it.
 */
const isMarkActive = (state: EditorState, type: MarkType) => {
  const { empty, ranges } = state.selection;
  if (empty) {
    return Boolean(
      type.isInSet(state.storedMarks ?? state.selection.$from.marks())
    );
  }
  const pieces = ranges.flatMap(({ $from, $to }) => {
    const found: { length: number; marked: boolean }[] = [];
    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.isText || node.marks.length > 0) {
        found.push({
          length:
            Math.min($to.pos, pos + node.nodeSize) - Math.max($from.pos, pos),
          marked: Boolean(type.isInSet(node.marks)),
        });
      }
    });
    return found;
  });
  const selected = pieces.reduce((sum, { length }) => sum + length, 0);
  const marked = pieces
    .filter((piece) => piece.marked)
    .reduce((sum, { length }) => sum + length, 0);
  return selected > 0 && marked >= selected;
};

/** The link at the cursor, or the first one in the selection. */
const linkHrefAt = ({ doc, selection, storedMarks }: EditorState) => {
  const marks: readonly Mark[] = selection.empty
    ? [...(storedMarks ?? []), ...selection.$head.marks()]
    : (() => {
        const found: Mark[] = [];
        doc.nodesBetween(selection.from, selection.to, (node) => {
          found.push(...node.marks);
        });
        return found;
      })();
  return link.isInSet(marks)?.attrs.href as string | undefined;
};

const findLink = (marks: readonly Mark[], href?: string) =>
  marks.find(
    (mark) =>
      mark.type === link && (href === undefined || mark.attrs.href === href)
  );

/** The whole of the link beside `$pos`, as far as the same URL goes. */
const linkRangeAt = ($pos: ResolvedPos, href?: string) => {
  const { parent } = $pos;
  let start = parent.childAfter($pos.parentOffset);
  if (!(start.node && findLink(start.node.marks))) {
    start = parent.childBefore($pos.parentOffset);
  }
  const mark = start.node && findLink(start.node.marks, href);
  if (!(start.node && mark)) {
    return;
  }
  const sameLink = (index: number) =>
    Boolean(findLink(parent.child(index).marks, mark.attrs.href as string));
  let startIndex = start.index;
  let from = $pos.start() + start.offset;
  let endIndex = startIndex + 1;
  let to = from + start.node.nodeSize;
  while (startIndex > 0 && sameLink(startIndex - 1)) {
    startIndex -= 1;
    from -= parent.child(startIndex).nodeSize;
  }
  while (endIndex < parent.childCount && sameLink(endIndex)) {
    to += parent.child(endIndex).nodeSize;
    endIndex += 1;
  }
  return { from, to };
};

/** Takes a mark off the selection, and off what's typed next. */
const removeMark = (tr: Transaction, type: MarkType) => {
  for (const { $from, $to } of tr.selection.ranges) {
    tr.removeMark($from.pos, $to.pos, type);
  }
  return tr.removeStoredMark(type);
};

/** Puts a mark on the selection, or on what's typed next at a cursor. */
const addMark = (tr: Transaction, mark: Mark) => {
  if (tr.selection.empty) {
    return tr.addStoredMark(mark);
  }
  for (const { $from, $to } of tr.selection.ranges) {
    tr.addMark($from.pos, $to.pos, mark);
  }
  return tr;
};

/** Takes a mark off if all of the selection has it, or puts it on all of it. */
const toggleMark =
  (type: MarkType): Command =>
  (state, dispatch) => {
    dispatch?.(
      isMarkActive(state, type)
        ? removeMark(state.tr, type)
        : addMark(state.tr, type.create())
    );
    return true;
  };

/** Delete in an empty paragraph removes it, as Tiptap's Delete did. */
const deleteEmptyParagraph: Command = (state, dispatch) => {
  const { $anchor, empty } = state.selection;
  if (!empty || $anchor.parent.content.size > 0) {
    return false;
  }
  dispatch?.(
    state.tr.delete($anchor.before(), $anchor.after()).scrollIntoView()
  );
  return true;
};

/** A line break that keeps the formatting, so typing after it carries on. */
const insertHardBreak: Command = (state, dispatch) => {
  const { $from, $to, from, to } = state.selection;
  const marks = state.storedMarks ?? ($to.parentOffset ? $from.marks() : null);
  if (dispatch) {
    const tr = state.tr.replaceWith(from, to, schema.nodes.hardBreak.create());
    if (marks) {
      tr.ensureMarks(marks);
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * ProseMirror's own keys, with Enter keeping the formatting, Delete removing an
 * empty paragraph, and Shift+Enter or Mod+Enter for a line break, as Tiptap had.
 */
const editingKeys = Object.fromEntries(
  Object.entries(baseKeymap).map(([key, command]) => {
    if (command === baseKeymap.Enter) {
      return [
        key,
        chainCommands(
          newlineInCode,
          createParagraphNear,
          liftEmptyBlock,
          splitBlockKeepMarks
        ),
      ];
    }
    if (command === baseKeymap.Delete) {
      return [
        key,
        chainCommands(
          deleteSelection,
          deleteEmptyParagraph,
          joinForward,
          selectNodeForward
        ),
      ];
    }
    return [key, command];
  })
);

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

/** Marks a change the host made, which isn't the user's to report. */
const FROM_HOST = "mailquilt:fromHost";

/**
 * Owns the DOM and ProseMirror view of one Block's text. Lit only places
 * `element` on the canvas, so the view survives re-renders. The editor keeps
 * the one undo history, so ProseMirror's isn't loaded.
 */
export const createTextBlockView = ({
  canBold,
  content,
  label,
  onChange,
  onFocus,
  onStateChange,
  onTypingBreak,
}: {
  /** False for text that's bold already, where the mark would change nothing. */
  canBold: boolean;
  content: RichTextDocument;
  /** What a screen reader calls the text box. */
  label: string;
  onChange: (content: RichTextDocument) => void;
  onFocus: () => void;
  /** Called after anything that may change what `formats` returns. */
  onStateChange: () => void;
  /** Called when the next change shouldn't merge with the last as typing. */
  onTypingBreak: () => void;
}): TextBlockView => {
  const element = document.createElement("div");
  // Where bold would change nothing, its shortcut is still taken, or the
  // browser would make the text bold itself.
  const bold: Command = canBold ? toggleMark(schema.marks.bold) : () => true;

  const view = new EditorView(element, {
    attributes: {
      "aria-label": label,
      "aria-multiline": "true",
      role: "textbox",
      tabindex: "0",
    },
    dispatchTransaction(this: EditorView, transaction: Transaction) {
      // A blur can still come while the view is taken down.
      if (this.isDestroyed) {
        return;
      }
      const before = this.state;
      const after = before.apply(transaction);
      this.updateState(after);
      // Turning bold on at the cursor changes the next text but not the email.
      if (transaction.storedMarksSet && !transaction.docChanged) {
        onTypingBreak();
      }
      onStateChange();
      if (!before.selection.eq(after.selection) && !transaction.docChanged) {
        onTypingBreak();
      }
      if (transaction.getMeta("focus")) {
        onFocus();
      }
      if (transaction.getMeta("blur")) {
        onTypingBreak();
      }
      if (transaction.getMeta(FROM_HOST) || before.doc.eq(after.doc)) {
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
        dispatch(state.tr.setMeta("blur", true));
        return false;
      },
      focus: ({ dispatch, state }) => {
        dispatch(state.tr.setMeta("focus", true));
        return false;
      },
    },
    state: EditorState.create({
      doc: schema.nodeFromJSON(content),
      plugins: [
        keymap({
          "Mod-B": bold,
          "Mod-Enter": insertHardBreak,
          "Mod-I": toggleMark(schema.marks.italic),
          "Mod-U": toggleMark(schema.marks.underline),
          "Mod-b": bold,
          "Mod-i": toggleMark(schema.marks.italic),
          "Mod-u": toggleMark(schema.marks.underline),
          "Shift-Enter": insertHardBreak,
        }),
        keymap(editingKeys),
      ],
    }),
  });

  /** Runs a command on the text, then puts focus back in it. */
  const run = (command: Command) => {
    command(view.state, view.dispatch);
    view.focus();
  };

  return {
    destroy: () => view.destroy(),
    element,
    focus: () => view.focus(),
    formats: () => {
      const { state } = view;
      return {
        bold: isMarkActive(state, schema.marks.bold),
        canBold,
        italic: isMarkActive(state, schema.marks.italic),
        linkHref: isMarkActive(state, link) ? linkHrefAt(state) : undefined,
        underline: isMarkActive(state, schema.marks.underline),
      };
    },
    insertLineBreak: () => run(insertHardBreak),
    removeLink: () =>
      run((state, dispatch) => {
        const { $from, empty } = state.selection;
        const { tr } = state;
        // At a cursor, the whole link around it.
        const range = empty
          ? linkRangeAt(
              $from,
              findLink($from.marks())?.attrs.href as string | undefined
            )
          : undefined;
        if (range) {
          tr.removeMark(range.from, range.to, link);
        }
        dispatch?.(removeMark(tr, link));
        return true;
      }),
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
      view.dispatch(tr.setMeta(FROM_HOST, true));
    },
    setLink: (href) =>
      run((state, dispatch) => {
        const { doc, selection } = state;
        const { $from, empty, from, to } = selection;
        const mark = link.create({ href });
        const { tr } = state;
        if (doc.textBetween(from, to)) {
          addMark(tr, mark);
        } else if (empty && isMarkActive(state, link)) {
          const range = linkRangeAt($from);
          if (range && range.from <= from && range.to >= to) {
            tr.addMark(range.from, range.to, mark);
          }
          tr.setSelection(TextSelection.create(tr.doc, from));
        } else {
          tr.insertText(href);
          const end = tr.selection.from;
          tr.addMark(end - href.length, end, mark);
        }
        dispatch?.(tr);
        return true;
      }),
    toggleMark: (mark) => run(toggleMark(schema.marks[mark])),
  };
};
