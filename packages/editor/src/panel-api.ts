import type {
  ApplyResult,
  BlocksDocument,
  Command,
  Row,
  RowLayout,
} from "@mailquilt/core";

import type { Direction } from "./key-map.js";
import type { BlockPlace } from "./places.js";
import type { SettingsPanelEvents } from "./settings-panel.js";
import type { PanelTab } from "./side-panel.js";
import type { TextFormats, ToggleableMark } from "./text-block-view.js";

/**
 * How the Side panel, its settings, the format bar and the toolbars reach the
 * editor: what they show, and every change they make. They touch nothing else
 * of `<mail-quilt>` or the Canvas.
 *
 * It's private in 0.2, and kept to what a host's own panel would need, so that
 * offering the editor in parts later means documenting it (ADR 0004). The last
 * few members of each part are the editor's own panels' state, which `<mail-quilt>`
 * keeps because they're drawn afresh on each update.
 */
export type PanelApi = PanelState & PanelActions;

/** A Row, and where it is. */
export interface RowPlace {
  row: Row;
  rowIndex: number;
}

/** What the panels show. A new copy for each update. */
export interface PanelState {
  /** The email as the editor shows it. */
  email: BlocksDocument;
  /** The selected Block, and where it is. Unset while a Row is selected. */
  selectedBlock: BlockPlace | undefined;
  /** The selected Row, and where it is. Unset while a Block is selected. */
  selectedRow: RowPlace | undefined;
  /** Whether focus is in the selected Block's text or its format bar. */
  editingText: boolean;
  /**
   * The formats at the cursor in the selected Block's text. Unset until the text
   * has its editor, and the buttons wait for it.
   */
  formats: TextFormats | undefined;

  /** Whether the Side panel shows what's selected, in place of its tabs. */
  showsSettings: boolean;
  tab: PanelTab;
  /**
   * Set while the link field is open. Each refusal counts, so the same one again
   * is a new alert and is read out.
   */
  linkField: { refusals: number } | undefined;
}

/** Every change the panels make: to the email, to what's selected, or to themselves. */
export interface PanelActions {
  /**
   * Applies a Command, such as a new Row layout. The panels only offer what's
   * allowed, so one that's refused is a bug, and is logged. It changes nothing,
   * and the result says why.
   */
  apply: (command: Command) => ApplyResult | undefined;
  /**
   * Adds a Block and selects it, ready to type in if it has text. Without a
   * place, it goes after the selected Block, at the end of the selected Row's
   * first Column, or else at the end of the email.
   */
  addBlock: (
    blockType: string,
    place?: { columnId: string; index: number }
  ) => void;
  /** After the selected Row or Block's Row, or else at the end, and selects it. */
  addRow: (layout: RowLayout) => void;
  /** The selected Block. From the keyboard, focus goes to its neighbour. */
  deleteBlock: (fromKeyboard: boolean) => void;
  /** From the keyboard, focus goes to the neighbouring Row's tools. */
  deleteRow: (rowId: string, fromKeyboard: boolean) => void;
  /** The selected Block, one step. */
  moveBlock: (direction: Direction) => void;
  moveRow: (rowId: string, direction: "down" | "up") => void;
  stepHistory: (step: "redo" | "undo") => void;
  /** In the selected Block's text. */
  toggleMark: (mark: ToggleableMark) => void;
  insertLineBreak: () => void;
  /** Selects a Row in place of any Block, and shows its settings. */
  selectRow: (rowId: string) => void;
  openPreview: () => void;
  /** A press on a control, which keeps focus and the selection where they are. */
  onControlMousedown: (event: MouseEvent) => void;
  /** A press on a drag handle, which leaves focus and the selection be. */
  onHandleMousedown: (event: MouseEvent) => void;

  /** Back from what's selected to the Side panel's tabs. */
  showTabs: () => void;
  selectTab: (tab: PanelTab) => void;
  /** Opens the link field for the selected Block's text. */
  openLinkField: () => void;
  /** Links the text, unless the URL isn't allowed, which the field then says. */
  submitLink: (href: string) => void;
  removeLink: () => void;
  cancelLink: () => void;
  /** What's typed in the settings fields and isn't the email's value. */
  settings: SettingsPanelEvents;
}
