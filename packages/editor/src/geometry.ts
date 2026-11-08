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
