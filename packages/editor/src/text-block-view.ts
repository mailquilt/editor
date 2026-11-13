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
import { Fragment, Schema, Slice } from "prosemirror-model";
import type {
  Mark,
  MarkType,
  Node as ProseMirrorNode,
  ResolvedPos,
} from "prosemirror-model";
import {
  AllSelection,
  EditorState,
  Plugin,
  Selection,
  TextSelection,
} from "prosemirror-state";
import type { Command, Transaction } from "prosemirror-state";
import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceStep,
} from "prosemirror-transform";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";

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
  /**
   * The email's language, on each paragraph. The text box around them keeps the
   * editor's, as its name is the editor's own.
   */
  setLang: (lang: string) => void;
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
 * The JSON of ADR 0001. Its names, mark order and HTML rules are the ones saved
 * and pasted text have always been read with (ADR 0003). Links come first among
 * the marks, so they stay around the others in the JSON and in the HTML.
 */
const schema = new Schema({
  // oxlint-disable-next-line sort-keys -- The order is the JSON's.
  marks: {
    // Only the URL, as `core` requires. Parsing goes through core's check, so a
    // pasted link can't get past it.
    link: {
      attrs: { href: {} },
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
  if (state.selection.empty) {
    return Boolean(
      type.isInSet(state.storedMarks ?? state.selection.$from.marks())
    );
  }
  const { from, to } = state.selection;
  let selected = 0;
  let marked = 0;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText || node.marks.length > 0) {
      const length = Math.min(to, pos + node.nodeSize) - Math.max(from, pos);
      selected += length;
      if (type.isInSet(node.marks)) {
        marked += length;
      }
    }
  });
  return selected > 0 && marked >= selected;
};

/** The link at the cursor, or the first one in the selection. */
const linkHrefAt = ({ doc, selection, storedMarks }: EditorState) => {
  const marks: Mark[] = [];
  if (selection.empty) {
    marks.push(...(storedMarks ?? []), ...selection.$head.marks());
  } else {
    doc.nodesBetween(selection.from, selection.to, (node) => {
      marks.push(...node.marks);
    });
  }
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
const unmarkSelection = (tr: Transaction, type: MarkType) => {
  for (const { $from, $to } of tr.selection.ranges) {
    tr.removeMark($from.pos, $to.pos, type);
  }
  return tr.removeStoredMark(type);
};

/** Puts a mark on the selection, or on what's typed next at a cursor. */
const markSelection = (tr: Transaction, mark: Mark) => {
  if (tr.selection.empty) {
    return tr.addStoredMark(mark);
  }
  for (const { $from, $to } of tr.selection.ranges) {
    tr.addMark($from.pos, $to.pos, mark);
  }
  return tr;
};

/** Takes a mark off if all of the selection has it, or puts it on all of it. */
const toggleMarkCommand =
  (type: MarkType): Command =>
  (state, dispatch) => {
    dispatch?.(
      isMarkActive(state, type)
        ? unmarkSelection(state.tr, type)
        : markSelection(state.tr, type.create())
    );
    return true;
  };

/** Delete in an empty paragraph removes it, even when it's the last one. */
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

/**
 * A line break in place of the selection, with the cursor after it. It keeps
 * the formatting, so typing after it carries on, but has none of its own.
 */
const insertHardBreak: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  const marks = state.storedMarks ?? ($to.parentOffset ? $from.marks() : null);
  if (dispatch) {
    const tr = state.tr.replaceSelectionWith(
      schema.nodes.hardBreak.create(),
      false
    );
    if (marks) {
      tr.ensureMarks(marks);
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * From all the text selected, ← and → go to its start or end, as from any other
 * selection. Select all covers the whole document, and some browsers leave
 * that to an arrow key that then does nothing, such as WebKit on Linux once a
 * link is in it.
 */
const collapseSelectAll =
  (toEnd: boolean): Command =>
  (state, dispatch) => {
    if (!(state.selection instanceof AllSelection)) {
      return false;
    }
    dispatch?.(
      state.tr
        .setSelection(
          toEnd ? Selection.atEnd(state.doc) : Selection.atStart(state.doc)
        )
        .scrollIntoView()
    );
    return true;
  };

/**
 * ProseMirror's own keys, with Enter keeping the formatting and Delete removing
 * an empty paragraph. Commands are matched rather than keys, so the macOS keys
 * that delete forward too, such as Ctrl+D and Alt+Delete, change with Delete.
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

/** Marks a change the host made, which isn't the user's to report. */
const FROM_HOST = "mailquilt:fromHost";

/** A Merge Tag, as `core` finds one. */
const MERGE_TAG = /\{\{[^{}]+\}\}/gu;

/**
 * Keeps a Merge Tag whole, since a mark over part of one splits it in the HTML.
 * After any change, such as formatting, linking, typing or paste, a mark on
 * part of a tag goes on all of it, or comes off all of it when the change only
 * took marks of that type off. Where parts have different links, the one the
 * change put on wins.
 */
const keepMergeTagsWhole = new Plugin({
  appendTransaction: (transactions, _before, state) => {
    if (
      !transactions.some(
        (transaction) =>
          transaction.docChanged && !transaction.getMeta(FROM_HOST)
      )
    ) {
      return null;
    }
    const added: Mark[] = [];
    const removed = new Set<MarkType>();
    for (const { steps } of transactions) {
      for (const step of steps) {
        if (step instanceof AddMarkStep) {
          added.push(step.mark);
        } else if (step instanceof RemoveMarkStep) {
          removed.add(step.mark.type);
        }
      }
    }
    const { tr } = state;
    state.doc.descendants((node, pos) => {
      if (!node.isTextblock) {
        return true;
      }
      for (const { 0: tag, index } of node.textContent.matchAll(MERGE_TAG)) {
        const from = pos + 1 + index;
        const to = from + tag.length;
        const texts: ProseMirrorNode[] = [];
        state.doc.nodesBetween(from, to, (child) => {
          if (child.isText) {
            texts.push(child);
          }
        });
        const isAdded = (mark: Mark) => added.some((each) => each.eq(mark));
        const found = [...new Set(texts.flatMap((text) => text.marks))];
        // A link replaces another, so the one just added goes on last.
        const marks = [
          ...found.filter((mark) => !isAdded(mark)),
          ...found.filter(isAdded),
        ];
        for (const mark of marks) {
          if (!texts.every((text) => mark.isInSet(text.marks))) {
            if (
              removed.has(mark.type) &&
              !added.some((each) => each.type === mark.type)
            ) {
              tr.removeMark(from, to, mark);
            } else {
              tr.addMark(from, to, mark);
            }
          }
        }
      }
      return false;
    });
    return tr.docChanged ? tr : null;
  },
});

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

/** Marks a focus change: true when the text gains focus, false when it loses it. */
const FOCUSED = "mailquilt:focused";

/**
 * Owns the DOM and ProseMirror view of one Block's text. Lit only places
 * `element` on the canvas, so the view survives re-renders. The editor keeps
 * the one undo history, so ProseMirror's isn't loaded.
 */
/** Pasted or dropped text with no bold, for a Block that can't have it. */
const withoutBold = (fragment: Fragment): Fragment =>
  Fragment.from(
    fragment.content.map((node) =>
      node.isLeaf
        ? node.mark(schema.marks.bold.removeFromSet(node.marks))
        : node.copy(withoutBold(node.content))
    )
  );

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
  // Unknown until set, as in the export of an email with no language.
  let lang = "";
  // Where bold would change nothing, its shortcut is still taken, or the
  // browser would make the text bold itself.
  const bold: Command = canBold
    ? toggleMarkCommand(schema.marks.bold)
    : () => true;

  const view = new EditorView(element, {
    attributes: {
      "aria-label": label,
      "aria-multiline": "true",
      role: "textbox",
      tabindex: "0",
    },
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
      // With what plugins add to it, and nothing if a plugin refuses it.
      const { state: after, transactions } =
        before.applyTransaction(transaction);
      if (!transactions.includes(transaction)) {
        return;
      }
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
        dispatch(state.tr.setMeta(FOCUSED, false));
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
        keymap({
          ArrowLeft: collapseSelectAll(false),
          ArrowRight: collapseSelectAll(true),
          "Mod-B": bold,
          "Mod-Enter": insertHardBreak,
          "Mod-I": toggleMarkCommand(schema.marks.italic),
          "Mod-U": toggleMarkCommand(schema.marks.underline),
          "Mod-b": bold,
          "Mod-i": toggleMarkCommand(schema.marks.italic),
          "Mod-u": toggleMarkCommand(schema.marks.underline),
          "Shift-Enter": insertHardBreak,
        }),
        keymap(editingKeys),
        keepMergeTagsWhole,
      ],
    }),
    transformPasted: (slice) =>
      canBold
        ? slice
        : new Slice(withoutBold(slice.content), slice.openStart, slice.openEnd),
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
        dispatch?.(unmarkSelection(tr, link));
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
    setLang: (next) => {
      if (next !== lang) {
        lang = next;
        // Reads the decorations again.
        view.updateState(view.state);
      }
    },
    setLink: (href) =>
      run((state, dispatch) => {
        const { doc, selection } = state;
        const { $from, empty, from, to } = selection;
        const mark = link.create({ href });
        const { tr } = state;
        if (doc.textBetween(from, to)) {
          markSelection(tr, mark);
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
    toggleMark: (mark) => run(toggleMarkCommand(schema.marks[mark])),
  };
};
