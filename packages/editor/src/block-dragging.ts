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

/** How far outside the editor a drop still counts, as space below the email. */
const DROP_MARGIN_PX = 40;

const contains = (
  element: Element,
  { x, y }: { x: number; y: number },
  margin = 0
) => {
  const { bottom, left, right, top } = element.getBoundingClientRect();
  return (
    x >= left - margin &&
    x <= right + margin &&
    y >= top - margin &&
    y <= bottom + margin
  );
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
  const droppables = new Map<string, Droppable>();

  /**
   * Where a drop would land now, and the line that shows it. Blocks are counted
   * without the dragged one, as a move's index is. There's no landing far from the
   * editor, which is how to abandon a drag, or on the toolbar, so that letting go
   * of a palette item that barely moved adds nothing.
   */
  const landing = () => {
    const { position, source } = manager.dragOperation;
    const pointer = position.current;
    const email = root.querySelector(".email");
    const toolbar = root.querySelector(".toolbar");
    if (
      !email ||
      (toolbar && contains(toolbar, pointer)) ||
      !contains(root.host, pointer, DROP_MARGIN_PX)
    ) {
      return;
    }
    // Worked out here, because dnd-kit's own target lags behind the pointer.
    const [collision] = manager.collisionObserver.computeCollisions();
    const droppable =
      collision && manager.registry.droppables.get(collision.id);
    const column = droppable?.element?.isConnected
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
        ? { columnId: String(droppable?.id), index }
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
  manager.monitor.addEventListener("dragend", ({ canceled, nativeEvent }) => {
    cancelAnimationFrame(frame);
    showIndicator();
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
    sync: syncElements,
  };
};
