import { scaleOf } from "./geometry.js";

/** In front of everything, where the browser has no popovers. */
const FRONT_Z_INDEX = String(2 ** 31 - 1);

/**
 * A copy of what's dragged, fixed to the window. Where the browser has popovers,
 * it's in the top layer, so that nothing on the host page clips it or covers it.
 * It sits beside the original, so the same styles apply, and it's the same size
 * on screen, even on a page that scales the editor, which the top layer leaves out.
 */
export const createDragGhost = (element: HTMLElement) => {
  const { height, left, top, width } = element.getBoundingClientRect();
  const scaleX = scaleOf(width, element.offsetWidth);
  const scaleY = scaleOf(height, element.offsetHeight);
  const ghost = element.cloneNode(true) as HTMLElement;
  ghost.dataset.dragGhost = "";
  ghost.inert = true;
  ghost.setAttribute("aria-hidden", "true");
  // Inline, because the editor's own styles lay out Blocks and Rows.
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
    zIndex: FRONT_Z_INDEX,
  });
  element.after(ghost);
  if (typeof ghost.showPopover === "function") {
    ghost.popover = "manual";
    ghost.showPopover();
  }
  return ghost;
};
