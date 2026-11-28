import { closestPlace } from "./editor-places.js";

/** A point in the window, as a pointer event gives it. */
export interface Point {
  x: number;
  y: number;
}

/** Whether a point in the window is over an element or a box, or within `margin` of it. */
export const contains = (
  area: Element | DOMRect,
  { x, y }: Point,
  margin = 0
) => {
  const { bottom, left, right, top } =
    area instanceof Element ? area.getBoundingClientRect() : area;
  return (
    x >= left - margin &&
    x <= right + margin &&
    y >= top - margin &&
    y <= bottom + margin
  );
};

/** Lengths this close are the same, as one is rounded and the other isn't. */
const ROUNDING_PX = 1;

/** How much the host page scales a length, such as with a CSS transform. */
export const scaleOf = (onScreen: number, laidOut: number) =>
  Math.abs(onScreen - laidOut) > ROUNDING_PX ? onScreen / laidOut : 1;

/**
 * `root` and each shadow root around it, up to the page. What the page has, such
 * as a scroll event or a style sheet, doesn't reach inside them.
 */
export const shadowRootsUpFrom = (root: ShadowRoot) => {
  const roots: ShadowRoot[] = [];
  for (
    let node: Node = root;
    node instanceof ShadowRoot;
    node = node.host.getRootNode()
  ) {
    roots.push(node);
  }
  return roots;
};

/**
 * The room a popover has: the editor, which clips it, below its top bar, which
 * stays in sight as the page scrolls, and in the window.
 */
export const roomFor = (anchor: Element) => {
  const editor = closestPlace(anchor, "editor")?.getBoundingClientRect();
  // Such as "52px".
  const topBar = Number(
    getComputedStyle(anchor)
      .getPropertyValue("--_mq-top-bar-height")
      .trim()
      .slice(0, -2)
  );
  return {
    bottom: Math.min(editor?.bottom ?? innerHeight, innerHeight),
    top: Math.max(editor?.top ?? 0, 0) + (topBar || 0),
  };
};
