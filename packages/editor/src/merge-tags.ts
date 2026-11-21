import { MERGE_TAG } from "@mailquilt/core/internal";
import type { Mark } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import type { TextSchema } from "./text-schema.js";

const MERGE_TAGS = new RegExp(MERGE_TAG.source, "gu");

interface Range {
  from: number;
  to: number;
}

/**
 * Where `transactions` changed the text, as positions in the last one's
 * document, leaving out what `skips` says isn't the person's own change.
 */
const changedRanges = (
  transactions: readonly Transaction[],
  skips: (tr: Transaction) => boolean
) => {
  let ranges: Range[] = [];
  for (const tr of transactions) {
    for (const map of tr.mapping.maps) {
      const changed: Range[] = [];
      if (!skips(tr)) {
        // oxlint-disable-next-line unicorn/no-array-for-each -- A StepMap's, not an array's.
        map.forEach((_oldFrom, _oldTo, from, to) => changed.push({ from, to }));
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
          let marks: readonly Mark[] = [];
          state.doc.nodesBetween(from, to, (node) => {
            for (const mark of node.marks) {
              marks = mark.addToSet(marks);
            }
          });
          found.push({ from, marks, to });
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
