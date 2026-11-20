import { contains } from "./geometry.js";
import type { Point } from "./geometry.js";

/**
 * Scrolls what the editor is in while a drag nears an edge, every frame,
 * because the pointer can keep still at the edge.
 */

/**
 * Near an edge, within this share of a scroll container and no further than
 * SCROLL_EDGE_PX, a drag scrolls it. A tall window's share would scroll as soon
 * as a Block near its top or bottom is picked up.
 */
const SCROLL_EDGE = 0.2;
const SCROLL_EDGE_PX = 60;
/** How far a second scrolls with the pointer at the edge or past it. */
const SCROLL_SPEED_PX = 1500;
/** The time a first frame takes, before there's one before it to go by. */
const FRAME_SECONDS = 1 / 60;
/**
 * The longest a frame counts for, so the first one after the tab was in the
 * background, or the page was busy, doesn't jump.
 */
const MAX_FRAME_SECONDS = 0.1;
/** How far beside a scroll container the pointer can be and still scroll it. */
const SCROLL_TOLERANCE_PX = 10;

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
  const edge = Math.min((end - start) * SCROLL_EDGE, SCROLL_EDGE_PX);
  if (edge <= 0) {
    return 0;
  }
  if (at <= start + edge) {
    return -SCROLL_SPEED_PX * Math.min((start + edge - at) / edge, 1);
  }
  if (at >= end - edge) {
    return SCROLL_SPEED_PX * Math.min((at - (end - edge)) / edge, 1);
  }
  return 0;
};

/**
 * Scrolls the innermost container that can still go the way the pointer asks.
 * Past an edge still scrolls, as the pointer may leave the window. Whether it
 * moved is read back, which also holds for right-to-left scrolling.
 */
const scrollToward = (
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

export type AutoScroll = ReturnType<typeof createAutoScroll>;

/** For one drag of something in `host`, from the frame it starts. */
export const createAutoScroll = (host: Element) => {
  const containers = scrollContainersOf(host);
  /** When the last frame ran, so a screen of any refresh rate scrolls as fast. */
  let lastFrame: number | undefined;

  return {
    /** One frame of the drag, with the pointer where it is now. */
    frame(pointer: Point, time: number) {
      // The first frame runs as the drag starts, at a time that can be later
      // than the next frame's.
      const seconds =
        lastFrame === undefined
          ? FRAME_SECONDS
          : Math.min(Math.max((time - lastFrame) / 1000, 0), MAX_FRAME_SECONDS);
      lastFrame = time;
      scrollToward(containers, pointer, seconds);
    },

    /**
     * Whether a point is inside every scroll container the host is in, and so
     * not scrolled out of sight. The window's is left out, as the pointer may
     * leave it.
     */
    shows: (pointer: Point) =>
      containers.every(
        (container) =>
          container.element === document.scrollingElement ||
          contains(container.element, pointer)
      ),
  };
};
