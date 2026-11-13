/** Whether a point in the window is over an element or a box, or within `margin` of it. */
export const contains = (
  area: Element | DOMRect,
  { x, y }: { x: number; y: number },
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
