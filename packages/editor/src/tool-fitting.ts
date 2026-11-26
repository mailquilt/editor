import { closestPlace, findPlace, findPlaces } from "./editor-places.js";
import { scaleOf } from "./geometry.js";
import { PICKER_GAP_PX } from "./merge-tag-picker.js";
import { fitSelectionBar } from "./selection-bar.js";

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
 * The selected Block's format bar and Merge Tag picker, and the picker that
 * adds a Block, are put beside what they're for by CSS, which can't know how
 * much room is there. The editor clips what reaches
 * past the canvas, such as a format bar under a narrow first Column, and the
 * Selection bar covers the canvas's top. This moves each back in, and keeps the
 * format bar next to its text.
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

  /**
   * The picker between two Blocks is centred on its Column, which near the
   * Canvas's edge can put it past it, where it would be clipped.
   */
  const fitAddPicker = (workspace: HTMLElement) => {
    const picker = findPlace(root, "addPicker");
    // In an empty Column, it's as wide as the Column.
    if (!(picker && closestPlace(picker, "insertPoint"))) {
      return;
    }
    picker.style.removeProperty("--_mq-picker-shift");
    picker.style.removeProperty("--_mq-picker-lift");
    const canvas = workspace.getBoundingClientRect();
    const box = picker.getBoundingClientRect();
    const scaleX = scaleOf(canvas.width, workspace.offsetWidth);
    const scaleY = scaleOf(canvas.height, workspace.offsetHeight);
    const shift = shiftInto(
      box.left,
      box.right,
      canvas.left + GAP_PX * scaleX,
      canvas.right - GAP_PX * scaleX
    );
    if (shift !== 0) {
      picker.style.setProperty("--_mq-picker-shift", `${shift / scaleX}px`);
    }
    // Below its line, or else above it, where the Canvas ends too soon.
    const line = picker.parentElement?.getBoundingClientRect().top ?? box.top;
    if (box.bottom > canvas.bottom - GAP_PX * scaleY) {
      // As far above the line as it was below it.
      const gap = box.top - line;
      const lift = gap + box.height + gap;
      picker.style.setProperty("--_mq-picker-lift", `${-lift / scaleY}px`);
    }
  };

  const fit = () => {
    const workspace = findPlace(root, "workspace");
    if (workspace) {
      fitAddPicker(workspace);
    }
    const bar = findPlace(root, "formatBar");
    const picker = findPlace(root, "mergeTagPicker");
    for (const tool of [bar, picker]) {
      tool?.style.removeProperty("translate");
    }
    const block = (bar ?? picker)?.closest<HTMLElement>("[data-block-id]");
    if (!(workspace && block)) {
      return;
    }
    // Every box is read before anything moves, so the page is laid out once.
    const canvas = workspace.getBoundingClientRect();
    const selectionBar = findPlaces(
      root,
      "blockBar"
    )[0]?.getBoundingClientRect();
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
      top: Math.max(canvas.top, selectionBar?.bottom ?? canvas.top) + gap,
    };

    // Below its line, as CSS puts it, or else above it, or else as far in as
    // it goes. It's over the format bar while it's open.
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

    const { height, width } = from;
    // At the Block's end, as CSS puts it. Wider than the Block, it starts where
    // the Block does instead.
    let left = Math.max(from.left, box.left);
    left += shiftInto(left, left + width, area.left, area.right);
    const fits = (top: number) =>
      top >= area.top && top + height <= area.bottom;
    // Below the text, as CSS puts it, then above the Block. With room for
    // neither, it stays inside the canvas.
    const top =
      [from.top, box.top - gap - height].find(fits) ??
      from.top + shiftInto(from.top, from.bottom, area.top, area.bottom);
    bar.style.translate = `${(left - from.left) / scaleX}px ${(top - from.top) / scaleY}px`;
  };

  let barFrame = 0;
  const observer = new ResizeObserver(() => {
    fit();
    onMove();
    // A frame later, as what it changes can change the sizes observed here,
    // which inside this callback is reported as a ResizeObserver loop.
    cancelAnimationFrame(barFrame);
    barFrame = requestAnimationFrame(() => fitSelectionBar(root));
  });

  return {
    destroy: () => {
      observer.disconnect();
      cancelAnimationFrame(barFrame);
    },
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
      // After each update, before the page is drawn.
      fitSelectionBar(root);
    },
  };
};
