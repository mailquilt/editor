import { readPasted } from "./clipboard.js";
import type { EditingActions } from "./editing-actions.js";
import { closestPlace, findPlaces, placeOf } from "./editor-places.js";
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
  isDragging: () => boolean;
  linkForm: { cancel: () => void; open: () => void };
  previewIsOpen: () => boolean;
  selection: Pick<EditorSelection, "rowId" | "select" | "selectedText">;
  stepHistory: (step: "redo" | "undo") => void;
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

/** The Row whose toolbar an element is in. */
const rowOf = (target: EventTarget | null) =>
  closestPlace(target as Element, "row")?.dataset.rowId;

/** For a key whose action is done on the clipboard event it fires. */
const onClipboardEvent = doNothing;

export const createKeyDispatch = ({
  canStep,
  drafts,
  editing,
  fieldMergeTags,
  focus,
  isDragging,
  linkForm,
  previewIsOpen,
  selection,
  stepHistory,
}: KeyDispatchHost) => {
  /** The last key pressed, and where, before it was held down. */
  let lastPress: { key: string; target: EventTarget | undefined } | undefined;
  /** The keys a Block's text answered. */
  const answeredInText = new WeakSet<KeyboardEvent>();

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
    backToBlock: () => focus.focus({ on: "block" }),
    backToText: () => focus.focus({ on: "text" }),
    cancelLink: () => linkForm.cancel(),
    closeMergeTagPicker: (event) => pickerOf(event)?.closeMergeTagPicker(),
    // The browser closes the dialog.
    closePreview: doNothing,
    copyBlock: onClipboardEvent,
    copyRow: onClipboardEvent,
    cutBlock: onClipboardEvent,
    cutRow: onClipboardEvent,
    deleteBlock: () => editing.deleteBlock(true),
    deleteRow: (event) => {
      const rowId = rowOf(event.target);
      if (rowId !== undefined) {
        editing.deleteRow(rowId, true);
      }
    },
    discardDraft: (event) => drafts.discard(event),
    duplicateBlock: () => editing.duplicateBlock(true),
    duplicateRow: (event) => {
      const rowId = rowOf(event.target);
      if (rowId !== undefined) {
        editing.duplicateRow(rowId, true);
      }
    },
    editText: () => focus.focus({ on: "text" }),
    firstButton: toolbarStep("first"),
    focusFormatBar: () => focus.focus({ on: "formatBar" }),
    keepPage: doNothing,
    lastButton: toolbarStep("last"),
    leaveToolbar: toolbarStep("leave"),
    nextButton: toolbarStep("next"),
    nextMergeTag: (event) => pickerOf(event)?.moveInMergeTagPicker(1),
    openLinkField: () => linkForm.open(),
    paste: onClipboardEvent,
    pasteAfterRow: onClipboardEvent,
    pickMergeTag: (event) => pickerOf(event)?.pickMergeTag(),
    previousButton: toolbarStep("previous"),
    previousMergeTag: (event) => pickerOf(event)?.moveInMergeTagPicker(-1),
    redo: () => stepHistory("redo"),
    typeInField: doNothing,
    undo: () => stepHistory("undo"),
    // To the first Block of the Row whose toolbar this is, which focus
    // selects, or with none, to nothing selected.
    unselectRow: ({ target }) => {
      const row = closestPlace(target as Element, "row");
      const blockId = row
        ? findPlaces(row, "block")[0]?.dataset.blockId
        : undefined;
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
    (data: DataTransfer, focused: Element) => void
  > = {
    copyBlock: (data) => editing.copyBlock(data),
    copyRow: (data, focused) => {
      const rowId = rowOf(focused);
      if (rowId !== undefined) {
        editing.copyRow(rowId, data);
      }
    },
    cutBlock: (data) => editing.cutBlock(data),
    cutRow: (data, focused) => {
      const rowId = rowOf(focused);
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
    pasteAfterRow: (data, focused) => {
      const pasted = readPasted(data);
      const rowId = rowOf(focused);
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
    // The key map moves a Row only up and down.
    moveRow: (event, direction) => {
      const rowId = rowOf(event.target);
      if (rowId !== undefined && (direction === "up" || direction === "down")) {
        editing.moveRow(rowId, direction);
      }
    },
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
      // focus on the dialog, a control, the link field or the Block itself.
      if (previewIsOpen() || focus.focusIsOutsideText) {
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
        scope &&
        clipboardFor(scope, event.type as ClipboardEventType, {
          dragging: isDragging(),
        });
      if (!(action && data && focused)) {
        return;
      }
      // What a copy or cut sets reaches the clipboard only once the browser's
      // own copy is prevented, and the host page doesn't paste too.
      event.preventDefault();
      event.stopPropagation();
      clipboardActions[action](data, focused);
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
