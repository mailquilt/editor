import type { EditingActions } from "./editing-actions.js";
import { closestPlace, placeOf } from "./editor-places.js";
import {
  claim,
  hasKeys,
  historyInput,
  keyFor,
  keyHeardFirst,
} from "./key-map.js";
import type { Action, DirectedAction } from "./key-map.js";
import type { Direction } from "./positions.js";
import { focusToolbarButton } from "./selection.js";
import type { EditorSelection, ToolbarStep } from "./selection.js";

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
  editing: Pick<EditingActions, "moveBlock" | "moveRow" | "selectNeighbour">;
  isDragging: () => boolean;
  linkForm: { cancel: () => void; open: () => void };
  previewIsOpen: () => boolean;
  selection: Pick<
    EditorSelection,
    "focus" | "focusIsOutsideText" | "selectedText"
  >;
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

export const createKeyDispatch = ({
  canStep,
  drafts,
  editing,
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

  /** What each action in the key map does here. */
  const actions: Record<
    Exclude<Action, DirectedAction>,
    (event: KeyboardEvent) => void
  > = {
    backToBlock: () => selection.focus({ on: "block" }),
    backToText: () => selection.focus({ on: "text" }),
    cancelLink: () => linkForm.cancel(),
    // The browser closes the dialog.
    closePreview: doNothing,
    discardDraft: (event) => drafts.discard(event),
    editText: () => selection.focus({ on: "text" }),
    firstButton: toolbarStep("first"),
    focusFormatBar: () => selection.focus({ on: "formatBar" }),
    keepPage: doNothing,
    lastButton: toolbarStep("last"),
    leaveToolbar: toolbarStep("leave"),
    nextButton: toolbarStep("next"),
    openLinkField: () => linkForm.open(),
    previousButton: toolbarStep("previous"),
    redo: () => stepHistory("redo"),
    typeInField: doNothing,
    undo: () => stepHistory("undo"),
  };

  /** What each arrow key's action does here, the way it goes. */
  const moves: Record<
    DirectedAction,
    (event: KeyboardEvent, direction: Direction) => void
  > = {
    moveBlock: (_event, direction) => editing.moveBlock(direction),
    moveRow: ({ target }, direction) => {
      const rowId = closestPlace(target as Element, "row")?.dataset.rowId;
      if (rowId !== undefined) {
        editing.moveRow(rowId, direction);
      }
    },
    selectBlock: (_event, direction) => editing.selectNeighbour(direction),
  };

  return {
    /** Input to a Block's text. A field has its own typing and undo. */
    onBeforeInput: (event: InputEvent) => {
      if (!closestPlace(event.target as Element, "text")) {
        return;
      }
      // WebKit types into a Block's selection, and undoes there too, even with
      // focus on the dialog, a control, the link field or the Block itself.
      if (previewIsOpen() || selection.focusIsOutsideText) {
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
     * Every key pressed in the editor but one a Block's text answered, which
     * acts on a key before it bubbles out. The key map says what it does there.
     */
    onKeydown: (event: Event) => {
      const keydown = event as KeyboardEvent;
      if (answeredInText.has(keydown)) {
        return;
      }
      const scope = placeOf(keydown.target as Element, hasKeys);
      const binding =
        scope &&
        keyFor(scope, keydown, {
          canRedo: canStep("redo"),
          canUndo: canStep("undo"),
          dragging: isDragging(),
          selectedText: selection.selectedText !== undefined,
        });
      if (!binding) {
        return;
      }
      claim(keydown, binding);
      if (binding.direction === undefined) {
        actions[binding.action](keydown);
      } else {
        moves[binding.action](keydown, binding.direction);
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

    /** A key a Block's text answered, which the key map then leaves alone. */
    onTextKeyAnswered: (event: KeyboardEvent) => {
      answeredInText.add(event);
    },
  };
};
