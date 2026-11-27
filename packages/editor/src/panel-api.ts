import type { BlocksDocument, RowLayout } from "@mailquilt/core";

import type { AddingState, AddPlace } from "./adding.js";
import type { NotOnDevice } from "./canvas.js";
import type { ShownFieldPicker } from "./field-merge-tags.js";
import type {
  BlockPosition,
  ColumnPosition,
  Direction,
  RowPosition,
} from "./positions.js";
import type { RowsListState } from "./rows-list.js";
import type { BarPanelsState } from "./selection-bar.js";
import type { SettingsDrafts } from "./settings-panel.js";
import type { ShownMergeTagPicker } from "./text-block-view.js";
import type { ListType, TextFormats, ToggleableMark } from "./text-commands.js";
import type { Text } from "./text.js";
import type { Device } from "./top-bar.js";
import type { Videos } from "./videos.js";

/**
 * How the Add panel and picker, the Rows list, the Selection bar and its More
 * panel, and the format bar reach the editor. They touch nothing else of `<mail-quilt>` or the Canvas. A new copy
 * for each update.
 *
 * An action that does more from the keyboard, such as moving focus or showing
 * its ring, takes `fromKeyboard`, which a button's click gives as
 * `detail === 0`: a key clicks a button with a `detail` of 0, and a pointer
 * with the number of clicks.
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
  /** The selected Column, and where it is. Unset unless one is selected. */
  selectedColumn: ColumnPosition | undefined;
  /** Whether focus is in the selected Block's text or its format bar. */
  editingText: boolean;
  /** Each of the editor's texts, in the Host app's words where it gives them. */
  text: Text;
  /**
   * The formats at the cursor in the selected Block's text. Unset until the text
   * has its editor, and the buttons wait for it.
   */
  formats: TextFormats | undefined;

  /**
   * Adds a Block, selects it, ready to type in if it has text, and says where
   * it went. It goes after the selected Block, at the end of the selected
   * Row's first Column, or else at the end of the email.
   */
  addBlock: (blockType: string) => void;
  /** Adds a Block at a place, as `addBlock` does, and closes the picker. */
  addBlockAt: (blockType: string, at: AddPlace) => void;
  /** After the selected Row or Block's Row, or else at the end, and selects it. */
  addRow: (layout: RowLayout, fromKeyboard: boolean) => void;
  /** The selected Block. From the keyboard, focus goes to its neighbour. */
  deleteBlock: (fromKeyboard: boolean) => void;
  /**
   * From the keyboard, the neighbouring Row is selected, and focus stays on
   * the Selection bar, so the next press deletes that Row.
   */
  deleteRow: (rowId: string, fromKeyboard: boolean) => void;
  /**
   * A copy of the selected Block right after it, which is selected. From the
   * keyboard, focus goes to the copy.
   */
  duplicateBlock: (fromKeyboard: boolean) => void;
  /** A copy of a Row right after it, which is selected. */
  duplicateRow: (rowId: string) => void;
  /** The selected Block, one step. */
  moveBlock: (direction: Direction) => void;
  moveRow: (rowId: string, direction: "down" | "up") => void;
  setRowLayout: (rowId: string, layout: RowLayout) => void;
  stepHistory: (step: "redo" | "undo") => void;
  /** In the selected Block's text. */
  toggleMark: (mark: ToggleableMark) => void;
  /** In the selected Block's text, which a Heading's can't be. */
  toggleList: (type: ListType) => void;
  insertLineBreak: () => void;
  /**
   * Types `{{` in the selected Block's text, which opens the Merge Tag picker.
   * Unset while the Host app gives no `mergeTags`.
   */
  insertMergeTag: (() => void) | undefined;
  /**
   * Uploads a file through the Host app's `uploadImage`, as the Image Block's
   * image. Unset while the Host app gives no `uploadImage`.
   */
  uploadImage: ((blockId: string, file: File) => void) | undefined;
  /** Why an Image Block's last upload failed, until its next one or a new URL. */
  uploadErrorOf: (blockId: string) => string | undefined;
  /**
   * A Video's play button, a thumbnail a YouTube link fills in, and what a
   * new thumbnail changes.
   */
  videos: Pick<
    Videos,
    | "choosePlay"
    | "failureOf"
    | "fillThumbnail"
    | "isAdding"
    | "wantPlay"
    | "willChange"
  >;
  /** Selects a Row instead of any Block, which the Selection bar then shows. */
  selectRow: (rowId: string, fromKeyboard: boolean) => void;
  /**
   * Selects a Row from the Rows list, and scrolls the Canvas to it. Focus goes
   * to the Row in the list, so its keys go on working there.
   */
  selectRowInList: (rowId: string, fromKeyboard: boolean) => void;
  /** Selects a Column, which the Selection bar then shows. */
  selectColumn: (columnId: string, fromKeyboard: boolean) => void;
  /** Selects nothing, so the Selection bar shows the email's settings. */
  selectEmail: (fromKeyboard: boolean) => void;
  /** Puts the selected Block or Row on the clipboard, as Ctrl/⌘+C does. */
  copySelected: () => void;
  /** Copies the selected Block or Row, then deletes it, as Ctrl/⌘+X does. */
  cutSelected: () => void;
  /**
   * Pastes what's on the clipboard after the selected Block or Row, as Ctrl/⌘+V
   * does, once the browser lets the editor read it.
   */
  pasteBelow: () => void;
  /** Opens Check, where the email is shown as it's exported. */
  openCheck: () => void;
}

/**
 * The editor's own panels: what they show beyond the email and what's selected,
 * which the editor keeps because they're drawn afresh on each update, and what
 * changes it. A host's own panel would keep its own.
 */
export interface OwnPanelsApi {
  /** The Add panel and the picker, while they're open. */
  adding: AddingState;
  /**
   * The device the Canvas shows the email on, which decides whether a field
   * that can have a Phone value changes it.
   */
  device: Device;
  /** How the Canvas shows what isn't on `device`. */
  notOnDevice: NotOnDevice;
  /**
   * Whether the editor is laid out for a phone, where the Selection bar is at
   * the bottom, and More, the Add panel and the bar's popovers are sheets.
   */
  phone: boolean;
  /**
   * What the Selection bar has open, and whether More is docked beside the
   * email, where it fits, rather than floating over it.
   */
  bar: BarPanelsState & { docked: boolean };
  /**
   * Set while the link field is open. Each refusal counts, so the same one again
   * is a new alert and is read out.
   */
  linkField: { refusals: number } | undefined;
  /** Set while the Merge Tag picker is open in the selected Block's text. */
  mergeTagPicker: ShownMergeTagPicker | undefined;
  /**
   * The Merge Tag picker for the fields that hold text or a URL: where it's
   * open, and what a click on a tag does. Unset while the Host app gives no
   * `mergeTags`.
   */
  fieldMergeTags:
    | { shown: ShownFieldPicker | undefined; pick: (index: number) => void }
    | undefined;
  /** What's typed in the settings fields and isn't the email's value. */
  drafts: SettingsDrafts;
  /** Whether the person expanded or collapsed the Rows list, and its + is open. */
  rowsList: RowsListState;

  /** Expands the Rows list, or collapses it, by whether it's `expanded` now. */
  toggleRowsList: (expanded: boolean, fromKeyboard: boolean) => void;
  /** Opens the layouts of the Rows list's +, or closes them. */
  toggleRowsAdd: (fromKeyboard: boolean) => void;

  /** Opens the Add panel, with focus in its search. */
  openAddPanel: (fromKeyboard: boolean) => void;
  /** Closes the Add panel, with focus back where it was if `returnFocus`. */
  closeAddPanel: (returnFocus: boolean) => void;
  /** Opens the picker at a place on the Canvas, with focus in it. */
  openPicker: (at: AddPlace, fromKeyboard: boolean) => void;
  /** What's typed in the Add panel's or the picker's search. */
  searchAdd: (where: "panel" | "picker", query: string) => void;
  /** Opens a popover from the Selection bar, by its button's `data-action`. */
  togglePopover: (id: string) => void;
  /** Shows a Row's padding by side, or as one value while it's the same. */
  showPaddingBySide: (rowId: string, bySide: boolean) => void;
  /** Opens the chip's menu, or closes it. */
  toggleMenu: () => void;
  /** Closes the chip's menu, with focus back on the chip if `returnFocus`. */
  closeMenu: (returnFocus: boolean) => void;
  /** Opens More, with focus in it from the keyboard, or closes it. */
  toggleMore: (fromKeyboard: boolean) => void;
  /** Closes More, with focus back on its button if `returnFocus`. */
  closeMore: (returnFocus: boolean) => void;
  /** Closes the bar's popover, with focus back on its button if `returnFocus`. */
  closePopover: (returnFocus: boolean) => void;
  /** Opens the link field for the selected Block's text. */
  openLinkField: () => void;
  /** Links the text, unless the URL isn't allowed, which the field then says. */
  submitLink: (href: string) => void;
  removeLink: () => void;
  cancelLink: () => void;
  /** Puts in the open picker's tag at `index`, as a click on it does. */
  pickMergeTag: (index: number) => void;
}
