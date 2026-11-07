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
  PreventSelection,
  Scroller,
} from "@dnd-kit/dom";
import { getScrollableAncestors } from "@dnd-kit/dom/utilities";

/** What a drag brings: a Block on the canvas, or a new Block from the palette. */
export type DragSource = { blockId: string } | { blockType: string };

/** Where a drop lands: in a Column, or in a new Row of its own. */
export type DropPlace =
  | { columnId: string; index: number }
  | { rowIndex: number };

export interface BlockDragging {
  /** Matches the draggable and droppable elements to what's on the canvas now. */
  sync: () => void;
  destroy: () => void;
}

/** The copy that dnd-kit leaves behind while dragging has the same attributes. */
const NOT_PLACEHOLDER = ":not([data-dnd-placeholder])";
const BLOCKS = `.block${NOT_PLACEHOLDER}`;

const midpointY = (element: Element) => {
  const { bottom, top } = element.getBoundingClientRect();
  return (top + bottom) / 2;
};

const contains = (element: Element, { x, y }: { x: number; y: number }) => {
  const { bottom, left, right, top } = element.getBoundingClientRect();
  return x >= left && x <= right && y >= top && y <= bottom;
};

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
    plugins: [AutoScroller, Cursor, Feedback, PreventSelection],
    // Keyboard controls use Commands of their own, not a dragged Block.
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
  const droppables = new Map<string, Droppable>();

  /**
   * Where a drop would land now, and the line that shows it. Blocks are counted
   * without the dragged one, as a move's index is. A Column that an undo has just
   * removed no longer counts as one. The toolbar isn't a place to drop, so that
   * letting go of a palette item that barely moved adds nothing.
   */
  const landing = () => {
    const { position, source, target } = manager.dragOperation;
    const pointer = position.current;
    const toolbar = root.querySelector(".toolbar");
    if (toolbar && contains(toolbar, pointer)) {
      return;
    }
    const column = target?.element?.isConnected ? target.element : undefined;
    const parent = column ?? (root.querySelector(".email") as Element);
    const items = [...parent.querySelectorAll(column ? BLOCKS : ".row")].filter(
      (element) => element !== source?.element
    );
    const index = items.filter(
      (element) => midpointY(element) < pointer.y
    ).length;
    const next = items[index];
    // A Row's controls come before it, and a new Row goes above those.
    const nextEdge = column ? next : next?.previousElementSibling;
    const box = parent.getBoundingClientRect();
    return {
      line: {
        left: box.left,
        width: box.width,
        y:
          nextEdge?.getBoundingClientRect().top ??
          items.at(-1)?.getBoundingClientRect().bottom ??
          box.top,
      },
      place: column
        ? { columnId: String(target?.id), index }
        : { rowIndex: index },
    };
  };

  const showIndicator = (line?: { left: number; width: number; y: number }) => {
    const email = root.querySelector(".email");
    const indicator = root.querySelector<HTMLElement>(".drop-indicator");
    if (!(email && indicator)) {
      return;
    }
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
      draggable.element = element;
      draggable.handle = handle;
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
    showIndicator(landing()?.line);
    frame = requestAnimationFrame(trackPointer);
  };
  manager.monitor.addEventListener("dragstart", () => {
    scrollable = getScrollableAncestors(root.host, {
      escapeShadowDOM: true,
      excludeElement: false,
    });
    trackPointer();
  });

  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  manager.monitor.addEventListener("dragend", ({ canceled }) => {
    cancelAnimationFrame(frame);
    showIndicator();
    const { source } = manager.dragOperation;
    // An undo during the drag can take away the Block being dragged.
    const place =
      canceled || !source?.element?.isConnected ? undefined : landing()?.place;
    if (source && place) {
      onDrop(source.data as DragSource, place);
    }
    // Once the drag has finished. Its source getting a new element sooner would
    // make dnd-kit lift that element and never put it down.
    syncTimer = setTimeout(syncElements, 0);
  });

  return {
    destroy: () => {
      cancelAnimationFrame(frame);
      clearTimeout(syncTimer);
      manager.destroy();
    },
    sync: () => {
      if (manager.dragOperation.status.idle) {
        syncElements();
      }
    },
  };
};
