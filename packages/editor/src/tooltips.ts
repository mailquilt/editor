import { contains, shadowRootsUpFrom } from "./geometry.js";
import { claim, keyHeardFirst } from "./key-map.js";

/** What has a tooltip: the attribute holds its words. */
const TOOLTIP_TRIGGERS = "[data-tooltip]";

/**
 * Space between a control and its tooltip, which the pointer can cross to reach
 * the tooltip and keep it open.
 */
const OFFSET_PX = 6;

/** The least space between the tooltip and the window's edge. */
const EDGE_PX = 6;

export interface Tooltips {
  /** Moves or closes the tooltip after a re-render, which can move or remove its control. */
  sync: () => void;
  destroy: () => void;
}

const triggerOf = (target: EventTarget | null) =>
  target instanceof Element
    ? (target.closest<HTMLElement>(TOOLTIP_TRIGGERS) ?? undefined)
    : undefined;

/**
 * Where a scroll that moves a control can be heard. A scroll isn't composed, so
 * one inside a shadow root, such as the Shell's, never reaches the window.
 */
const scrollTargetsOf = (root: ShadowRoot): EventTarget[] => [
  window,
  ...shadowRootsUpFrom(root),
];

interface TooltipsHost {
  root: ShadowRoot;
  /** The element that shows the tooltip's words. */
  tooltip: HTMLElement;
}

/**
 * One tooltip for every control under `root` with `data-tooltip`, meeting WCAG
 * 2.2 SC 1.4.13: it opens on hover and on keyboard focus, stays while the
 * pointer is over it, and Escape closes it without moving focus or the pointer.
 * It only repeats a name the control already has, so nothing points to it.
 * A control with `data-tooltip-on="focus"` shows its tooltip only for keyboard
 * focus, and one with `data-tooltip-side="end"` shows it after itself.
 *
 * It takes no pointer events, so it can never cover a control that's pressed.
 * Whether the pointer is over it comes from where the pointer is instead.
 *
 * Where the browser has popovers, it's in the top layer, like the copy that a
 * drag shows, so that a host page that transforms the editor can't move it
 * away from its control.
 */
export const createTooltips = ({ root, tooltip }: TooltipsHost): Tooltips => {
  let hovered: HTMLElement | undefined;
  /** Escape or a press closed it, until hover or focus moves to another control. */
  let dismissed: HTMLElement | undefined;
  const isPopover = typeof tooltip.showPopover === "function";
  if (isPopover) {
    tooltip.popover = "manual";
  }

  const show = (open: boolean) => {
    tooltip.hidden = !open;
    if (isPopover && tooltip.isConnected) {
      tooltip.togglePopover(open);
    }
  };

  const moveBeside = (trigger: HTMLElement) => {
    const box = trigger.getBoundingClientRect();
    const { height, width } = tooltip.getBoundingClientRect();
    // After its control, where that's asked for and there's room, as in a
    // list, where above it would cover the item before.
    const after = box.right + OFFSET_PX;
    if (
      trigger.dataset.tooltipSide === "end" &&
      after + width <= document.documentElement.clientWidth - EDGE_PX
    ) {
      const middle = box.top + box.height / 2 - height / 2;
      const lowest = document.documentElement.clientHeight - height - EDGE_PX;
      tooltip.style.left = `${after}px`;
      tooltip.style.top = `${Math.max(EDGE_PX, Math.min(middle, lowest))}px`;
      return;
    }
    const above = box.top - OFFSET_PX - height;
    const top = above >= EDGE_PX ? above : box.bottom + OFFSET_PX;
    const left = Math.min(
      Math.max(EDGE_PX, box.left + box.width / 2 - width / 2),
      document.documentElement.clientWidth - width - EDGE_PX
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  /**
   * The control with focus from the keyboard, read when it's needed: one of
   * the editor's own, or one the Shell put in its slots, whose focus the
   * editor's root doesn't report.
   */
  const focused = () => {
    const around = root.host.getRootNode();
    const outside =
      around instanceof Document || around instanceof ShadowRoot
        ? around.activeElement
        : null;
    const element =
      root.activeElement ??
      (outside && root.host.contains(outside) ? outside : null);
    const trigger = triggerOf(element);
    return trigger === element && trigger?.matches(":focus-visible")
      ? trigger
      : undefined;
  };

  const update = () => {
    const trigger = hovered ?? focused();
    if (!trigger?.isConnected || trigger === dismissed) {
      show(false);
      return;
    }
    tooltip.textContent = trigger.dataset.tooltip ?? "";
    show(true);
    moveBeside(trigger);
  };

  /** Heard on the root, which types each event as only an `Event`. */
  const onPointerOver = (event: Event) => {
    if (!(event instanceof PointerEvent)) {
      return;
    }
    const trigger = triggerOf(event.target);
    // Pressed, as in a drag, nothing opens, and one that's only for keyboard
    // focus doesn't open on hover.
    if (
      trigger &&
      trigger !== hovered &&
      event.buttons === 0 &&
      trigger.dataset.tooltipOn !== "focus"
    ) {
      dismissed = undefined;
      hovered = trigger;
      update();
    }
  };

  /** Over the control, or over the tooltip and the gap that leads to it. */
  const onPointerMove = ({ clientX, clientY }: PointerEvent) => {
    if (!hovered) {
      return;
    }
    const pointer = { x: clientX, y: clientY };
    const overTooltip =
      !tooltip.hidden && contains(tooltip, pointer, OFFSET_PX);
    if (!(contains(hovered, pointer) || overTooltip)) {
      hovered = undefined;
      update();
    }
  };

  const onPointerDown = () => {
    if (!tooltip.hidden) {
      dismissed = hovered ?? focused();
      update();
    }
  };

  /** Focus from the keyboard on a control opens its tooltip again. */
  const onFocusIn = () => {
    if (focused()) {
      dismissed = undefined;
    }
    update();
  };

  /**
   * Heard on the window, as a hovered control's tooltip shows with focus
   * anywhere on the page.
   */
  const onKeydown = (event: KeyboardEvent) => {
    if (tooltip.hidden) {
      return;
    }
    const shown = hovered ?? focused();
    const binding = keyHeardFirst(
      shown === focused() ? "focusedTooltip" : "hoveredTooltip",
      event
    );
    if (binding) {
      dismissed = shown;
      claim(event, binding);
      update();
    }
  };

  const onScroll = () => {
    if (!tooltip.hidden) {
      update();
    }
  };

  const listeners = new AbortController();
  const { signal } = listeners;
  root.addEventListener("pointerover", onPointerOver, { signal });
  root.addEventListener("focusin", onFocusIn, { signal });
  root.addEventListener("focusout", update, { signal });
  window.addEventListener("keydown", onKeydown, { capture: true, signal });
  window.addEventListener("pointermove", onPointerMove, {
    passive: true,
    signal,
  });
  window.addEventListener("pointerdown", onPointerDown, {
    capture: true,
    signal,
  });
  for (const target of scrollTargetsOf(root)) {
    target.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
      signal,
    });
  }

  return {
    destroy: () => listeners.abort(),
    sync: update,
  };
};
