import { findPlace, findPlaces } from "./editor-places.js";
import { scaleOf } from "./geometry.js";
import { PICKER_GAP_PX } from "./merge-tag-picker.js";

/** Space kept between a tool and the canvas's edge, its Block or the other tool. */
const GAP_PX = 6;

export interface ToolFitting {
  /** Fits the tools again after a re-render, which can add, move or resize them. */
  sync: () => void;
  destroy: () => void;
}

/** How far a span must move to lie within `min` to `max`, by the least. Its start wins. */
const shiftInto = (start: number, end: number, min: number, max: number) =>
  Math.max(min - start, Math.min(0, max - end));

interface ToolFittingHost {
  onMove: () => void;
  root: ShadowRoot;
}

/**
 * The selected Block's toolbar, format bar and Merge Tag picker are put
 * beside it by CSS, which can't know how much room is there. The editor clips what reaches past
 * the canvas, such as a format bar under a narrow first Column, or the toolbar
 * beside a short last Block. This moves each back in, and keeps the format bar
 * next to its text and off the toolbar where it can.
 *
 * They move again when the canvas, the email or the Block changes size, as
 * when the host resizes or the text gets another line. `onMove` follows that,
 * so a tooltip showing for one of them can move too.
 */
export const createToolFitting = ({
  onMove,
  root,
}: ToolFittingHost): ToolFitting => {
  let observed: Element[] = [];

  const fit = () => {
    const workspace = findPlace(root, "workspace");
    const toolbar = findPlace(root, "blockToolbar");
    const bar = findPlace(root, "formatBar");
    const picker = findPlace(root, "mergeTagPicker");
    for (const tool of [toolbar, bar, picker]) {
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
    const listed = picker?.getBoundingClientRect();
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

    // Below its line, as CSS puts it, or else above it, or else as far in as
    // it goes. It's over the other tools while it's open.
    if (picker && listed) {
      const line = Number(picker.dataset.lineHeight) * scaleY;
      const gapY = PICKER_GAP_PX * scaleY;
      const above = listed.top - gapY - line - gapY - listed.height;
      let pickerY = 0;
      if (listed.bottom > area.bottom) {
        pickerY =
          above >= area.top
            ? above - listed.top
            : shiftInto(listed.top, listed.bottom, area.top, area.bottom);
      }
      const pickerX = shiftInto(
        listed.left,
        listed.right,
        area.left,
        area.right
      );
      picker.style.translate = `${pickerX / scaleX}px ${pickerY / scaleY}px`;
    }
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
    fit();
    onMove();
  });

  return {
    destroy: () => observer.disconnect(),
    sync: () => {
      const targets = [
        findPlace(root, "workspace"),
        findPlace(root, "email"),
        ...findPlaces(root, "block").filter(
          (block) => block.getAttribute("aria-current") === "true"
        ),
      ].filter((target) => target !== null);
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
      fit();
    },
  };
};
