import {
  chainCommands,
  createParagraphNear,
  deleteSelection,
  joinForward,
  liftEmptyBlock,
  newlineInCode,
  selectNodeForward,
  splitBlockKeepMarks,
} from "prosemirror-commands";
import type { Mark, MarkType, ResolvedPos } from "prosemirror-model";
import { AllSelection, Selection, TextSelection } from "prosemirror-state";
import type { Command, EditorState, Transaction } from "prosemirror-state";

import type { TextAction } from "./key-map.js";
import type { TextSchema } from "./text-schema.js";

export type ToggleableMark = "bold" | "italic" | "underline";

/** What the toolbar shows for the cursor or selection. */
export type TextFormats = Record<ToggleableMark, boolean> & {
  canBold: boolean;
  linkHref: string | undefined;
};

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
const linkHrefAt = (
  { doc, selection, storedMarks }: EditorState,
  link: MarkType
) => {
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

const findLink = (marks: readonly Mark[], link: MarkType, href?: string) =>
  marks.find(
    (mark) =>
      mark.type === link && (href === undefined || mark.attrs.href === href)
  );

/** The whole of the link beside `$pos`, as far as the same URL goes. */
const linkRangeAt = ($pos: ResolvedPos, link: MarkType, href?: string) => {
  const { parent } = $pos;
  let start = parent.childAfter($pos.parentOffset);
  if (!(start.node && findLink(start.node.marks, link))) {
    start = parent.childBefore($pos.parentOffset);
  }
  const mark = start.node && findLink(start.node.marks, link, href);
  if (!(start.node && mark)) {
    return;
  }
  const sameLink = (index: number) =>
    Boolean(
      findLink(parent.child(index).marks, link, mark.attrs.href as string)
    );
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

/** What can be done to a Block's text, and what its formatting is. */
interface TextCommands {
  /** What each of the text's keys in the key map runs. */
  forKey: Record<TextAction, Command>;
  formats: (state: EditorState) => TextFormats;
  insertLineBreak: Command;
  removeLink: Command;
  /**
   * Links the selected text. With none, changes the link the cursor is in, or
   * else adds the URL as the linked text.
   */
  setLink: (href: string) => Command;
  toggleMark: (mark: ToggleableMark) => Command;
}

/**
 * The commands for text of `schema`. Where ProseMirror's own commands differ,
 * these keep Tiptap's behaviour (ADR 0003).
 */
export const createTextCommands = (
  schema: TextSchema,
  {
    canBold,
  }: {
    /** False for text that's bold already, where the mark would change nothing. */
    canBold: boolean;
  }
): TextCommands => {
  const { bold, italic, link, underline } = schema.marks;

  /**
   * A line break in place of the selection, with the cursor after it. It keeps
   * the formatting, so typing after it carries on, but has none of its own.
   */
  const insertLineBreak: Command = (state, dispatch) => {
    const { $from, $to } = state.selection;
    const marks =
      state.storedMarks ?? ($to.parentOffset ? $from.marks() : null);
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

  const toggleMark = (mark: ToggleableMark) =>
    toggleMarkCommand(schema.marks[mark]);

  return {
    forKey: {
      // Where bold would change nothing, its shortcut is still taken, or the
      // browser would make the text bold itself.
      bold: canBold ? toggleMark("bold") : () => true,
      // ProseMirror's own, past the selection, the empty paragraph and joining
      // the next one.
      deleteForward: chainCommands(
        deleteSelection,
        deleteEmptyParagraph,
        joinForward,
        selectNodeForward
      ),
      italic: toggleMark("italic"),
      lineBreak: insertLineBreak,
      // ProseMirror's own, but splitting keeps the formatting.
      newParagraph: chainCommands(
        newlineInCode,
        createParagraphNear,
        liftEmptyBlock,
        splitBlockKeepMarks
      ),
      toEnd: collapseSelectAll(true),
      toStart: collapseSelectAll(false),
      underline: toggleMark("underline"),
    },
    formats: (state) => ({
      bold: isMarkActive(state, bold),
      canBold,
      italic: isMarkActive(state, italic),
      linkHref: isMarkActive(state, link) ? linkHrefAt(state, link) : undefined,
      underline: isMarkActive(state, underline),
    }),
    insertLineBreak,
    removeLink: (state, dispatch) => {
      const { $from, empty } = state.selection;
      const { tr } = state;
      // At a cursor, the whole link around it.
      const range = empty
        ? linkRangeAt(
            $from,
            link,
            findLink($from.marks(), link)?.attrs.href as string | undefined
          )
        : undefined;
      if (range) {
        tr.removeMark(range.from, range.to, link);
      }
      dispatch?.(unmarkSelection(tr, link));
      return true;
    },
    setLink: (href) => (state, dispatch) => {
      const { doc, selection } = state;
      const { $from, empty, from, to } = selection;
      const mark = link.create({ href });
      const { tr } = state;
      if (doc.textBetween(from, to)) {
        markSelection(tr, mark);
      } else if (empty && isMarkActive(state, link)) {
        const range = linkRangeAt($from, link);
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
    },
    toggleMark,
  };
};
