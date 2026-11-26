import { closestPlace, pressOn } from "./editor-places.js";
import type { EditorFocus } from "./focus.js";
import type { EditorSelection } from "./selection.js";

/**
 * What a press with the pointer, or the wheel, does to focus and the selection,
 * beyond what the browser does. It hears every press in the editor.
 */

interface PressesHost {
  focus: Pick<EditorFocus, "focus" | "focused">;
  selection: Pick<EditorSelection, "blockId" | "rowId" | "select">;
}

export const createPresses = ({ focus, selection }: PressesHost) => {
  /** The last press began on the workspace itself, not after a drag from a Block. */
  let pressedOnWorkspace = false;

  /**
   * The presses below keep focus where it is, so a settings field would hold on
   * to what's typed in it while the press acts on the email. Blurring commits it.
   */
  const commitFocusedField = () => {
    const element = focus.focused();
    if (
      element &&
      closestPlace(element, "settings", "settingsDraft", "barField")
    ) {
      (element as HTMLElement).blur();
    }
  };

  /**
   * Pressing a control leaves focus and the selection in the Block. With no
   * focus in the editor, the control takes it, without a ring as for any other
   * press with the pointer, because keyboard undo only reaches the editor from
   * inside it. The Preview returns focus there too, when it closes.
   */
  const onControlMousedown = (event: MouseEvent, target: Element) => {
    // A field, or a dropdown, which opens as the press lands.
    if (target.closest("input, select")) {
      return;
    }
    event.preventDefault();
    commitFocusedField();
    const button = target.closest("button");
    if (button && !focus.focused()) {
      button.focus({ focusVisible: false });
    }
  };

  /**
   * A press on a drag handle leaves focus and the selection where they are.
   * With no focus in the editor, the floating toolbar takes it, because
   * keyboard undo only reaches the editor from inside.
   */
  const onHandleMousedown = (event: MouseEvent) => {
    event.preventDefault();
    commitFocusedField();
    if (!focus.focused()) {
      focus.focus({ on: "emailTools" });
    }
  };

  return {
    /**
     * Any press in the editor. One on a drag handle, a Row's tag, or a place
     * where a press keeps focus, leaves focus and the selection where they are.
     */
    onMousedown(event: MouseEvent) {
      const { target } = event;
      if (!(target instanceof Element)) {
        return;
      }
      const press = pressOn(target);
      if (press === "grabs") {
        onHandleMousedown(event);
      } else if (press === "keepsFocus") {
        onControlMousedown(event, target);
      }
    },

    /**
     * In Chromium, a focused number field steps with the wheel, though it has no
     * arrows, while the person only meant to scroll the panel. Focus leaves it
     * for the floating toolbar, which commits it and keeps keyboard undo
     * working, or in a popover from the Selection bar, for the popover, which
     * stays open.
     */
    onWheel({ target }: WheelEvent) {
      const element = focus.focused();
      if (
        !(
          element === target &&
          element instanceof HTMLInputElement &&
          element.type === "number"
        )
      ) {
        return;
      }
      const popover = closestPlace(element, "barPopover");
      if (popover) {
        popover.focus({ focusVisible: false, preventScroll: true });
      } else {
        focus.focus({ on: "emailTools" }, { focusVisible: false });
      }
    },

    /**
     * A click on the workspace around the email clears the selection, as in any
     * design tool. The floating toolbar takes focus, so keyboard undo still works.
     */
    onWorkspaceClick({ currentTarget, target }: MouseEvent) {
      if (
        target !== currentTarget ||
        !pressedOnWorkspace ||
        (selection.blockId === undefined && selection.rowId === undefined)
      ) {
        return;
      }
      selection.select(undefined);
      focus.focus({ on: "emailTools" }, { focusVisible: false });
    },

    onWorkspacePointerdown({ currentTarget, target }: PointerEvent) {
      pressedOnWorkspace = target === currentTarget;
    },
  };
};
