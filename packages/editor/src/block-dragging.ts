import type { Command, RowLayout } from "@mailquilt/core";

import { contains, shadowRootsUpFrom } from "./geometry.js";

/**
 * What a drag brings: a Block or Row on the canvas, a new Block from the palette,
 * or a new Row from the Rows tab.
 */
export type DragSource =
  | { blockId: string }
  | { blockType: string }
  | { rowId: string }
  | { rowLayout: string };

/** Where a drop lands: in a Column, or in a new Row of its own. */
export type DropPlace =
  | { columnId: string; index: number }
  | { rowIndex: number };

/** The Command for a drop, which adds a Row if it landed outside any. */
export const dropCommand = (source: DragSource, place: DropPlace): Command => {
  if ("rowId" in source || "rowLayout" in source) {
    // A Row only lands between Rows, as `landing` finds no Column for one.
    const { rowIndex: index } = place as { rowIndex: number };
    return "rowId" in source
      ? { index, rowId: source.rowId, type: "moveRow" }
      : { index, layout: source.rowLayout as RowLayout, type: "insertRow" };
  }
  if ("blockId" in source) {
    return "columnId" in place
      ? { ...source, ...place, type: "moveBlock" }
      : { ...source, ...place, type: "moveBlockToNewRow" };
  }
  return "columnId" in place
    ? { ...source, ...place, type: "insertBlock" }
    : { ...source, ...place, type: "insertBlockInNewRow" };
};

export interface BlockDragging {
  isDragging: () => boolean;
  destroy: () => void;
}

interface Point {
  x: number;
  y: number;
}

/** The copy that follows the pointer has the same classes, and so does what's in it. */
const NOT_GHOST = ":not([data-drag-ghost], [data-drag-ghost] *)";
export const BLOCKS = `.block${NOT_GHOST}`;
const ROWS = `.row-frame${NOT_GHOST}`;

/** A press alone stays a click, however long it lasts. */
const START_DISTANCE_PX = 5;

/** How far outside the editor a drop still counts, as space below the email. */
const DROP_MARGIN_PX = 40;

/** Near an edge, within this share of a scroll container, a drag scrolls it. */
const SCROLL_EDGE = 0.2;
/** How far a second scrolls with the pointer right at the edge. */
const SCROLL_SPEED_PX = 1500;
/** The time a first frame takes, before there's one before it to go by. */
const FRAME_SECONDS = 1 / 60;
/** How far beside a scroll container the pointer can be and still scroll it. */
const SCROLL_TOLERANCE_PX = 10;

/** A Row, new or on the canvas, which only ever lands between Rows. */
const isRowSource = (source: DragSource) =>
  "rowLayout" in source || "rowId" in source;

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
  const handle = target.closest(".drag-handle");
  const row = (handle?.closest(".row-toolbar") ?? target.closest(".row-tag"))
    ?.parentElement;
  if (row?.matches(ROWS)) {
    return {
      element: row,
      source: { rowId: row.dataset.rowId as string },
      toolbar: row.querySelector(":scope > .row-toolbar") ?? undefined,
    };
  }
  const block = handle?.closest<HTMLElement>(BLOCKS);
  if (handle && block) {
    return {
      element: block,
      source: { blockId: block.dataset.blockId as string },
      toolbar: handle.closest(".block-toolbar") ?? undefined,
    };
  }
  const tile = target.closest<HTMLElement>(
    "[data-block-type], [data-row-layout]"
  );
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

/** How much the host page scales a length, such as with a CSS transform. */
const scaleOf = (onScreen: number, laidOut: number) =>
  Math.abs(onScreen - laidOut) > 1 ? onScreen / laidOut : 1;

/**
 * A copy of what's dragged, fixed to the window. Where the browser has popovers,
 * it's in the top layer, so that nothing on the host page clips it or covers it.
 * It sits beside the original, so the same styles apply, and it's the same size
 * on screen, even on a page that scales the editor, which the top layer leaves out.
 */
const createGhost = (element: HTMLElement) => {
  const { height, left, top, width } = element.getBoundingClientRect();
  const scaleX = scaleOf(width, element.offsetWidth);
  const scaleY = scaleOf(height, element.offsetHeight);
  const ghost = element.cloneNode(true) as HTMLElement;
  ghost.dataset.dragGhost = "";
  ghost.inert = true;
  ghost.setAttribute("aria-hidden", "true");
  // Inline, because the editor's own styles position Blocks and Rows.
  Object.assign(ghost.style, {
    bottom: "auto",
    boxSizing: "border-box",
    height: `${height / scaleY}px`,
    left: `${left}px`,
    margin: "0",
    pointerEvents: "none",
    position: "fixed",
    right: "auto",
    scale: `${scaleX} ${scaleY}`,
    top: `${top}px`,
    transformOrigin: "0 0",
    width: `${width / scaleX}px`,
    zIndex: "2147483647",
  });
  element.after(ghost);
  if (typeof ghost.showPopover === "function") {
    ghost.popover = "manual";
    ghost.showPopover();
  }
  return ghost;
};

interface ScrollContainer {
  element: Element;
  /** The ways its styles let it scroll, as script can scroll hidden overflow. */
  sideways: boolean;
  upAndDown: boolean;
}

const SCROLLS = /auto|scroll|overlay/u;

/**
 * The host's scroll containers, innermost first, then the page. They're found
 * from the host, because the canvas has none of its own.
 */
const scrollContainersOf = (host: Element) => {
  const containers: ScrollContainer[] = [];
  let element: Element | null = host;
  while (element) {
    // The page's own overflow is the window's, which comes last.
    if (element !== document.body && element !== document.documentElement) {
      const { overflowX, overflowY } = getComputedStyle(element);
      const sideways = SCROLLS.test(overflowX);
      const upAndDown = SCROLLS.test(overflowY);
      if (sideways || upAndDown) {
        containers.push({ element, sideways, upAndDown });
      }
    }
    // Up the tree as it's drawn, so through the slot another component shows
    // it in, where that component's own scroll container can be.
    const root = element.getRootNode();
    element =
      element.assignedSlot ??
      element.parentElement ??
      (root instanceof ShadowRoot ? root.host : null);
  }
  // The browser itself won't scroll the window the way the page hides.
  containers.push({
    element: document.scrollingElement ?? document.documentElement,
    sideways: true,
    upAndDown: true,
  });
  return containers;
};

/** Back near the start edge, on near the end, faster closer to it. */
const scrollSpeed = (at: number, start: number, end: number) => {
  const edge = (end - start) * SCROLL_EDGE;
  if (edge <= 0) {
    return 0;
  }
  if (at <= start + edge) {
    return (-SCROLL_SPEED_PX * (start + edge - at)) / edge;
  }
  if (at >= end - edge) {
    return (SCROLL_SPEED_PX * (at - (end - edge))) / edge;
  }
  return 0;
};

/**
 * Scrolls the innermost container that can still go the way the pointer asks.
 * Past an edge still scrolls, as the pointer may leave the window. Whether it
 * moved is read back, which also holds for right-to-left scrolling.
 */
const autoScroll = (
  containers: ScrollContainer[],
  { x, y }: Point,
  seconds: number
) => {
  for (const { element, sideways, upAndDown } of containers) {
    const { bottom, left, right, top } =
      element === document.scrollingElement
        ? { bottom: innerHeight, left: 0, right: innerWidth, top: 0 }
        : element.getBoundingClientRect();
    const { scrollLeft, scrollTop } = element;
    if (
      upAndDown &&
      x >= left - SCROLL_TOLERANCE_PX &&
      x <= right + SCROLL_TOLERANCE_PX
    ) {
      element.scrollTop += scrollSpeed(y, top, bottom) * seconds;
    }
    if (
      sideways &&
      y >= top - SCROLL_TOLERANCE_PX &&
      y <= bottom + SCROLL_TOLERANCE_PX
    ) {
      element.scrollLeft += scrollSpeed(x, left, right) * seconds;
    }
    if (element.scrollTop !== scrollTop || element.scrollLeft !== scrollLeft) {
      return;
    }
  }
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
  ghost: HTMLElement;
  /** When the last frame ran, so a screen of any refresh rate scrolls as fast. */
  lastFrame?: number;
  pointer: Point;
  scrollContainers: ScrollContainer[];
  restoreCursor: () => void;
}

/**
 * Drags Blocks, Rows and palette items with pointer events. The drop position
 * comes from the pointer when the drag ends, so nothing moves until then, and
 * the indicator shows the same answer on the way there. The keyboard has its
 * own way to move each one, through the same Commands.
 */
export const createBlockDragging = ({
  onDrop,
  root,
}: {
  onDrop: (source: DragSource, place: DropPlace) => void;
  root: ShadowRoot;
}): BlockDragging => {
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
    scrollContainers: ScrollContainer[]
  ) => {
    const email = root.querySelector(".email");
    const controls = root.querySelectorAll(".side-panel, .floating-toolbar");
    if (
      !email ||
      (startedOn && contains(startedOn, pointer)) ||
      [...controls].some((control) => contains(control, pointer)) ||
      !contains(root.host, pointer, DROP_MARGIN_PX) ||
      scrollContainers.some(
        (container) =>
          container.element !== document.scrollingElement &&
          !contains(container.element, pointer)
      )
    ) {
      return;
    }
    const column = isRowSource(source)
      ? undefined
      : [...email.querySelectorAll<HTMLElement>(`.column${NOT_GHOST}`)].find(
          (each) => contains(each, pointer)
        );
    const parent = column ?? email;
    const items = [...parent.querySelectorAll(column ? BLOCKS : ROWS)].filter(
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
      place: column
        ? { columnId: column.dataset.columnId as string, index }
        : { rowIndex: index },
    };
  };

  /** The line where a drop would land, and the Column it would land in. */
  const showIndicator = (target?: ReturnType<typeof landing>) => {
    const email = root.querySelector(".email");
    const indicator = root.querySelector<HTMLElement>(".drop-indicator");
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
      indicator.style.left = `${line.left - origin.left}px`;
      indicator.style.top = `${line.y - origin.top}px`;
      indicator.style.width = `${line.width}px`;
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
    const place =
      drop && grab.element.isConnected
        ? landing(grab, dragged.pointer, dragged.scrollContainers)?.place
        : undefined;
    startedOn = undefined;
    dragged.ghost.remove();
    delete grab.element.dataset.dragSource;
    dragged.restoreCursor();
    showIndicator();
    const email = root.querySelector<HTMLElement>(".email");
    if (email) {
      delete email.dataset.dragging;
    }
    if (place) {
      onDrop(grab.source, place);
    }
  };

  // Every frame, because scrolling moves what's under a pointer that keeps still.
  const onFrame = (time: number) => {
    if (!(press && drag)) {
      return;
    }
    const seconds =
      drag.lastFrame === undefined
        ? FRAME_SECONDS
        : (time - drag.lastFrame) / 1000;
    drag.lastFrame = time;
    const { from, grab } = press;
    const { ghost, pointer, scrollContainers } = drag;
    // An undo, or a new email, can take away what's being dragged.
    if (!grab.element.isConnected) {
      release(false);
      return;
    }
    if (startedOn && !contains(startedOn, pointer)) {
      startedOn = undefined;
    }
    ghost.style.translate = `${pointer.x - from.x}px ${pointer.y - from.y}px`;
    autoScroll(scrollContainers, pointer, seconds);
    showIndicator(landing(grab, pointer, scrollContainers));
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
      ghost: createGhost(grab.element),
      pointer: { x: event.clientX, y: event.clientY },
      restoreCursor: showGrabbingCursor(root),
      scrollContainers: scrollContainersOf(root.host),
    };
    // A Block or Row leaves its place empty, but stays in it, so that its text
    // keeps its editor, focus and cursor. The palette keeps its item.
    if (isOnCanvas(grab.source)) {
      grab.element.dataset.dragSource = "";
    }
    const email = root.querySelector<HTMLElement>(".email");
    if (email) {
      // Which, so that only a Block's drag highlights the Columns.
      email.dataset.dragging = isRowSource(grab.source) ? "row" : "block";
    }
    const { signal } = listeners;
    // Escape cancels the drag. This listens first, as controls such as the
    // format bar handle Escape themselves and stop it there.
    window.addEventListener(
      "keydown",
      (keydown) => {
        if (keydown.key === "Escape") {
          keydown.preventDefault();
          keydown.stopPropagation();
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
