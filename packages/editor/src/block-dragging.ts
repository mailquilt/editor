import { pointerIntersection } from "@dnd-kit/collision";
import {
  AutoScroller,
  Cursor,
  DragDropManager,
  Draggable,
  Droppable,
  Feedback,
  PointerActivationConstraints,
  PointerSensor,
  Scroller,
} from "@dnd-kit/dom";
import { getScrollableAncestors } from "@dnd-kit/dom/utilities";

import { contains } from "./geometry.js";

/**
 * What a drag brings: a Block on the canvas, a new Block from the palette, or a
 * new Row from the Rows tab.
 */
export type DragSource =
  | { blockId: string }
  | { blockType: string }
  | { rowLayout: string };

/** Where a drop lands: in a Column, or in a new Row of its own. */
export type DropPlace =
  | { columnId: string; index: number }
  | { rowIndex: number };

export interface BlockDragging {
  /** Matches the draggable and droppable elements to what's on the canvas now. */
  sync: () => void;
  isDragging: () => boolean;
  destroy: () => void;
}

/** The copy that dnd-kit leaves behind while dragging has the same attributes. */
const NOT_PLACEHOLDER = ":not([data-dnd-placeholder])";
export const BLOCKS = `.block${NOT_PLACEHOLDER}`;

const isRowSource = (data: unknown) =>
  typeof data === "object" && data !== null && "rowLayout" in data;

const midpointY = (element: Element) => {
  const { bottom, top } = element.getBoundingClientRect();
  return (top + bottom) / 2;
};

/** How far outside the editor a drop still counts, as space below the email. */
const DROP_MARGIN_PX = 40;

const removeExcept = (
  entities: Map<string, Draggable | Droppable>,
  ids: Set<string>
) => {
  for (const [id, entity] of entities) {
    if (!ids.has(id)) {
      entity.destroy();
      entities.delete(id);
    }
  }
};

/**
 * Drags the Blocks and palette items under `root`, using `Draggable` and
 * `Droppable` but not `Sortable`, which has an open Shadow DOM issue (ADR 0002).
 * The drop position comes from the pointer when the drag ends, so nothing moves
 * until then, and the indicator shows the same answer on the way there.
 */
export const createBlockDragging = ({
  onDrop,
  root,
}: {
  onDrop: (source: DragSource, place: DropPlace) => void;
  root: ShadowRoot;
}): BlockDragging => {
  const manager = new DragDropManager({
    // Not PreventSelection, which would clear the cursor in the Block being edited.
    // A press on a handle or palette item doesn't start a selection anyway.
    plugins: [AutoScroller, Cursor, Feedback],
    // Only the pointer drags. Keyboard moves won't go through a dragged Block.
    sensors: [
      PointerSensor.configure({
        // A press alone stays a click, however long it lasts.
        activationConstraints: () => [
          new PointerActivationConstraints.Distance({ value: 5 }),
        ],
      }),
    ],
  });
  const draggables = new Map<string, Draggable>();
  /**
   * The selected Block's toolbar, where its handle is, until the pointer first
   * leaves it. It's outside the Block, so letting go there after a short drag
   * would otherwise land somewhere else. Once the drag has gone further, it
   * lands there like anywhere else.
   */
  let startedOn: DOMRect | undefined;
  const droppables = new Map<string, Droppable>();

  /**
   * Where a drop would land now, and the line that shows it. Blocks are counted
   * without the dragged one, as a move's index is. There's no landing far from the
   * editor, which is how to abandon a drag, or on the side panel, so that letting
   * go of a palette item that barely moved adds nothing, or on the floating
   * toolbar.
   */
  const landing = () => {
    const { position, source } = manager.dragOperation;
    const pointer = position.current;
    const email = root.querySelector(".email");
    const controls = root.querySelectorAll(".side-panel, .floating-toolbar");
    if (
      !email ||
      (startedOn && contains(startedOn, pointer)) ||
      [...controls].some((element) => contains(element, pointer)) ||
      !contains(root.host, pointer, DROP_MARGIN_PX)
    ) {
      return;
    }
    // Worked out here, because dnd-kit's own target lags behind the pointer.
    const [collision] = manager.collisionObserver.computeCollisions();
    const droppable =
      collision && manager.registry.droppables.get(collision.id);
    // A new Row only ever lands between Rows.
    const column =
      droppable?.element?.isConnected && !isRowSource(source?.data)
        ? droppable.element
        : undefined;
    const parent = column ?? email;
    const items = [...parent.querySelectorAll(column ? BLOCKS : ".row")].filter(
      (element) => element !== source?.element
    );
    const index = items.filter(
      (element) => midpointY(element) < pointer.y
    ).length;
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
        ? { columnId: String(droppable?.id), index }
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
    const landsIn = target?.column as HTMLElement | undefined;
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

  const syncDraggable = (
    id: string,
    element: Element,
    data: DragSource,
    handle?: Element
  ) => {
    const draggable = draggables.get(id);
    if (draggable) {
      // Giving the dragged one a new element would make dnd-kit lift that element
      // and never put it down, so it waits for the drag to finish.
      if (!draggable.isDragSource) {
        draggable.element = element;
        draggable.handle = handle;
      }
      return;
    }
    draggables.set(
      id,
      new Draggable(
        {
          data,
          element,
          handle,
          id,
          plugins: [
            Feedback.configure({
              // The drop puts the Block in its new place, with nothing to animate.
              dropAnimation: null,
              // The palette keeps its button while a copy follows the pointer.
              feedback: handle ? "default" : "clone",
            }),
          ],
        },
        manager
      )
    );
  };

  const syncElements = () => {
    const draggableIds = new Set<string>();
    for (const element of root.querySelectorAll<HTMLElement>(BLOCKS)) {
      const blockId = element.dataset.blockId as string;
      draggableIds.add(blockId);
      syncDraggable(
        blockId,
        element,
        { blockId },
        element.querySelector(".drag-handle") as Element
      );
    }
    for (const element of root.querySelectorAll<HTMLElement>(
      `[data-block-type]${NOT_PLACEHOLDER}`
    )) {
      const blockType = element.dataset.blockType as string;
      const id = `palette:${blockType}`;
      draggableIds.add(id);
      syncDraggable(id, element, { blockType });
    }
    for (const element of root.querySelectorAll<HTMLElement>(
      `[data-row-layout]${NOT_PLACEHOLDER}`
    )) {
      const rowLayout = element.dataset.rowLayout as string;
      const id = `layout:${rowLayout}`;
      draggableIds.add(id);
      syncDraggable(id, element, { rowLayout });
    }
    const { source } = manager.dragOperation;
    if (source) {
      draggableIds.add(String(source.id));
    }
    removeExcept(draggables, draggableIds);

    const columnIds = new Set<string>();
    for (const element of root.querySelectorAll<HTMLElement>(".column")) {
      const id = element.dataset.columnId as string;
      columnIds.add(id);
      const droppable = droppables.get(id);
      if (droppable) {
        droppable.element = element;
      } else {
        droppables.set(
          id,
          new Droppable(
            { collisionDetector: pointerIntersection, element, id },
            manager
          )
        );
      }
    }
    removeExcept(droppables, columnIds);
  };

  // dnd-kit stops looking for these at the Shadow DOM boundary, which leaves it
  // nothing to scroll while the pointer is over the canvas.
  let scrollable: Set<Element> | null = null;
  const scroller = manager.registry.plugins.get(Scroller);
  if (scroller) {
    scroller.getScrollableElements = () => scrollable;
  }

  // Every frame, because scrolling moves what's under a pointer that keeps still.
  let frame = 0;
  const trackPointer = () => {
    if (
      startedOn &&
      !contains(startedOn, manager.dragOperation.position.current)
    ) {
      startedOn = undefined;
    }
    showIndicator(landing());
    frame = requestAnimationFrame(trackPointer);
  };
  manager.monitor.addEventListener("dragstart", () => {
    const email = root.querySelector<HTMLElement>(".email");
    if (email) {
      // Which, so that only a Block's drag highlights the Columns.
      email.dataset.dragging = isRowSource(manager.dragOperation.source?.data)
        ? "row"
        : "block";
    }
    scrollable = getScrollableAncestors(root.host, {
      escapeShadowDOM: true,
      excludeElement: false,
    });
    trackPointer();
  });

  // Lifting a Block takes it out of the page before its placeholder comes in. With
  // a tall one, Firefox and WebKit would see a shorter page and scroll up to fit.
  manager.monitor.addEventListener("beforedragstart", () => {
    const email = root.querySelector<HTMLElement>(".email");
    if (email) {
      email.style.minHeight = `${email.getBoundingClientRect().height}px`;
    }
    // Before the Block is lifted, which takes its toolbar along.
    const { source } = manager.dragOperation;
    startedOn = (source as Draggable | null)?.handle
      ?.closest(".block-toolbar")
      ?.getBoundingClientRect();
  });

  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  manager.monitor.addEventListener("dragend", ({ canceled, nativeEvent }) => {
    cancelAnimationFrame(frame);
    showIndicator();
    const email = root.querySelector<HTMLElement>(".email");
    if (email) {
      delete email.dataset.dragging;
      email.style.removeProperty("min-height");
    }
    const { position, source } = manager.dragOperation;
    // An undo during the drag can take away the Block being dragged.
    if (!canceled && source?.element?.isConnected) {
      // The pointer may have moved since the last frame, and the page scrolled.
      if (nativeEvent instanceof PointerEvent) {
        position.current = { x: nativeEvent.clientX, y: nativeEvent.clientY };
      }
      for (const droppable of droppables.values()) {
        droppable.refreshShape();
      }
      const place = landing()?.place;
      if (place) {
        onDrop(source.data as DragSource, place);
      }
    }
    // Once the drag has finished, for the element that had to wait.
    syncTimer = setTimeout(syncElements, 0);
  });

  return {
    destroy: () => {
      // First, because this ends any drag, which sets the timer.
      manager.destroy();
      cancelAnimationFrame(frame);
      clearTimeout(syncTimer);
    },
    isDragging: () => manager.dragOperation.status.dragging,
    sync: syncElements,
  };
};
