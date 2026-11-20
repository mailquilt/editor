import { createAutoScroll } from "./auto-scroll.js";
import type { AutoScroll } from "./auto-scroll.js";
import { createDragGhost } from "./drag-ghost.js";
import { closestPlace, findPlace, findPlaces } from "./editor-places.js";
import { contains, scaleOf, shadowRootsUpFrom } from "./geometry.js";
import type { Point } from "./geometry.js";
import { claim, keyHeardFirst } from "./key-map.js";
import { isRowSource } from "./positions.js";
import type { DragSource, DropPosition } from "./positions.js";

export interface Dragging {
  isDragging: () => boolean;
  destroy: () => void;
}

/** A press alone stays a click, however long it lasts. */
const START_DISTANCE_PX = 5;

/** How far outside the editor a drop still counts, as space below the email. */
const DROP_MARGIN_PX = 40;

/** A Block or Row already in the email, rather than a new one. */
const isOnCanvas = (source: DragSource) =>
  "blockId" in source || "rowId" in source;

const midpointY = (element: Element) => {
  const { bottom, top } = element.getBoundingClientRect();
  return (top + bottom) / 2;
};

interface Grab {
  element: HTMLElement;
  source: DragSource;
  /** The toolbar its handle is in: a Row's, or a selected Block's. */
  toolbar?: Element;
}

/**
 * What a press on `target` picks up: a Block by its handle, a Row by its handle
 * or its tag, or an item in the palette or the Rows tab.
 */
const grabAt = (target: Element): Grab | undefined => {
  const handle = closestPlace(target, "dragHandle");
  const rowGrip =
    (handle && closestPlace(handle, "rowToolbar")) ??
    closestPlace(target, "rowTag");
  const row = rowGrip && closestPlace(rowGrip, "row");
  if (row) {
    return {
      element: row,
      source: { rowId: row.dataset.rowId as string },
      toolbar: findPlace(row, "rowToolbar") ?? undefined,
    };
  }
  const block = handle && closestPlace(handle, "block");
  if (handle && block) {
    return {
      element: block,
      source: { blockId: block.dataset.blockId as string },
      toolbar: closestPlace(handle, "blockToolbar") ?? undefined,
    };
  }
  const tile = closestPlace(target, "paletteItem");
  if (tile) {
    const { blockType, rowLayout } = tile.dataset;
    return {
      element: tile,
      source:
        blockType === undefined
          ? { rowLayout: rowLayout as string }
          : { blockType },
    };
  }
  return undefined;
};

/**
 * Shows the dragging cursor over the host page and the editor alike, whatever
 * cursor their own styles ask for, and inside any element the editor is in,
 * such as the Shell. An adopted style sheet, unlike a <style> element, works
 * under a Content Security Policy that blocks inline styles. Returns what puts
 * the usual cursors back.
 */
const showGrabbingCursor = (root: ShadowRoot) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync("* { cursor: grabbing !important; }");
  const owners = [document, ...shadowRootsUpFrom(root)];
  for (const owner of owners) {
    owner.adoptedStyleSheets = [...owner.adoptedStyleSheets, sheet];
  }
  return () => {
    for (const owner of owners) {
      owner.adoptedStyleSheets = owner.adoptedStyleSheets.filter(
        (each) => each !== sheet
      );
    }
  };
};

/**
 * The release that ends a drag clicks the page's body, where the pointer is
 * captured, which isn't something the user pressed.
 */
const stopReleaseClick = (click: MouseEvent) => {
  if (click.target === document.body && click.detail > 0) {
    click.preventDefault();
    click.stopImmediatePropagation();
  }
};

/** Stops the click of a release that ends a drag, until the next task. */
const guardReleaseClick = () => {
  window.addEventListener("click", stopReleaseClick, { capture: true });
  setTimeout(() => {
    window.removeEventListener("click", stopReleaseClick, { capture: true });
  }, 0);
};

interface Press {
  grab: Grab;
  /** Where the press was, which the copy keeps under the pointer. */
  from: Point;
  listeners: AbortController;
}

interface Drag {
  autoScroll: AutoScroll;
  ghost: HTMLElement;
  pointer: Point;
  restoreCursor: () => void;
}

interface DraggingHost {
  onDrop: (source: DragSource, position: DropPosition) => void;
  root: ShadowRoot;
}

/**
 * Drags Blocks, Rows and palette items with pointer events. The drop position
 * comes from the pointer when the drag ends, so nothing moves until then, and
 * the indicator shows the same answer on the way there. The keyboard has its
 * own way to move each one, through the same Commands.
 */
export const createDragging = ({ onDrop, root }: DraggingHost): Dragging => {
  /** A press that may still turn into a drag, and the drag once it has. */
  let press: Press | undefined;
  let drag: Drag | undefined;
  let frame = 0;
  /**
   * The selected Block's or Row's toolbar, where its handle is, until the
   * pointer first leaves it. It's outside the Block, so letting go there after
   * a short drag would otherwise land somewhere else. Once the drag has gone
   * further, it lands there like anywhere else.
   */
  let startedOn: DOMRect | undefined;

  /**
   * Where a drop would land now, and the line that shows it. Blocks are counted
   * without the dragged one, as a move's index is. There's no landing far from the
   * editor, which is how to abandon a drag, or on the side panel, so that letting
   * go of a palette item that barely moved adds nothing, or on the floating
   * toolbar. Nor is there outside a scroll container the editor is in, such as
   * the Shell's, where what's under the pointer is scrolled out of sight.
   */
  const landing = (
    { element, source }: Grab,
    pointer: Point,
    autoScroll: AutoScroll
  ) => {
    const email = findPlace(root, "email");
    const controls = [
      ...findPlaces(root, "sidePanel"),
      ...findPlaces(root, "emailTools"),
    ];
    if (
      !email ||
      (startedOn && contains(startedOn, pointer)) ||
      controls.some((control) => contains(control, pointer)) ||
      !contains(root.host, pointer, DROP_MARGIN_PX) ||
      !autoScroll.shows(pointer)
    ) {
      return;
    }
    const column = isRowSource(source)
      ? undefined
      : findPlaces(email, "column").find((each) => contains(each, pointer));
    const parent = column ?? email;
    const items = findPlaces(parent, column ? "block" : "row").filter(
      (each) => each !== element
    );
    const index = items.filter((each) => midpointY(each) < pointer.y).length;
    const next = items[index];
    const box = parent.getBoundingClientRect();
    return {
      column,
      line: {
        left: box.left,
        width: box.width,
        y:
          next?.getBoundingClientRect().top ??
          items.at(-1)?.getBoundingClientRect().bottom ??
          box.top,
      },
      position: column
        ? { columnId: column.dataset.columnId as string, index }
        : { rowIndex: index },
    };
  };

  /** The line where a drop would land, and the Column it would land in. */
  const showIndicator = (target?: ReturnType<typeof landing>) => {
    const email = findPlace(root, "email");
    const indicator = findPlace(root, "dropIndicator");
    if (!(email && indicator)) {
      return;
    }
    const landsIn = target?.column;
    for (const column of email.querySelectorAll<HTMLElement>(
      "[data-drop-target]"
    )) {
      if (column !== landsIn) {
        delete column.dataset.dropTarget;
      }
    }
    if (landsIn) {
      landsIn.dataset.dropTarget = "";
    }
    const line = target?.line;
    indicator.hidden = !line;
    if (line) {
      const origin = email.getBoundingClientRect();
      // The line is on screen, and its offset in the email isn't, where a host
      // page scales the editor.
      const scaleX = scaleOf(origin.width, email.offsetWidth);
      const scaleY = scaleOf(origin.height, email.offsetHeight);
      indicator.style.left = `${(line.left - origin.left) / scaleX}px`;
      indicator.style.top = `${(line.y - origin.top) / scaleY}px`;
      indicator.style.width = `${line.width / scaleX}px`;
    }
  };

  /**
   * Lets go of a press. If it had become a drag, that ends, and if `drop`, what
   * it brought lands where the pointer is.
   */
  const release = (drop: boolean) => {
    const ended = press;
    const dragged = drag;
    press = undefined;
    drag = undefined;
    ended?.listeners.abort();
    if (!(ended && dragged)) {
      return;
    }
    cancelAnimationFrame(frame);
    const { grab } = ended;
    // An undo during the drag can take away the Block being dragged.
    const position =
      drop && grab.element.isConnected
        ? landing(grab, dragged.pointer, dragged.autoScroll)?.position
        : undefined;
    startedOn = undefined;
    dragged.ghost.remove();
    delete grab.element.dataset.dragSource;
    dragged.restoreCursor();
    showIndicator();
    const email = findPlace(root, "email");
    if (email) {
      delete email.dataset.dragging;
    }
    if (position) {
      onDrop(grab.source, position);
    }
  };

  // Every frame, because scrolling moves what's under a pointer that keeps still.
  const onFrame = (time: number) => {
    if (!(press && drag)) {
      return;
    }
    const { from, grab } = press;
    const { autoScroll, ghost, pointer } = drag;
    // An undo, or a new email, can take away what's being dragged.
    if (!grab.element.isConnected) {
      release(false);
      return;
    }
    if (startedOn && !contains(startedOn, pointer)) {
      startedOn = undefined;
    }
    ghost.style.translate = `${pointer.x - from.x}px ${pointer.y - from.y}px`;
    autoScroll.frame(pointer, time);
    showIndicator(landing(grab, pointer, autoScroll));
    frame = requestAnimationFrame(onFrame);
  };

  const start = ({ grab, listeners }: Press, event: PointerEvent) => {
    try {
      // So that the drag goes on outside the editor, and even the window.
      document.body.setPointerCapture(event.pointerId);
    } catch {
      release(false);
      return;
    }
    // Before it's hidden along with its Block or Row.
    startedOn = grab.toolbar?.getBoundingClientRect();
    drag = {
      autoScroll: createAutoScroll(root.host),
      ghost: createDragGhost(grab.element),
      pointer: { x: event.clientX, y: event.clientY },
      restoreCursor: showGrabbingCursor(root),
    };
    // A Block or Row stays where it was, unseen, so that its text keeps its
    // editor, focus and cursor. The palette keeps its item.
    if (isOnCanvas(grab.source)) {
      grab.element.dataset.dragSource = "";
    }
    const email = findPlace(root, "email");
    if (email) {
      // Which, so that only a Block's drag highlights the Columns.
      email.dataset.dragging = isRowSource(grab.source) ? "row" : "block";
    }
    const { signal } = listeners;
    // Heard first, before the editor's own places hear the key.
    window.addEventListener(
      "keydown",
      (keydown) => {
        const binding = keyHeardFirst("drag", keydown);
        if (binding) {
          claim(keydown, binding);
          release(false);
          // The button is still down, and the body still has the pointer. A
          // cancelled pointer has no release to guard.
          const guard = new AbortController();
          const options = { capture: true, signal: guard.signal };
          window.addEventListener(
            "pointerup",
            () => {
              guard.abort();
              guardReleaseClick();
            },
            options
          );
          window.addEventListener(
            "pointercancel",
            () => guard.abort(),
            options
          );
        }
      },
      { capture: true, signal }
    );
    onFrame(performance.now());
  };

  const onPointerdown = (event: Event) => {
    if (
      press ||
      !(event instanceof PointerEvent) ||
      !event.isPrimary ||
      event.button !== 0 ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    const grab = grabAt(event.target);
    if (!grab) {
      return;
    }
    const { pointerId } = event;
    const listeners = new AbortController();
    const { signal } = listeners;
    press = { from: { x: event.clientX, y: event.clientY }, grab, listeners };
    window.addEventListener(
      "pointermove",
      (move) => {
        if (move.pointerId !== pointerId || !press) {
          return;
        }
        // The button was let go where the window didn't hear it.
        if (move.buttons === 0) {
          release(false);
          return;
        }
        const pointer = { x: move.clientX, y: move.clientY };
        if (drag) {
          move.preventDefault();
          drag.pointer = pointer;
        } else if (
          Math.hypot(pointer.x - press.from.x, pointer.y - press.from.y) >
          START_DISTANCE_PX
        ) {
          start(press, move);
        }
      },
      { signal }
    );
    window.addEventListener(
      "pointerup",
      (up) => {
        if (up.pointerId !== pointerId) {
          return;
        }
        if (drag) {
          up.preventDefault();
          up.stopPropagation();
          // Where it was let go, which may be ahead of the last frame.
          drag.pointer = { x: up.clientX, y: up.clientY };
          guardReleaseClick();
        }
        release(true);
      },
      { capture: true, signal }
    );
    window.addEventListener(
      "pointercancel",
      (cancel) => {
        if (cancel.pointerId === pointerId) {
          release(false);
        }
      },
      { signal }
    );
    // The browser's own dragging of a picture or a link would take over.
    window.addEventListener(
      "dragstart",
      (dragstart) => dragstart.preventDefault(),
      { capture: true, signal }
    );
    // From the press, as a touch screen opens its menu for a long press that
    // hasn't moved yet, and then cancels the pointer.
    document.addEventListener(
      "contextmenu",
      (contextmenu) => contextmenu.preventDefault(),
      { signal }
    );
  };

  root.addEventListener("pointerdown", onPointerdown);

  return {
    destroy: () => {
      root.removeEventListener("pointerdown", onPointerdown);
      release(false);
    },
    isDragging: () => drag !== undefined,
  };
};
