import { closestPlace, isOfText } from "./editor-places.js";
import type { EditorFocus } from "./focus.js";
import type { TextBlockView } from "./text-block-view.js";

/**
 * Which Block or Row is selected, whether its text is being edited, and what
 * the Side panel shows. Everything else in the editor asks this module to
 * select something. Focus is the focus module's.
 */

/** The Side panel's tabs, one of which it shows while it doesn't show what's selected. */
export type PanelTab = "content" | "rows" | "settings";

/** A Block, which the toolbars act on, a Row, or nothing. */
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
  /** Whether the side panel shows what's selected, not its tabs. */
  let showsSettings = false;
  /** The Side panel's tab, which it shows while it doesn't show what's selected. */
  let tab: PanelTab = "content";

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
   * Selects a Block, a Row or nothing, and shows what's selected in the side
   * panel. Whether a Block's text is being edited is up to where focus is.
   */
  const select = (target: Selected) => {
    if (isSelected(target) && showsSettings === (target !== undefined)) {
      return;
    }
    selected = target;
    showsSettings = target !== undefined;
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
    // The Block is selected already, and the panel stays as it was left.
    if (!focus.restoring) {
      select({ blockId });
    }
  };

  /** Shows the selected Block's or Row's settings in the side panel. */
  const showSettings = () => {
    if (!showsSettings) {
      showsSettings = true;
      requestUpdate();
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

    /**
     * Shows the selected Block's settings again after Back, when its text still has
     * focus and so gets no new focus event. Its toolbar, and what belongs to
     * its text, leave the panel be.
     */
    onBlockClick(blockId: string, target: Element) {
      if (
        blockId === selectedBlockId() &&
        !closestPlace(target, "blockToolbar") &&
        !isOfText(target)
      ) {
        showSettings();
      }
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
     * Selects a Row instead of any Block, and shows its settings. Its toolbar's
     * button takes focus, so typing can't go on in a Block's text, with its
     * focus ring when this was from the keyboard.
     */
    selectRow(rowId: string, fromKeyboard: boolean) {
      select({ rowId });
      focus.focusWhenRendered(
        { action: "select-row", on: "rowTool", rowId },
        { focusVisible: fromKeyboard }
      );
    },

    /** The ARIA tabs pattern: a tab that arrow keys move to shows its panel too. */
    selectTab(next: PanelTab) {
      if (next !== tab) {
        tab = next;
        requestUpdate();
      }
    },

    /** The selected Block's text, if it has any. */
    get selectedText() {
      const blockId = selectedBlockId();
      return blockId === undefined ? undefined : textOf(blockId);
    },

    /**
     * Back to the side panel's tabs, with the Block still selected for what's
     * added next. From the keyboard, focus goes to the current tab.
     */
    showTabs(fromKeyboard: boolean) {
      showsSettings = false;
      requestUpdate();
      if (fromKeyboard) {
        focus.focusWhenRendered({ on: "tab", tab });
      }
    },

    get showsSettings() {
      return showsSettings;
    },

    get tab() {
      return tab;
    },
  };
};
