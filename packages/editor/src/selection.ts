import { closestPlace, isOfText } from "./editor-places.js";
import type { EditorFocus } from "./focus.js";
import type { TextBlockView } from "./text-block-view.js";

/**
 * Which Block or Row is selected, and whether its text is being edited. Everything else in the editor asks this module to select
 * something. Focus is the focus module's.
 */

/** A Block, which the Selection bar acts on, a Row, or nothing. */
type Selected = { blockId: string } | { rowId: string } | undefined;

interface SelectionHost {
  focus: Pick<
    EditorFocus,
    "focused" | "focusWhenRendered" | "restoring" | "revealBlock"
  >;
  requestUpdate: () => void;
  /** A Block's text, once its editor has been made. */
  textOf: (blockId: string) => TextBlockView | undefined;
  /** The selection changed, so what describes it is out of date. */
  onSelect: () => void;
}

export type EditorSelection = ReturnType<typeof createSelection>;

export const createSelection = ({
  focus,
  onSelect,
  requestUpdate,
  textOf,
}: SelectionHost) => {
  let selected: Selected;
  /**
   * Whether focus is in the selected Block's text or a place that belongs to
   * it.
   */
  let editingText = false;

  const selectedBlockId = () =>
    selected && "blockId" in selected ? selected.blockId : undefined;

  const selectedRowId = () =>
    selected && "rowId" in selected ? selected.rowId : undefined;

  const isSelected = (target: Selected) => {
    if (target === undefined) {
      return selected === undefined;
    }
    return "blockId" in target
      ? target.blockId === selectedBlockId()
      : target.rowId === selectedRowId();
  };

  /**
   * Selects a Block, a Row or nothing, which the Selection bar then shows.
   * Whether a Block's text is being edited is up to where focus is.
   */
  const select = (target: Selected) => {
    if (isSelected(target)) {
      return;
    }
    selected = target;
    if (selectedBlockId() === undefined) {
      editingText = false;
    }
    onSelect();
  };

  /** Focus on a Block, or in its text, selects the Block. */
  const focusedOn = (blockId: string, inText: boolean) => {
    if (editingText !== inText) {
      editingText = inText;
      requestUpdate();
    }
    // The Block is selected already.
    if (!focus.restoring) {
      select({ blockId });
    }
  };

  return {
    /** Before an update: drops a selection that the update's email no longer has. */
    beforeUpdate(email: {
      blockIds: ReadonlySet<string>;
      rowIds: ReadonlySet<string>;
    }) {
      const blockId = selectedBlockId();
      const rowId = selectedRowId();
      if (
        (blockId !== undefined && !email.blockIds.has(blockId)) ||
        (rowId !== undefined && !email.rowIds.has(rowId))
      ) {
        select(undefined);
      }
    },

    get blockId() {
      return selectedBlockId();
    },

    get editingText() {
      return editingText;
    },

    onBlockFocus(blockId: string) {
      focusedOn(blockId, false);
      focus.revealBlock(blockId);
    },

    /**
     * The text stops being edited once focus leaves it and what belongs to it. State
     * rather than CSS, which would hide the bar while focus is on its way there.
     * Checked once focus has landed: the Preview opening over the text, or the
     * window losing focus while a URL is copied elsewhere, leave the bar as it is.
     */
    onBlockFocusout() {
      if (!editingText) {
        return;
      }
      setTimeout(() => {
        const element = focus.focused();
        if (
          editingText &&
          document.hasFocus() &&
          !(
            element &&
            (closestPlace(element, "text", "preview") || isOfText(element))
          )
        ) {
          editingText = false;
          requestUpdate();
        }
      }, 0);
    },

    onTextFocus(blockId: string) {
      focusedOn(blockId, true);
    },

    get rowId() {
      return selectedRowId();
    },

    select,

    /**
     * Selects a Block that has just landed, added or dropped, with focus in its
     * text if it has any. Unlike focus on the Block, focus in its text doesn't
     * scroll.
     */
    selectLanded(blockId: string | undefined) {
      select(blockId === undefined ? undefined : { blockId });
      if (blockId !== undefined) {
        focus.focusWhenRendered({ blockId, on: "text" });
        focus.revealBlock(blockId);
      }
    },

    /**
     * Selects a Row instead of any Block, and the Selection bar shows it. The
     * bar's chip takes focus, so typing can't go on in a Block's text, with its
     * focus ring when this was from the keyboard.
     */
    selectRow(rowId: string, fromKeyboard: boolean) {
      select({ rowId });
      focus.focusWhenRendered(
        { action: "chip", on: "bar" },
        { focusVisible: fromKeyboard }
      );
    },

    /** The selected Block's text, if it has any. */
    get selectedText() {
      const blockId = selectedBlockId();
      return blockId === undefined ? undefined : textOf(blockId);
    },
  };
};
