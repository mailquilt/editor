import type { BlocksDocument, RowLayout } from "@mailquilt/core";

import type { BlockPosition, Direction, RowPosition } from "./positions.js";
import type { PanelTab } from "./selection.js";
import type { SettingsDrafts } from "./settings-panel.js";
import type { TextFormats, ToggleableMark } from "./text-commands.js";

/**
 * How the Side panel, its settings, the format bar and the toolbars reach the
 * editor. They touch nothing else of `<mail-quilt>` or the Canvas. A new copy
 * for each update.
 */
export type PanelApi = EmailPanelApi & OwnPanelsApi;

/**
 * What a host's own panel would need: the email, what's selected, and every
 * change to them. It's private in 0.2, so that offering the editor in parts
 * later means documenting it (ADR 0004).
 */
export interface EmailPanelApi {
  /** The email as the editor shows it. */
  email: BlocksDocument;
  /** Whether Undo and Redo would change the email. */
  canUndo: boolean;
  canRedo: boolean;
  /** The selected Block, and where it is. Unset while a Row is selected. */
  selectedBlock: BlockPosition | undefined;
  /** The selected Row, and where it is. Unset while a Block is selected. */
  selectedRow: RowPosition | undefined;
  /** Whether focus is in the selected Block's text or its format bar. */
  editingText: boolean;
  /**
   * The formats at the cursor in the selected Block's text. Unset until the text
   * has its editor, and the buttons wait for it.
   */
  formats: TextFormats | undefined;

  /**
   * Adds a Block and selects it, ready to type in if it has text. Without a
   * position, it goes after the selected Block, at the end of the selected Row's
   * first Column, or else at the end of the email.
   */
  addBlock: (
    blockType: string,
    position?: { columnId: string; index: number }
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
  setRowLayout: (rowId: string, layout: RowLayout) => void;
  stepHistory: (step: "redo" | "undo") => void;
  /** In the selected Block's text. */
  toggleMark: (mark: ToggleableMark) => void;
  insertLineBreak: () => void;
  /** Selects a Row instead of any Block, and shows its settings. */
  selectRow: (rowId: string) => void;
  openPreview: () => void;
}

/**
 * The editor's own panels: what they show beyond the email and what's selected,
 * which the editor keeps because they're drawn afresh on each update, and what
 * changes it. A host's own panel would keep its own.
 */
export interface OwnPanelsApi {
  /** Whether the Side panel shows what's selected, instead of its tabs. */
  showsSettings: boolean;
  tab: PanelTab;
  /**
   * Set while the link field is open. Each refusal counts, so the same one again
   * is a new alert and is read out.
   */
  linkField: { refusals: number } | undefined;
  /** What's typed in the settings fields and isn't the email's value. */
  drafts: SettingsDrafts;

  /**
   * Back from what's selected to the Side panel's tabs. With focus on Back, it
   * goes to the current tab.
   */
  showTabs: () => void;
  selectTab: (tab: PanelTab) => void;
  /** Opens the link field for the selected Block's text. */
  openLinkField: () => void;
  /** Links the text, unless the URL isn't allowed, which the field then says. */
  submitLink: (href: string) => void;
  removeLink: () => void;
  cancelLink: () => void;
}
