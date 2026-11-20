import type { EditingActions } from "./editing-actions.js";
import { closestPlace, placeOf } from "./editor-places.js";
import {
  claim,
  hasKeys,
  historyInput,
  keyFor,
  keyHeardFirst,
} from "./key-map.js";
import type { Action, DirectedAction, KeyScope } from "./key-map.js";
import type { Direction } from "./positions.js";
import { focusToolbarButton } from "./selection.js";
import type { EditorSelection, ToolbarStep } from "./selection.js";

/**
 * Hears every key pressed in the editor, and input to a Block's text, and does
 * what the key map says for where it was pressed. The rules are all in the key
 * map; this says what each of its actions does here.
 */

interface KeyDispatchHost {
  /** Whether there's a step to take that way. */
  canStep: (step: "redo" | "undo") => boolean;
  drafts: {
    discard: (event: KeyboardEvent) => void;
    /** The settings field the key was pressed in, while it holds a draft. */
    draftKeyOf: (event: KeyboardEvent) => string | undefined;
  };
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

  /**
   * Where in the editor a key was pressed: the innermost place with keys of its
   * own, or a settings field holding a draft.
   */
  const scopeOfKey = (event: KeyboardEvent): KeyScope | undefined => {
    const scope = placeOf(event.target as Element, hasKeys);
    return scope === "editor" && drafts.draftKeyOf(event) !== undefined
      ? "settingsDraft"
      : scope;
  };

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
     * Every key pressed in the editor, once what it was pressed on, such as a
     * Block's text, has had it. The key map says what it does there.
     */
    onKeydown: (event: Event) => {
      const keydown = event as KeyboardEvent;
      const scope = scopeOfKey(keydown);
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
  };
};
