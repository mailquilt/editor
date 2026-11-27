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

/** Where dropped files land: on an Image Block, or where a new Block would. */
export type FileDropTarget = DropPosition | { blockId: string };

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
  /** What the copy that follows the pointer is of, if not `element`. */
  ghostOf?: HTMLElement;
  source: DragSource;
}

/**
 * What a press on `target` picks up: a Block by its handle, a Row by its tag
 * or its picture in the Rows list, or a tile in the Add panel.
 */
const grabAt = (target: Element): Grab | undefined => {
  const item =
    closestPlace(target, "rowsItems") &&
    target.closest<HTMLElement>("[data-row-id]");
  // Collapsed, the list has no pictures, and its numbers only select.
  const picture = item && findPlace(item, "rowPicture")?.parentElement;
  if (item && picture) {
    return {
      element: item,
      ghostOf: picture,
      source: { rowId: item.dataset.rowId as string },
    };
  }
  const tag = closestPlace(target, "rowTag");
  const row = tag && closestPlace(tag, "row");
  if (row) {
    return {
      element: row,
      source: { rowId: row.dataset.rowId as string },
    };
  }
  const handle = closestPlace(target, "dragHandle");
  const block = handle && closestPlace(handle, "block");
  if (handle && block) {
    return {
      element: block,
      source: { blockId: block.dataset.blockId as string },
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
 * captured, which isn't something the user pressed. Chromium, Firefox and
 * WebKit all do.
 */
const stopReleaseClick = (click: MouseEvent) => {
  if (click.target === document.body && click.detail > 0) {
    click.preventDefault();
    click.stopImmediatePropagation();
  }
};

/** Stops the click of a release that ends a drag, until the next task. */
const guardReleaseClick = () => {
  const guard = new AbortController();
  window.addEventListener("click", stopReleaseClick, {
    capture: true,
    signal: guard.signal,
  });
  setTimeout(() => guard.abort(), 0);
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
  /** Whether files can be dropped, as each needs the Host app to upload it. */
  acceptsFiles: () => boolean;
  onDrop: (source: DragSource, position: DropPosition) => void;
  onDropFiles: (files: File[], target: FileDropTarget) => void;
  root: ShadowRoot;
  /** Whether a Block takes a file dropped on it, as an Image Block does. */
  takesFiles: (blockId: string) => boolean;
}

/** What's under a drop, and the line that shows where it lands, if any. */
interface Shown {
  line?: { left: number; width: number; y: number };
  /** The line is in the Rows list, rather than on the email. */
  inList?: boolean;
  /** The Column it lands in, or the Block that takes it. */
  over?: HTMLElement;
}

/**
 * Whether `element` is the Row being moved, on the email or in the Rows list,
 * which a move's index doesn't count, wherever the drag started.
 */
const isMoved = (element: HTMLElement, source: DragSource) =>
  "rowId" in source && element.dataset.rowId === source.rowId;

/** Where a Row dropped on the Rows list would land, among its Rows. */
const listLanding = (
  list: HTMLElement,
  pointer: Point,
  source: DragSource
): Shown & { position: DropPosition } => {
  const items = [...list.querySelectorAll<HTMLElement>("[data-row-id]")].filter(
    (each) => !isMoved(each, source)
  );
  const index = items.filter((each) => midpointY(each) < pointer.y).length;
  const next = items[index];
  const previous = items[index - 1];
  const box = list.getBoundingClientRect();
  // Halfway across the gap between two Rows.
  const y =
    next && previous
      ? (previous.getBoundingClientRect().bottom +
          next.getBoundingClientRect().top) /
        2
      : (next?.getBoundingClientRect().top ??
        previous?.getBoundingClientRect().bottom ??
        box.top);
  return {
    inList: true,
    line: { left: box.left, width: box.width, y },
    position: { rowIndex: index },
  };
};

/**
 * Drags Blocks, Rows, from the Canvas or the Rows list, and the Add panel's
 * tiles with pointer events, and takes files
 * dragged in from outside. The drop position comes from the pointer when the
 * drag ends, so nothing moves until then, and the indicator shows the same
 * answer on the way there. The keyboard has its own way to move each one,
 * through the same Commands.
 */
export const createDragging = ({
  acceptsFiles,
  onDrop,
  onDropFiles,
  root,
  takesFiles,
}: DraggingHost): Dragging => {
  /** A press that may still turn into a drag, and the drag once it has. */
  let press: Press | undefined;
  let drag: Drag | undefined;
  let frame = 0;

  /**
   * Where a drop of `source` would land now, and the line that shows it. Blocks
   * are counted without the `dragged` one, as a move's index is. A Row lands
   * among the Rows list's Rows over it. There's no landing far from the
   * editor, which is how to abandon a drag, or elsewhere on the Rows list, or
   * on the Add panel or the picker, so that letting go of a tile that barely moved adds
   * nothing, or on the Selection bar, its popovers, menu and More panel or the floating
   * toolbar, which are over the email or beside it. Nor is there outside a
   * scroll container the editor is in, such as the Shell's, where what's under
   * the pointer is scrolled out of sight.
   */
  const landing = (
    source: DragSource,
    pointer: Point,
    autoScroll: AutoScroll,
    dragged?: Element
  ): (Shown & { position: DropPosition }) | undefined => {
    const email = findPlace(root, "email");
    const list = findPlace(root, "rowsItems");
    // A Row over the Rows list's Rows lands among them there, and nothing
    // else lands on the list. Its Rows scroll inside it, under its head.
    if (
      list?.parentElement &&
      contains(list.parentElement, pointer) &&
      contains(list, pointer) &&
      autoScroll.shows(pointer)
    ) {
      return isRowSource(source)
        ? listLanding(list, pointer, source)
        : undefined;
    }
    const controls = [
      ...findPlaces(root, "rowsList"),
      ...findPlaces(root, "addPanel"),
      // The picker between Blocks, over the email. One in an empty Column is
      // that Column, which still takes a drop.
      ...findPlaces(root, "addPicker").filter((picker) =>
        closestPlace(picker, "insertPoint")
      ),
      ...findPlaces(root, "emailTools"),
      ...findPlaces(root, "blockBar"),
      ...findPlaces(root, "rowBar"),
      ...findPlaces(root, "columnBar"),
      ...findPlaces(root, "emailBar"),
      // Hanging from the bar over the email, outside the bar's own box.
      ...findPlaces(root, "barPopover"),
      ...findPlaces(root, "barMenu"),
      ...findPlaces(root, "morePanel"),
    ];
    if (
      !email ||
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
      (each) => each !== dragged && !isMoved(each, source)
    );
    const index = items.filter((each) => midpointY(each) < pointer.y).length;
    const next = items[index];
    const box = parent.getBoundingClientRect();
    return {
      line: {
        left: box.left,
        width: box.width,
        y:
          next?.getBoundingClientRect().top ??
          items.at(-1)?.getBoundingClientRect().bottom ??
          box.top,
      },
      over: column,
      position: column
        ? { columnId: column.dataset.columnId as string, index }
        : { rowIndex: index },
    };
  };

  /** The line in the Rows list, which the list's own styles place across it. */
  const showListIndicator = (target?: Shown) => {
    const list = findPlace(root, "rowsItems");
    const indicator = list && findPlace(list, "rowsDropIndicator");
    if (!(list && indicator)) {
      return;
    }
    const line = target?.inList ? target.line : undefined;
    indicator.hidden = !line;
    if (line) {
      const origin = list.getBoundingClientRect();
      const scaleY = scaleOf(origin.height, list.offsetHeight);
      indicator.style.top = `${(line.y - origin.top) / scaleY}px`;
    }
  };

  /** The line where a drop would land, and the Column or Block it lands in. */
  const showIndicator = (target?: Shown) => {
    showListIndicator(target);
    const email = findPlace(root, "email");
    const indicator = findPlace(root, "dropIndicator");
    if (!(email && indicator)) {
      return;
    }
    const landsIn = target?.over;
    for (const each of email.querySelectorAll<HTMLElement>(
      "[data-drop-target]"
    )) {
      if (each !== landsIn) {
        delete each.dataset.dropTarget;
      }
    }
    if (landsIn) {
      landsIn.dataset.dropTarget = "";
    }
    const line = target?.inList ? undefined : target?.line;
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
        ? landing(
            grab.source,
            dragged.pointer,
            dragged.autoScroll,
            grab.element
          )?.position
        : undefined;
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
    ghost.style.translate = `${pointer.x - from.x}px ${pointer.y - from.y}px`;
    autoScroll.frame(pointer, time);
    showIndicator(landing(grab.source, pointer, autoScroll, grab.element));
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
    drag = {
      // A Row's drag scrolls the Rows list too, to land in a long one.
      autoScroll: createAutoScroll(
        root.host,
        isRowSource(grab.source)
          ? (findPlace(root, "rowsItems")?.parentElement ?? undefined)
          : undefined
      ),
      ghost: createDragGhost(grab.ghostOf ?? grab.element),
      pointer: { x: event.clientX, y: event.clientY },
      restoreCursor: showGrabbingCursor(root),
    };
    // A Block or Row stays where it was, unseen, so that its text keeps its
    // editor, focus and cursor. The Add panel keeps its tile.
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

  /** Heard on the root, which types each event as only an `Event`. */
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

  /**
   * Where files dragged in from outside would land: where a new Block from the
   * Add panel would, unless it's on a Block that takes them. Only over the canvas,
   * as the browser says, and not over the Preview or the narrow notice above it.
   */
  const fileLanding = (
    event: DragEvent
  ): (Shown & { position: FileDropTarget }) | undefined => {
    const [under] = event.composedPath();
    const email = findPlace(root, "email");
    if (
      drag ||
      !acceptsFiles() ||
      !email ||
      !(under instanceof Element) ||
      !closestPlace(under, "workspace")
    ) {
      return undefined;
    }
    const pointer = { x: event.clientX, y: event.clientY };
    const landed = landing(
      { blockType: "image" },
      pointer,
      createAutoScroll(root.host)
    );
    const block =
      landed &&
      findPlaces(email, "block").find((each) => contains(each, pointer));
    const blockId = block?.dataset.blockId;
    if (block && blockId !== undefined && takesFiles(blockId)) {
      return { over: block, position: { blockId } };
    }
    return landed;
  };

  /** Shows where files would land, as a Block's drag does, or stops. */
  const showFileDrag = (target?: Shown) => {
    const email = findPlace(root, "email");
    if (email && target) {
      email.dataset.dragging = "block";
    } else if (email) {
      delete email.dataset.dragging;
    }
    showIndicator(target);
  };

  /**
   * Files dragged in from outside come as the browser's own drag events, which
   * pointer events don't see. Heard on their way in, before a Block's text, which
   * would take them itself. Anywhere they can't land, they're refused, so that
   * the browser doesn't open them in place of the page.
   */
  const onFileDrag = (event: DragEvent) => {
    const { dataTransfer } = event;
    if (!dataTransfer?.types.includes("Files")) {
      return;
    }
    // Leaving one element for another, the next comes straight after.
    if (event.type === "dragleave") {
      if (!drag) {
        showFileDrag();
      }
      return;
    }
    const target = fileLanding(event);
    event.preventDefault();
    dataTransfer.dropEffect = target ? "copy" : "none";
    if (event.type !== "drop") {
      showFileDrag(target);
      return;
    }
    showFileDrag();
    if (target) {
      onDropFiles([...dataTransfer.files], target.position);
    }
  };

  const presses = new AbortController();
  root.addEventListener("pointerdown", onPointerdown, {
    signal: presses.signal,
  });
  for (const type of ["dragover", "dragleave", "drop"]) {
    root.host.addEventListener(type, onFileDrag as EventListener, {
      capture: true,
      signal: presses.signal,
    });
  }

  return {
    destroy: () => {
      presses.abort();
      release(false);
    },
    isDragging: () => drag !== undefined,
  };
};
