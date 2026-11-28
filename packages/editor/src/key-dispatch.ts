import { focusFirstTile, pickFirstTile } from "./adding.js";
import { readPasted } from "./clipboard.js";
import type { EditingActions } from "./editing-actions.js";
import { closestPlace, placeOf } from "./editor-places.js";
import type { FieldMergeTags } from "./field-merge-tags.js";
import { focusToolbarButton } from "./focus.js";
import type { EditorFocus, ToolbarStep } from "./focus.js";
import {
  claim,
  clipboardFor,
  hasKeys,
  historyInput,
  keyFor,
  keyHeardFirst,
} from "./key-map.js";
import type {
  Action,
  Binding,
  ClipboardAction,
  ClipboardEventType,
  DirectedAction,
} from "./key-map.js";
import type { Direction } from "./positions.js";
import type { EditorSelection } from "./selection.js";

/**
 * Hears every key pressed in the editor, and input to a Block's text, and does
 * what the key map says for where it was pressed. The rules are all in the key
 * map; this says what each of its actions does here. A Block's text answers its
 * own keys first, and says which, and the key map leaves those alone.
 */

interface KeyDispatchHost {
  /** The Add panel and the picker. */
  adding: {
    closePanel: (returnFocus: boolean) => void;
    closePicker: (returnFocus: boolean) => void;
    openPanel: (fromKeyboard: boolean) => void;
  };
  /** The Selection bar's popover, menu and More, which Escape closes. */
  bar: {
    closeMenu: (returnFocus: boolean) => void;
    closeMore: (returnFocus: boolean) => void;
    closePopover: (returnFocus: boolean) => void;
  };
  /** Whether there's a step to take that way. */
  canStep: (step: "redo" | "undo") => boolean;
  drafts: { discard: (event: KeyboardEvent) => void };
  editing: Pick<
    EditingActions,
    | "copyBlock"
    | "copyRow"
    | "cutBlock"
    | "cutRow"
    | "deleteBlock"
    | "deleteRow"
    | "duplicateBlock"
    | "duplicateRow"
    | "moveBlock"
    | "moveRow"
    | "paste"
    | "selectNeighbour"
  >;
  /** The Merge Tag picker under a field that holds text or a URL. */
  fieldMergeTags: Pick<
    FieldMergeTags,
    "closeMergeTagPicker" | "isOpenIn" | "moveInMergeTagPicker" | "pickMergeTag"
  >;
  focus: Pick<EditorFocus, "focus" | "focused" | "focusIsOutsideText">;
  /** The first Block of a Row, if it has any. */
  firstBlockIn: (rowId: string) => string | undefined;
  /** A Column's first Block, if it has any, and its Row. */
  firstBlockInColumn: (
    columnId: string
  ) => { blockId: string | undefined; rowId: string } | undefined;
  isDragging: () => boolean;
  linkForm: { cancel: () => void; open: () => void };
  /** Whether Check is shown, with the Canvas hidden behind it. */
  checking: () => boolean;
  /** The Rows list's layouts, which Escape closes. */
  rowsList: { closeAdd: (returnFocus: boolean) => void };
  selection: Pick<
    EditorSelection,
    "columnId" | "rowId" | "select" | "selectedText" | "selectRow"
  >;
  stepHistory: (step: "redo" | "undo") => void;
  /** The Style panel's popovers. */
  style: {
    closePopover: (returnFocus: boolean) => void;
    moveFont: (step: -1 | 1) => void;
    nudgeColor: (direction: Direction, far: boolean) => void;
    pickFont: () => void;
    tabOut: (event: KeyboardEvent) => void;
  };
}

/** For a key whose press only needs keeping from the browser, or stopping. */
const doNothing = () => {
  // Nothing more.
};

/** Focus along the buttons of the toolbar, or the tabs, that a key was pressed in. */
const toolbarStep =
  (step: ToolbarStep) =>
  ({ target }: KeyboardEvent) =>
    focusToolbarButton(target as Element, step);

/**
 * From a field, where the key moves the cursor unless it goes on to another
 * control. Once it has, the key does nothing more there, so it doesn't move
 * the cursor just placed in the next field, or undo its selection.
 */
const fieldStep = (step: ToolbarStep) => (event: KeyboardEvent) => {
  const from = event.target as Element;
  focusToolbarButton(from, step);
  if (!from.matches(":focus")) {
    event.preventDefault();
  }
};

/** For a key whose action is done on the clipboard event it fires. */
const onClipboardEvent = doNothing;

export const createKeyDispatch = ({
  adding,
  bar,
  canStep,
  drafts,
  editing,
  fieldMergeTags,
  firstBlockIn,
  firstBlockInColumn,
  focus,
  isDragging,
  linkForm,
  checking,
  rowsList,
  selection,
  stepHistory,
  style,
}: KeyDispatchHost) => {
  /** The last key pressed, and where, before it was held down. */
  let lastPress: { key: string; target: EventTarget | undefined } | undefined;
  /** The keys a Block's text answered. */
  const answeredInText = new WeakSet<KeyboardEvent>();
  /**
   * What the next clipboard event does, when a button of the editor's own
   * fires it, rather than a key where focus is.
   */
  let pendingClipboard: ClipboardAction | undefined;
  /** The Row the Selection bar acts on, which a Row's keys there are for. */
  const rowOf = () => selection.rowId;

  /**
   * The picker a key was pressed with open: under the field the key was
   * pressed in, or else in the selected Block's text.
   */
  const pickerOf = ({ target }: KeyboardEvent) =>
    fieldMergeTags.isOpenIn(target) ? fieldMergeTags : selection.selectedText;

  /** What each action in the key map does here. */
  const actions: Record<
    Exclude<Action, DirectedAction>,
    (event: KeyboardEvent) => void
  > = {
    addFirstMatch: ({ target }) => pickFirstTile(target as Element),
    backToBlock: () => focus.focus({ on: "block" }),
    backToText: () => focus.focus({ on: "text" }),
    cancelLink: () => linkForm.cancel(),
    closeAdd: ({ target }) => {
      if (closestPlace(target as Element, "addPicker")) {
        adding.closePicker(true);
      } else {
        adding.closePanel(true);
      }
    },
    closeMenu: () => bar.closeMenu(true),
    closeMergeTagPicker: (event) => pickerOf(event)?.closeMergeTagPicker(),
    closeMore: () => bar.closeMore(true),
    closePopover: () => bar.closePopover(true),
    // The browser closes the dialog.
    closeRowsAdd: () => rowsList.closeAdd(true),
    closeStylePopover: () => style.closePopover(true),
    copyBlock: onClipboardEvent,
    copyRow: onClipboardEvent,
    cutBlock: onClipboardEvent,
    cutRow: onClipboardEvent,
    deleteBlock: () => editing.deleteBlock(true),
    deleteRow: () => {
      const rowId = rowOf();
      if (rowId !== undefined) {
        editing.deleteRow(rowId, true);
      }
    },
    discardDraft: (event) => drafts.discard(event),
    duplicateBlock: () => editing.duplicateBlock(true),
    duplicateRow: () => {
      const rowId = rowOf();
      if (rowId !== undefined) {
        editing.duplicateRow(rowId);
      }
    },
    editText: () => focus.focus({ on: "text" }),
    firstButton: toolbarStep("first"),
    focusFormatBar: () => focus.focus({ on: "formatBar" }),
    ignore: doNothing,
    keepPage: doNothing,
    lastButton: toolbarStep("last"),
    leaveToolbar: toolbarStep("leave"),
    nextButton: toolbarStep("next"),
    nextControl: fieldStep("next"),
    nextFont: () => style.moveFont(1),
    nextMergeTag: (event) => pickerOf(event)?.moveInMergeTagPicker(1),
    openAddPanel: () => adding.openPanel(true),
    openLinkField: () => linkForm.open(),
    paste: onClipboardEvent,
    pasteAfterRow: onClipboardEvent,
    pickFont: () => style.pickFont(),
    pickMergeTag: (event) => pickerOf(event)?.pickMergeTag(),
    previousButton: toolbarStep("previous"),
    previousControl: fieldStep("previous"),
    previousFont: () => style.moveFont(-1),
    previousMergeTag: (event) => pickerOf(event)?.moveInMergeTagPicker(-1),
    redo: () => stepHistory("redo"),
    tabOutOfStylePopover: (event) => style.tabOut(event),
    toAddResults: ({ target }) => focusFirstTile(target as Element),
    typeInField: doNothing,
    undo: () => stepHistory("undo"),
    // To the selected Column's first Block, which focus selects, or with none,
    // to its Row, which the bar then shows.
    unselectColumn: () => {
      const { columnId } = selection;
      const found =
        columnId === undefined ? undefined : firstBlockInColumn(columnId);
      if (found?.blockId !== undefined) {
        focus.focus({ blockId: found.blockId, on: "block" });
      } else if (found) {
        selection.selectRow(found.rowId, true);
      }
    },
    // To the selected Row's first Block, which focus selects, or with none,
    // to nothing selected.
    unselectRow: () => {
      const rowId = rowOf();
      const blockId = rowId === undefined ? undefined : firstBlockIn(rowId);
      if (blockId === undefined) {
        selection.select(undefined);
      } else {
        focus.focus({ blockId, on: "block" });
      }
    },
  };

  /**
   * What each clipboard event's action does here, with the clipboard's data,
   * from the element with focus.
   */
  const clipboardActions: Record<
    ClipboardAction,
    (data: DataTransfer) => void
  > = {
    copyBlock: (data) => editing.copyBlock(data),
    copyRow: (data) => {
      const rowId = rowOf();
      if (rowId !== undefined) {
        editing.copyRow(rowId, data);
      }
    },
    cutBlock: (data) => editing.cutBlock(data),
    cutRow: (data) => {
      const rowId = rowOf();
      if (rowId !== undefined) {
        editing.cutRow(rowId, data);
      }
    },
    paste: (data) => {
      const pasted = readPasted(data);
      if (pasted) {
        editing.paste(pasted);
      }
    },
    pasteAfterRow: (data) => {
      const pasted = readPasted(data);
      const rowId = rowOf();
      if (pasted && rowId !== undefined) {
        editing.paste(pasted, rowId);
      }
    },
  };

  /** What each arrow key's action does here, the way it goes. */
  const moves: Record<
    DirectedAction,
    (event: KeyboardEvent, direction: Direction) => void
  > = {
    moveBlock: (_event, direction) => editing.moveBlock(direction),
    // The key map moves a Row only up and down: the Row with focus in the
    // Rows list, or else the selected one.
    moveRow: ({ target }, direction) => {
      const listed = (target as HTMLElement).dataset.rowId;
      // A Row moved from the Rows list is selected, so the Selection bar shows
      // what moved.
      if (listed !== undefined) {
        selection.select({ rowId: listed });
      }
      const rowId = listed ?? rowOf();
      if (rowId !== undefined && (direction === "up" || direction === "down")) {
        editing.moveRow(rowId, direction);
      }
    },
    nudgeColor: ({ shiftKey }, direction) =>
      style.nudgeColor(direction, shiftKey),
    selectBlock: (_event, direction) => editing.selectNeighbour(direction),
  };

  /** What a key depends on besides where it was pressed. */
  const context = () => ({
    canRedo: canStep("redo"),
    canUndo: canStep("undo"),
    dragging: isDragging(),
    selectedRow: selection.rowId !== undefined,
    selectedText: selection.selectedText !== undefined,
  });

  /** Does what the key map says a press does. */
  const act = (event: KeyboardEvent, binding: Binding) => {
    claim(event, binding);
    if (binding.direction === undefined) {
      actions[binding.action](event);
    } else {
      moves[binding.action](event, binding.direction);
    }
  };

  return {
    /** Input to a Block's text. A field has its own typing and undo. */
    onBeforeInput: (event: InputEvent) => {
      if (!closestPlace(event.target as Element, "text")) {
        return;
      }
      // WebKit types into a Block's selection, and undoes there too, even with
      // focus in Check, a control, the link field or the Block itself.
      if (checking() || focus.focusIsOutsideText) {
        event.preventDefault();
        return;
      }
      const step = historyInput(event);
      if (!step) {
        return;
      }
      // The browser's own undo would change the text behind the document's
      // back, and a host page's own undo would act on the same keys.
      event.preventDefault();
      event.stopPropagation();
      stepHistory(step);
    },

    /**
     * The browser's copy, cut and paste events, from its keys or its Edit
     * menu, heard on the page, as only Chromium fires them at the element with
     * focus. The key map says what they do where focus is in the editor, and
     * leaves them to the browser in text and fields.
     */
    onClipboard: (event: Event) => {
      const focused = focus.focused();
      // A ClipboardEvent, or in a test an Event with the same data.
      const data = (event as ClipboardEvent).clipboardData;
      const scope = focused && placeOf(focused, hasKeys);
      const action =
        pendingClipboard ??
        (scope &&
          clipboardFor(scope, event.type as ClipboardEventType, {
            dragging: isDragging(),
          }));
      if (!(action && data)) {
        return;
      }
      // What a copy or cut sets reaches the clipboard only once the browser's
      // own copy is prevented, and the host page doesn't paste too.
      event.preventDefault();
      event.stopPropagation();
      clipboardActions[action](data);
    },

    /**
     * Copies or cuts the selected Block or Row from a button, such as More's,
     * through the browser's own copy, which only a press lets a page start.
     * The copy event it fires does `action`, whatever has focus.
     */
    runClipboard: (action: "copyBlock" | "copyRow" | "cutBlock" | "cutRow") => {
      pendingClipboard = action;
      try {
        // Deprecated, but the one way a page fires a copy event with its own
        // data, in every browser, without asking for a permission.
        document.execCommand("copy");
      } finally {
        pendingClipboard = undefined;
      }
    },

    /**
     * Every key pressed in the editor but one a Block's text answered, which
     * acts on a key before it bubbles out. The key map says what it does there,
     * and in a field with the Merge Tag picker open, asks the picker first.
     */
    onKeydown: (event: Event) => {
      const keydown = event as KeyboardEvent;
      if (answeredInText.has(keydown)) {
        return;
      }
      const picking =
        fieldMergeTags.isOpenIn(keydown.target) &&
        keyFor("pickerOpen", keydown, context());
      if (picking) {
        act(keydown, picking);
        return;
      }
      const scope = placeOf(keydown.target as Element, hasKeys);
      const binding = scope && keyFor(scope, keydown, context());
      if (binding) {
        act(keydown, binding);
      }
    },

    /**
     * Heard on the way in, before a Block's text, which acts on a key before it
     * bubbles out. A held key's repeats count only where it was pressed.
     */
    onKeydownCapture: (event: KeyboardEvent) => {
      const [target] = event.composedPath();
      if (!event.repeat) {
        lastPress = { key: event.key, target };
        return;
      }
      const binding =
        lastPress?.key === event.key && lastPress.target === target
          ? undefined
          : keyHeardFirst("heldElsewhere", event);
      if (binding) {
        claim(event, binding);
      }
    },

    /**
     * A key in a Block's text with the Merge Tag picker open, which the text
     * asks before its own keys. Whether the key map answered it there.
     */
    onPickerKey: (event: KeyboardEvent) => {
      const binding = keyFor("pickerOpen", event, context());
      if (binding) {
        act(event, binding);
      }
      return binding !== undefined;
    },

    /** A key a Block's text answered, which the key map then leaves alone. */
    onTextKeyAnswered: (event: KeyboardEvent) => {
      answeredInText.add(event);
    },
  };
};
