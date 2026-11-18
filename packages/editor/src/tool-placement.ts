import { scaleOf } from "./geometry.js";

/** Space kept between a tool and the canvas's edge, its Block or the other tool. */
const GAP_PX = 6;

export interface ToolPlacement {
  /** Places the tools again after a re-render, which can add, move or resize them. */
  sync: () => void;
  destroy: () => void;
}

/** How far a span must move to lie within `min` to `max`, by the least. Its start wins. */
const shiftInto = (start: number, end: number, min: number, max: number) =>
  Math.max(min - start, Math.min(0, max - end));

/**
 * The selected Block's toolbar and format bar are placed beside it by CSS,
 * which can't know how much room is there. The editor clips what reaches past
 * the canvas, such as a format bar under a narrow first Column, or the toolbar
 * beside a short last Block. This moves each back in, and keeps the format bar
 * next to its text and off the toolbar where it can.
 *
 * They move again when the canvas, the email or the Block changes size, as
 * when the host resizes or the text gets another line. `onMove` follows that,
 * so a tooltip showing for one of them can move too.
 */
export const createToolPlacement = (
  root: ShadowRoot,
  onMove: () => void
): ToolPlacement => {
  let observed: Element[] = [];

  const place = () => {
    const workspace = root.querySelector<HTMLElement>(".canvas-area");
    const toolbar = root.querySelector<HTMLElement>(".block-toolbar");
    const bar = root.querySelector<HTMLElement>(".format-bar");
    for (const tool of [toolbar, bar]) {
      tool?.style.removeProperty("translate");
    }
    const block = toolbar?.parentElement;
    if (!(workspace && toolbar && block)) {
      return;
    }
    // Every box is read before anything moves, so the page is laid out once.
    const canvas = workspace.getBoundingClientRect();
    const shown = toolbar.getBoundingClientRect();
    const box = block.getBoundingClientRect();
    const from = bar?.getBoundingClientRect();
    // Boxes are on screen, and a translate isn't, where a host page scales
    // the editor.
    const scaleX = scaleOf(canvas.width, workspace.offsetWidth);
    const scaleY = scaleOf(canvas.height, workspace.offsetHeight);
    const gap = GAP_PX * scaleY;
    const area = {
      bottom: canvas.bottom - gap,
      left: canvas.left + GAP_PX * scaleX,
      right: canvas.right - GAP_PX * scaleX,
      top: canvas.top + gap,
    };

    // Beside the Block, in the gutter or over the Column before, so only its
    // height can reach past the canvas.
    const toolsY = shiftInto(shown.top, shown.bottom, area.top, area.bottom);
    toolbar.style.translate = `0 ${toolsY / scaleY}px`;
    if (!(bar && from)) {
      return;
    }
    const tools = {
      bottom: shown.bottom + toolsY,
      left: shown.left,
      right: shown.right,
      top: shown.top + toolsY,
    };

    const { height, width } = from;
    // At the Block's end, as CSS puts it. Wider than the Block, it starts where
    // the Block does instead, clear of the toolbar on that side.
    let left = Math.max(from.left, box.left);
    left += shiftInto(left, left + width, area.left, area.right);
    const fits = (top: number) =>
      top >= area.top &&
      top + height <= area.bottom &&
      (left >= tools.right ||
        left + width <= tools.left ||
        top >= tools.bottom ||
        top + height <= tools.top);
    // Below the text, as CSS puts it, then above the Block, then past either
    // end of the toolbar. With room for none, it stays inside the canvas, over
    // the toolbar.
    const top =
      [
        from.top,
        box.top - gap - height,
        tools.bottom + gap,
        tools.top - gap - height,
      ].find(fits) ??
      from.top + shiftInto(from.top, from.bottom, area.top, area.bottom);
    bar.style.translate = `${(left - from.left) / scaleX}px ${(top - from.top) / scaleY}px`;
  };

  const observer = new ResizeObserver(() => {
    place();
    onMove();
  });

  return {
    destroy: () => observer.disconnect(),
    sync: () => {
      const targets = [
        ...root.querySelectorAll(
          '.canvas-area, .email, .block[aria-current="true"]'
        ),
      ];
      if (
        targets.length !== observed.length ||
        targets.some((target, index) => target !== observed[index])
      ) {
        observer.disconnect();
        for (const target of targets) {
          observer.observe(target);
        }
        observed = targets;
      }
      place();
    },
  };
};
