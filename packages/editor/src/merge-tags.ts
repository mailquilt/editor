import { MERGE_TAG } from "@mailquilt/core/internal";
import type { Mark, Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import type {
  Command as TextCommand,
  EditorState,
  Transaction,
} from "prosemirror-state";
import { AddMarkStep, RemoveMarkStep } from "prosemirror-transform";
import type { EditorView } from "prosemirror-view";

import { isMergeTagName } from "./text-schema.js";
import type { TextSchema } from "./text-schema.js";

const MERGE_TAGS = new RegExp(MERGE_TAG.source, "gu");

interface Range {
  from: number;
  to: number;
}

/**
 * Where `transactions` changed the text, as positions in the last one's
 * document, leaving out what `skips` says isn't the person's own change. A
 * change of marks moves no position, so its step gives its own range.
 */
const changedRanges = (
  transactions: readonly Transaction[],
  skips: (tr: Transaction) => boolean
) => {
  let ranges: Range[] = [];
  for (const tr of transactions) {
    for (const [index, map] of tr.mapping.maps.entries()) {
      const changed: Range[] = [];
      if (!skips(tr)) {
        // oxlint-disable-next-line unicorn/no-array-for-each -- A StepMap's, not an array's.
        map.forEach((_oldFrom, _oldTo, from, to) => changed.push({ from, to }));
        const step = tr.steps[index];
        if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
          changed.push({ from: step.from, to: step.to });
        }
      }
      ranges = [
        ...ranges.map(({ from, to }) => ({
          from: map.mapResult(from, -1).pos,
          to: map.mapResult(to, 1).pos,
        })),
        ...changed,
      ];
    }
  }
  return ranges;
};

/** Every mark on any of the text from `from` to `to`. */
const marksBetween = (doc: ProseMirrorNode, from: number, to: number) => {
  let marks: readonly Mark[] = [];
  doc.nodesBetween(from, to, (node) => {
    for (const mark of node.marks) {
      marks = mark.addToSet(marks);
    }
  });
  return marks;
};

/**
 * Each Merge Tag in the text that touches one of `ranges` made a node, with the
 * marks of all of its text, or null if there's none.
 */
const tagsToNodes = (
  state: EditorState,
  { nodes: { mergeTag } }: TextSchema,
  ranges: readonly Range[]
) => {
  const found: { from: number; to: number; marks: readonly Mark[] }[] = [];
  state.doc.descendants((block, blockPos) => {
    if (!block.isTextblock) {
      return true;
    }
    // Each run of text between other nodes, read across its changes of marks.
    let run = "";
    let runStart = blockPos + 1;
    const readRun = () => {
      for (const { 0: tag, index } of run.matchAll(MERGE_TAGS)) {
        const from = runStart + index;
        const to = from + tag.length;
        if (ranges.some((range) => range.from <= to && range.to >= from)) {
          found.push({ from, marks: marksBetween(state.doc, from, to), to });
        }
      }
    };
    let offset = 0;
    for (const node of block.children) {
      offset += node.nodeSize;
      if (node.isText) {
        run += node.text ?? "";
      } else {
        readRun();
        run = "";
        runStart = blockPos + 1 + offset;
      }
    }
    readRun();
    return false;
  });
  const { tr } = state;
  // From the end, so each one's position still holds.
  for (const { from, marks, to } of found.toReversed()) {
    tr.replaceWith(
      from,
      to,
      mergeTag.create(
        { name: state.doc.textBetween(from + 2, to - 2) },
        null,
        marks
      )
    );
  }
  return tr.docChanged ? tr : null;
};

/**
 * Makes each Merge Tag the person types or pastes a node, one unit of text
 * (ADR 0017): when `}}` closes it, or when it's pasted or dropped. A mark on
 * part of its text goes on all of it, and where parts have different links,
 * the last one's wins. A tag the change didn't touch is left as it is, as is
 * text that `isShown` says the editor is only showing, such as an undo.
 *
 * As ProseMirror's input rules do, it waits for an input method to finish, as
 * changing the text being composed would break it, and then reads the text at
 * the cursor.
 */
export const mergeTagsFromText = (
  schema: TextSchema,
  isShown: (tr: Transaction) => boolean
) => {
  let textView: EditorView | undefined;
  return new Plugin({
    appendTransaction: (transactions, _before, state) =>
      textView?.composing
        ? null
        : tagsToNodes(state, schema, changedRanges(transactions, isShown)),
    props: {
      handleDOMEvents: {
        compositionend: (view) => {
          setTimeout(() => {
            if (view.isDestroyed) {
              return;
            }
            const { head } = view.state.selection;
            const tr = tagsToNodes(view.state, schema, [
              { from: head, to: head },
            ]);
            if (tr) {
              view.dispatch(tr);
            }
          }, 0);
          return false;
        },
      },
    },
    view: (view) => {
      textView = view;
      return {};
    },
  });
};

/** One of the Host app's Merge Tags, as `mergeTags` gives it. */
export interface MergeTag {
  /** What goes between the braces. */
  readonly name: string;
  /** What the picker and the Canvas show, instead of the name. */
  readonly label?: string | undefined;
}

/** The `{{` before the cursor, where it starts, and what's typed after it. */
interface Query {
  from: number;
  text: string;
}

interface PickerState {
  /** Where the query starts that Escape or leaving the text closed. */
  closedAt: number | undefined;
  highlighted: number;
  query: Query | undefined;
  tags: () => readonly MergeTag[];
}

/** A change the picker's own commands make. */
type PickerChange = { close: true } | { highlight: number };

const pickerKey = new PluginKey<PickerState>("mergeTagPicker");

/**
 * The picker's list, and each of its tags, by ID. Only the text with focus has
 * the picker open, so the one ID is enough.
 */
export const PICKER_ID = "merge-tag-picker";
export const pickerOptionId = (index: number) => `${PICKER_ID}-${index}`;

/**
 * The `{{` and what follows it up to a cursor, in one run of text. Another tag
 * or a line break ends the run, as each counts as one character here.
 */
const queryAt = ({ selection }: EditorState): Query | undefined => {
  const { $head, empty } = selection;
  if (!(empty && $head.parent.isTextblock)) {
    return undefined;
  }
  const before = $head.parent.textBetween(
    0,
    $head.parentOffset,
    undefined,
    "\uFFFC"
  );
  const match = /\{\{(?<text>[^{}\uFFFC]*)$/u.exec(before);
  return match
    ? { from: $head.pos - match[0].length, text: match.groups?.text ?? "" }
    : undefined;
};

/**
 * The tags whose name or label has `text` in it, whatever its case, leaving out
 * any whose name text can't hold.
 */
export const matching = (tags: readonly MergeTag[], text: string) => {
  const wanted = text.trim().toLowerCase();
  return tags.filter(
    ({ label, name }) =>
      isMergeTagName(name) &&
      (name.toLowerCase().includes(wanted) ||
        (label?.toLowerCase().includes(wanted) ?? false))
  );
};

/** The open Merge Tag picker, as it shows. */
export interface MergeTagPickerState {
  /** Where the `{{` starts. */
  from: number;
  /** The index in `options` of the tag that Enter puts in. */
  highlighted: number;
  options: readonly MergeTag[];
}

/**
 * The Merge Tag picker in `state`, or undefined while it's closed: with no
 * `{{` before the cursor, no tag that matches, or after Escape.
 */
export const pickerOf = (
  state: EditorState
): MergeTagPickerState | undefined => {
  const picker = pickerKey.getState(state);
  const query = picker?.query;
  if (!query || picker.closedAt === query.from) {
    return undefined;
  }
  const options = matching(picker.tags(), query.text);
  if (options.length === 0) {
    return undefined;
  }
  return {
    from: query.from,
    highlighted: Math.min(picker.highlighted, options.length - 1),
    options,
  };
};

/** Closes the open picker, and leaves what's typed. Another `{{` opens it again. */
export const closeMergeTagPicker: TextCommand = (state, dispatch) => {
  if (!pickerOf(state)) {
    return false;
  }
  dispatch?.(
    state.tr.setMeta(pickerKey, { close: true } satisfies PickerChange)
  );
  return true;
};

/**
 * Opens the picker while the cursor follows a `{{` in the text, with the tags
 * whose name or label has what's typed after it. Focus stays in the text, which
 * leaving closes the picker.
 */
export const mergeTagPicker = (tags: () => readonly MergeTag[]) =>
  new Plugin<PickerState>({
    key: pickerKey,
    props: {
      // The text names the list, and the tag Enter puts in.
      attributes: (state): Record<string, string> => {
        const picker = pickerOf(state);
        return picker
          ? {
              "aria-activedescendant": pickerOptionId(picker.highlighted),
              "aria-controls": PICKER_ID,
            }
          : {};
      },
      handleDOMEvents: {
        // Not when the window loses focus, as the person may only be
        // looking something up, and focus comes back to the text.
        blur: (view) => {
          if (document.hasFocus()) {
            closeMergeTagPicker(view.state, view.dispatch);
          }
          return false;
        },
      },
    },
    state: {
      apply: (tr, previous, _before, state) => {
        const query = queryAt(state);
        if (!query) {
          return { closedAt: undefined, highlighted: 0, query, tags };
        }
        const change = tr.getMeta(pickerKey) as PickerChange | undefined;
        const same =
          previous.query?.from === query.from &&
          previous.query.text === query.text;
        let closedAt =
          previous.closedAt === undefined
            ? undefined
            : tr.mapping.map(previous.closedAt);
        let highlighted = same ? previous.highlighted : 0;
        if (change && "close" in change) {
          closedAt = query.from;
        } else if (change) {
          highlighted = change.highlight;
        }
        return { closedAt, highlighted, query, tags };
      },
      init: (_config, state) => ({
        closedAt: undefined,
        highlighted: 0,
        query: queryAt(state),
        tags,
      }),
    },
  });

/** Highlights the next tag in the open picker, or the one before, both ways round. */
export const moveInMergeTagPicker =
  (step: -1 | 1): TextCommand =>
  (state, dispatch) => {
    const picker = pickerOf(state);
    if (!picker) {
      return false;
    }
    const count = picker.options.length;
    dispatch?.(
      state.tr.setMeta(pickerKey, {
        highlight: (picker.highlighted + step + count) % count,
      } satisfies PickerChange)
    );
    return true;
  };

/**
 * Puts in the highlighted tag, or the one at `index`, as a node in place of the
 * `{{` and what's typed after it, with the marks of that text.
 */
export const pickMergeTag =
  (index?: number): TextCommand =>
  (state, dispatch) => {
    const picker = pickerOf(state);
    const tag = picker?.options[index ?? picker.highlighted];
    if (!(picker && tag)) {
      return false;
    }
    const { from } = picker;
    const to = state.selection.head;
    dispatch?.(
      state.tr.replaceWith(
        from,
        to,
        (state.schema as TextSchema).nodes.mergeTag.create(
          { name: tag.name },
          null,
          marksBetween(state.doc, from, to)
        )
      )
    );
    return true;
  };

/** Types `{{` at the cursor, or over the selection, which opens the picker. */
export const startMergeTag: TextCommand = (state, dispatch) => {
  dispatch?.(state.tr.insertText("{{"));
  return true;
};
