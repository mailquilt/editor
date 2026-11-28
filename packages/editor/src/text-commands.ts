import {
  chainCommands,
  createParagraphNear,
  deleteSelection,
  joinBackward,
  joinForward,
  selectNodeBackward,
  selectNodeForward,
  splitBlockKeepMarks,
} from "prosemirror-commands";
import type {
  Mark,
  MarkType,
  Node,
  NodeType,
  ResolvedPos,
} from "prosemirror-model";
import { Fragment } from "prosemirror-model";
import { AllSelection, Selection, TextSelection } from "prosemirror-state";
import type {
  Command as TextCommand,
  EditorState,
  Transaction,
} from "prosemirror-state";

import type { TextAction } from "./key-map.js";
import type { TextSchema } from "./text-schema.js";

export type ToggleableMark = "bold" | "italic" | "underline";

export type ListType = "bulletList" | "orderedList";

/** What the toolbar shows for the cursor or selection. */
export type TextFormats = Record<ToggleableMark, boolean> & {
  canBold: boolean;
  /** False for text that can't have Lists, such as a Heading's. */
  canList: boolean;
  linkHref: string | undefined;
  /** The type of List all the selected text is in, if it's all in one type. */
  list: ListType | undefined;
};

/**
 * Marks a change to a List's type, or to whether text is in a List, which is
 * its own undo step, as formatting is.
 */
export const LIST_FORMATTING = "mailquilt:listFormatting";

/**
 * Whether the selection holds text to format or link, a Merge Tag included. A
 * line break alone isn't text, as a mark on it shows nothing.
 */
const holdsText = ({
  doc,
  selection,
}: Pick<EditorState | Transaction, "doc" | "selection">) =>
  doc.textBetween(selection.from, selection.to, undefined, (leaf) =>
    leaf.type.name === "mergeTag" ? "{{}}" : ""
  ) !== "";

/**
 * With no text selected, such as at a cursor or in an empty text, whether typing
 * would get the mark. Over text, whether all of it has it, so that formatting
 * part of a selection formats all of it.
 */
const isMarkActive = (state: EditorState, type: MarkType) => {
  if (!holdsText(state)) {
    return Boolean(
      type.isInSet(state.storedMarks ?? state.selection.$from.marks())
    );
  }
  const { from, to } = state.selection;
  let selected = 0;
  let marked = 0;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isText || node.type.name === "mergeTag" || node.marks.length > 0) {
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

/**
 * A selection with no text, such as all of an empty text, as a cursor where it
 * starts, since what's typed next takes a mark only at a cursor.
 */
const toCursorWithoutText = (tr: Transaction) => {
  if (!(tr.selection.empty || holdsText(tr))) {
    tr.setSelection(Selection.near(tr.selection.$from));
  }
};

/** Takes a mark off the selection, and off what's typed next. */
const unmarkSelection = (tr: Transaction, type: MarkType) => {
  for (const { $from, $to } of tr.selection.ranges) {
    tr.removeMark($from.pos, $to.pos, type);
  }
  toCursorWithoutText(tr);
  return tr.removeStoredMark(type);
};

/** Puts a mark on the selected text, or else on what's typed next. */
const markSelection = (tr: Transaction, mark: Mark) => {
  if (!holdsText(tr)) {
    toCursorWithoutText(tr);
    return tr.addStoredMark(mark);
  }
  for (const { $from, $to } of tr.selection.ranges) {
    tr.addMark($from.pos, $to.pos, mark);
  }
  return tr;
};

/** Takes a mark off if all of the selection has it, or puts it on all of it. */
const toggleMarkCommand =
  (type: MarkType): TextCommand =>
  (state, dispatch) => {
    dispatch?.(
      isMarkActive(state, type)
        ? unmarkSelection(state.tr, type)
        : markSelection(state.tr, type.create())
    );
    return true;
  };

/** Whether a node is a List. Only a Text Block's schema has them. */
const isList = (node: Node | null | undefined) =>
  node?.type.name === "bulletList" || node?.type.name === "orderedList";

/**
 * Joins the Lists either side of `pos`, between the text's top-level nodes, if
 * they're of one type, as a delete can leave them next to each other. Two of
 * them would number from 1 again.
 */
const joinListsAt = (tr: Transaction, pos: number) => {
  const $pos = tr.doc.resolve(pos);
  if (
    $pos.depth === 0 &&
    isList($pos.nodeBefore) &&
    $pos.nodeBefore?.type === $pos.nodeAfter?.type
  ) {
    tr.join(pos);
  }
  return tr;
};

/**
 * Delete in an empty paragraph removes it, even when it's the last one. In a
 * List, it removes the item, and the List too if that was its only item.
 */
const deleteEmptyParagraph: TextCommand = (state, dispatch) => {
  const { $anchor, empty } = state.selection;
  if (!empty || $anchor.parent.content.size > 0) {
    return false;
  }
  let { depth } = $anchor;
  while (depth > 1 && $anchor.node(depth - 1).childCount === 1) {
    depth -= 1;
  }
  const tr = state.tr.delete($anchor.before(depth), $anchor.after(depth));
  if (depth === 1) {
    joinListsAt(tr, $anchor.before(1));
  }
  dispatch?.(tr.scrollIntoView());
  return true;
};

/**
 * Where `pos` is in the text, as the number of the paragraph it's in or after,
 * counted through Lists, and how far into that paragraph it is.
 */
export const paragraphOffset = (doc: Node, pos: number): [number, number] => {
  let found: [number, number] = [0, 0];
  let count = 0;
  doc.descendants((node, at) => {
    if (!node.isTextblock) {
      return true;
    }
    if (pos > at) {
      found = [count, Math.min(pos - at - 1, node.content.size)];
    }
    count += 1;
    return false;
  });
  return found;
};

/** The position `paragraphOffset` gives, in `doc`, within that paragraph. */
export const atParagraphOffset = (
  doc: Node,
  [paragraph, offset]: [number, number]
) => {
  let pos = 0;
  let count = 0;
  doc.descendants((node, at) => {
    if (!node.isTextblock) {
      return true;
    }
    if (count === paragraph) {
      pos = at + 1 + Math.min(offset, node.content.size);
    }
    count += 1;
    return false;
  });
  return pos;
};

/**
 * From all the text selected, ← and → go to its start or end, as from any other
 * selection. Select all covers the whole document, and some browsers leave
 * that to an arrow key that then does nothing, such as WebKit on Linux once a
 * link is in it.
 */
const collapseSelectAll =
  (toEnd: boolean): TextCommand =>
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

/** The item `$pos` is in becomes a paragraph, splitting its List. */
const liftItem = (tr: Transaction, $pos: ResolvedPos) => {
  const range = $pos.blockRange();
  if (range) {
    tr.lift(range, 0);
  }
  return tr.scrollIntoView();
};

/**
 * Where the selection's text starts and ends, inside paragraphs, such as for
 * a whole item or all the text selected.
 */
const textRange = ({ selection }: EditorState) => ({
  $from: Selection.findFrom(selection.$from, 1, true)?.$from ?? selection.$from,
  $to: Selection.findFrom(selection.$to, -1, true)?.$to ?? selection.$to,
});

/**
 * The top-level paragraphs and Lists the selection's text touches, from
 * `start` to before `end`, and within the first and last, if they're Lists,
 * the items it touches.
 */
const touched = (state: EditorState) => {
  const { $from, $to } = textRange(state);
  const start = $from.index(0);
  return {
    end: Math.max(start + 1, $to.indexAfter(0)),
    firstItem: $from.index(1),
    lastItem: $to.index(1),
    start,
  };
};

/** The formatting that typing after the selection's end keeps, if any. */
const marksForTyping = ({ selection, storedMarks }: EditorState) =>
  storedMarks ?? (selection.$to.parentOffset ? selection.$from.marks() : null);

/**
 * The selection on the same text after a change that only moved the structure
 * around it, such as a List, and the formatting turned on or off for what's
 * typed next, which the change clears.
 */
const keepSelection = (tr: Transaction, state: EditorState) => {
  const { doc, selection, storedMarks } = state;
  if (selection instanceof AllSelection) {
    return tr.setSelection(new AllSelection(tr.doc));
  }
  const range = textRange(state);
  const from = paragraphOffset(doc, range.$from.pos);
  const to = paragraphOffset(doc, range.$to.pos);
  const [anchor, head] =
    selection.anchor > selection.head ? [to, from] : [from, to];
  tr.setSelection(
    TextSelection.create(
      tr.doc,
      atParagraphOffset(tr.doc, anchor),
      atParagraphOffset(tr.doc, head)
    )
  );
  if (storedMarks && selection.empty) {
    tr.setStoredMarks(storedMarks);
  }
  return tr;
};

/**
 * Backspace at the start of the paragraph just after a List joins it to the
 * List's last item, where ProseMirror's own would make it a new item.
 */
const joinToLastItem: TextCommand = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!(empty && $from.depth === 1 && $from.parentOffset === 0)) {
    return false;
  }
  const index = $from.index(0);
  if (!(index > 0 && isList(state.doc.child(index - 1)))) {
    return false;
  }
  // From the end of the last item's text, past the closing paragraph, item
  // and List.
  const listEnd = $from.before(1);
  const tr = state.tr.delete(listEnd - 3, $from.pos);
  joinListsAt(tr, tr.selection.$from.after(1));
  dispatch?.(tr.scrollIntoView());
  return true;
};

/** The type of List all the selected text is in, if it's all in one type. */
const listOf = (state: EditorState): ListType | undefined => {
  const { end, start } = touched(state);
  let type: NodeType | undefined;
  for (let index = start; index < end; index += 1) {
    const node = state.doc.child(index);
    if (!isList(node) || (type !== undefined && node.type !== type)) {
      return;
    }
    ({ type } = node);
  }
  return type?.name as ListType | undefined;
};

/** What can be done to a Block's text, and what its formatting is. */
interface TextCommands {
  /** What each of the text's keys in the key map runs. */
  forKey: Record<TextAction, TextCommand>;
  formats: (state: EditorState) => TextFormats;
  insertLineBreak: TextCommand;
  removeLink: TextCommand;
  /**
   * Links the selected text. With none, changes the link the cursor is in, or
   * else adds the URL as the linked text.
   */
  setLink: (href: string) => TextCommand;
  toggleMark: (mark: ToggleableMark) => TextCommand;
  /**
   * Makes each selected paragraph an item of a List of `type`, joined with a
   * List of that type next to it. A List of the other type becomes this type,
   * all of it. With all the selected text in a List of this type already, its
   * selected items become paragraphs again, splitting the List. Refused in
   * text that can't have Lists.
   */
  toggleList: (type: ListType) => TextCommand;
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
   * A line break instead of the selection, with the cursor after it. It keeps
   * the formatting, so typing after it carries on, but has none of its own.
   */
  const insertLineBreak: TextCommand = (state, dispatch) => {
    const marks = marksForTyping(state);
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

  // Only in a Text Block's schema.
  const { listItem } = schema.nodes;
  /** Whether a position is in a List's item, which is always at depth 3. */
  const isInItem = ($pos: ResolvedPos) =>
    $pos.depth === 3 && $pos.node(2).type === listItem;

  /**
   * Enter in an item with text starts a new item from the cursor, keeping the
   * formatting. In an empty item, the item leaves the List.
   */
  const newItem: TextCommand = (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!isInItem($from)) {
      return false;
    }
    if (empty && $from.parent.content.size === 0) {
      dispatch?.(liftItem(state.tr, $from));
      return true;
    }
    const marks = marksForTyping(state);
    const tr = state.tr.deleteSelection();
    if (!isInItem(tr.selection.$from)) {
      return false;
    }
    tr.split(tr.selection.from, 2);
    if (marks) {
      tr.ensureMarks(marks);
    }
    dispatch?.(tr.scrollIntoView());
    return true;
  };

  /**
   * Backspace at the start of an item makes it a paragraph, above the List or
   * splitting it, rather than joining it to the item above.
   */
  const liftItemAtStart: TextCommand = (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!(empty && isInItem($from) && $from.parentOffset === 0)) {
      return false;
    }
    dispatch?.(liftItem(state.tr, $from));
    return true;
  };

  /**
   * Delete at the end of a List's last item, or of the paragraph before a
   * List, pulls in the next paragraph's text, or the next List's first item's.
   * ProseMirror's own would make one List of two types, or take the item out
   * of its List. A List left next to one of its type joins it.
   */
  const joinNextText: TextCommand = (state, dispatch) => {
    const { $from, empty } = state.selection;
    const inLastItem =
      isInItem($from) && $from.indexAfter(1) === $from.node(1).childCount;
    if (
      !(
        empty &&
        $from.parentOffset === $from.parent.content.size &&
        (inLastItem || $from.depth === 1)
      )
    ) {
      return false;
    }
    const nextStart = $from.after(1);
    const next = state.doc.nodeAt(nextStart);
    if (!(next && (isList(next) || (inLastItem && next.isTextblock)))) {
      return false;
    }
    if (dispatch) {
      const first = isList(next) ? next.child(0) : undefined;
      // The next paragraph, or the first item, or its List if that's all.
      const removed = first && next.childCount > 1 ? first : next;
      const removedFrom = removed === first ? nextStart + 1 : nextStart;
      const tr = state.tr
        .delete(removedFrom, removedFrom + removed.nodeSize)
        .insert($from.pos, (first?.child(0) ?? next).content);
      tr.setSelection(TextSelection.create(tr.doc, $from.pos));
      joinListsAt(tr, tr.selection.$from.after(1));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };

  const toggleList =
    (type: ListType): TextCommand =>
    (state, dispatch) => {
      const listType = schema.nodes[type];
      if (!(listType && listItem)) {
        return false;
      }
      const { doc } = state;
      const touch = touched(state);
      const { firstItem, lastItem } = touch;
      let { end, start } = touch;
      const nodes: Node[] = [];
      if (listOf(state) === type) {
        for (let index = start; index < end; index += 1) {
          const list = doc.child(index);
          const from = index === start ? firstItem : 0;
          const to = index === end - 1 ? lastItem + 1 : list.childCount;
          const items = list.children;
          if (from > 0) {
            nodes.push(list.copy(Fragment.from(items.slice(0, from))));
          }
          nodes.push(...items.slice(from, to).map((item) => item.child(0)));
          if (to < list.childCount) {
            nodes.push(list.copy(Fragment.from(items.slice(to))));
          }
        }
      } else {
        if (start > 0 && doc.child(start - 1).type === listType) {
          start -= 1;
        }
        if (end < doc.childCount && doc.child(end).type === listType) {
          end += 1;
        }
        const items: Node[] = [];
        for (let index = start; index < end; index += 1) {
          const node = doc.child(index);
          if (isList(node)) {
            items.push(...node.children);
          } else {
            items.push(listItem.create(null, node));
          }
        }
        nodes.push(listType.create(null, items));
      }
      if (dispatch) {
        let replaceFrom = 0;
        for (let index = 0; index < start; index += 1) {
          replaceFrom += doc.child(index).nodeSize;
        }
        let replaceTo = replaceFrom;
        for (let index = start; index < end; index += 1) {
          replaceTo += doc.child(index).nodeSize;
        }
        const tr = state.tr.replaceWith(replaceFrom, replaceTo, nodes);
        dispatch(
          keepSelection(tr, state)
            .setMeta(LIST_FORMATTING, true)
            .scrollIntoView()
        );
      }
      return true;
    };

  return {
    forKey: {
      // Where bold would change nothing, its shortcut is still taken, or the
      // browser would make the text bold itself.
      bold: canBold ? toggleMark("bold") : () => true,
      bulletList: toggleList("bulletList"),
      // ProseMirror's own, past the start of an item and the paragraph after a
      // List.
      deleteBackward: chainCommands(
        deleteSelection,
        liftItemAtStart,
        joinToLastItem,
        joinBackward,
        selectNodeBackward
      ),
      // ProseMirror's own, past the selection, the empty paragraph, the end of
      // a List, and joining the next one.
      deleteForward: chainCommands(
        deleteSelection,
        deleteEmptyParagraph,
        joinNextText,
        joinForward,
        selectNodeForward
      ),
      italic: toggleMark("italic"),
      lineBreak: insertLineBreak,
      // ProseMirror's own, past a List's items, but splitting keeps the
      // formatting. Its command for code does nothing in this schema. A
      // paragraph selected whole, by a click with Ctrl, or ⌘ on Apple devices,
      // gets a new one after it.
      newParagraph: chainCommands(
        createParagraphNear,
        newItem,
        splitBlockKeepMarks
      ),
      orderedList: toggleList("orderedList"),
      toEnd: collapseSelectAll(true),
      toStart: collapseSelectAll(false),
      underline: toggleMark("underline"),
    },
    formats: (state) => ({
      bold: isMarkActive(state, bold),
      canBold,
      canList: listItem !== undefined,
      italic: isMarkActive(state, italic),
      linkHref: isMarkActive(state, link) ? linkHrefAt(state, link) : undefined,
      list: listOf(state),
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
      const { $from, empty, from, to } = state.selection;
      const mark = link.create({ href });
      const { tr } = state;
      if (holdsText(state)) {
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
    toggleList,
    toggleMark,
  };
};
