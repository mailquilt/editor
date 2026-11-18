import { contains, shadowRootsUpFrom } from "./geometry.js";
import { claim, keyFor } from "./key-map.js";

/** What has a tooltip: the attribute holds its words. */
const TOOLTIP_TRIGGERS = "[data-tooltip]";

/** Space between a control and its tooltip, and the tooltip and the window's edge. */
const GAP_PX = 6;

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

/**
 * One tooltip for every control under `root` with `data-tooltip`, meeting WCAG
 * 2.2 SC 1.4.13: it opens on hover and on keyboard focus, stays while the
 * pointer is over it, and Escape closes it without moving focus or the pointer.
 * It only repeats a name the control already has, so nothing points to it.
 *
 * It takes no pointer events, so it can never cover a control that's pressed.
 * Whether the pointer is over it comes from where the pointer is instead.
 *
 * Where the browser has popovers, it's in the top layer, like the copy that a
 * drag shows, so that a host page that transforms the editor can't move it
 * away from its control.
 */
export const createTooltips = (
  root: ShadowRoot,
  tooltip: HTMLElement
): Tooltips => {
  let hovered: HTMLElement | undefined;
  let focused: HTMLElement | undefined;
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

  const place = (trigger: HTMLElement) => {
    const box = trigger.getBoundingClientRect();
    const { height, width } = tooltip.getBoundingClientRect();
    const above = box.top - GAP_PX - height;
    const top = above >= GAP_PX ? above : box.bottom + GAP_PX;
    const left = Math.min(
      Math.max(GAP_PX, box.left + box.width / 2 - width / 2),
      document.documentElement.clientWidth - width - GAP_PX
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const update = () => {
    const trigger = hovered ?? focused;
    if (!trigger?.isConnected || trigger === dismissed) {
      show(false);
      return;
    }
    tooltip.textContent = trigger.dataset.tooltip ?? "";
    show(true);
    place(trigger);
  };

  const onPointerOver = (event: PointerEvent) => {
    const trigger = triggerOf(event.target);
    // Pressed, as in a drag, nothing opens.
    if (trigger && trigger !== hovered && event.buttons === 0) {
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
    const overTooltip = !tooltip.hidden && contains(tooltip, pointer, GAP_PX);
    if (!(contains(hovered, pointer) || overTooltip)) {
      hovered = undefined;
      update();
    }
  };

  const onPointerDown = () => {
    if (!tooltip.hidden) {
      dismissed = hovered ?? focused;
      update();
    }
  };

  const onFocusIn = ({ target }: FocusEvent) => {
    const trigger = triggerOf(target);
    const next =
      trigger === target && trigger?.matches(":focus-visible")
        ? trigger
        : undefined;
    if (next !== focused) {
      dismissed = undefined;
      focused = next;
      update();
    }
  };

  const onFocusOut = ({ relatedTarget }: FocusEvent) => {
    if (!(relatedTarget instanceof Node && focused?.contains(relatedTarget))) {
      focused = undefined;
      update();
    }
  };

  /**
   * Heard on the window, as a hovered control's tooltip shows with focus
   * anywhere on the page.
   */
  const onKeydown = (event: KeyboardEvent) => {
    if (tooltip.hidden) {
      return;
    }
    const shown = hovered ?? focused;
    const binding = keyFor(
      shown === focused ? "focusedTooltip" : "hoveredTooltip",
      event
    );
    if (binding?.action === "closeTooltip") {
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

  const listeners: [
    EventTarget,
    string,
    EventListener,
    AddEventListenerOptions,
  ][] = [
    [root, "pointerover", onPointerOver as EventListener, {}],
    [root, "focusin", onFocusIn as EventListener, {}],
    [root, "focusout", onFocusOut as EventListener, {}],
    [window, "keydown", onKeydown as EventListener, { capture: true }],
    [window, "pointermove", onPointerMove as EventListener, { passive: true }],
    [window, "pointerdown", onPointerDown, { capture: true }],
  ];
  for (const target of scrollTargetsOf(root)) {
    listeners.push([
      target,
      "scroll",
      onScroll,
      { capture: true, passive: true },
    ]);
  }
  for (const [target, type, listener, options] of listeners) {
    target.addEventListener(type, listener, options);
  }

  return {
    destroy: () => {
      for (const [target, type, listener, options] of listeners) {
        target.removeEventListener(type, listener, options);
      }
    },
    sync: update,
  };
};
