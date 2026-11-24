// Svelte's markup types `<mail-quilt>` and `<mail-quilt-shell>` from this,
// which a Svelte app adds with `/// <reference types="@mailquilt/editor/svelte" />`.
// Only types, as `svelte` is the app's own.
import type { HTMLAttributes } from "svelte/elements";

import type { HostAppProperties } from "./host-app.js";
import type { MailQuiltShell } from "./mail-quilt-shell.js";
import type {
  MailQuilt,
  MailQuiltChangeEvent,
  MailQuiltErrorEvent,
} from "./mail-quilt.js";

/**
 * An element's attributes in Svelte's markup: its properties, which Svelte sets
 * as properties because the element has them, and the events both elements fire.
 */
type SvelteElement<
  Element extends EventTarget,
  Props extends keyof Element,
> = HTMLAttributes<Element> &
  Partial<Pick<Element, Props>> & {
    "onmq-change"?: ((event: MailQuiltChangeEvent) => void) | null | undefined;
    "onmq-error"?: ((event: MailQuiltErrorEvent) => void) | null | undefined;
  };

declare module "svelte/elements" {
  interface SvelteHTMLElements {
    "mail-quilt": SvelteElement<MailQuilt, "value" | keyof HostAppProperties>;
    "mail-quilt-shell": SvelteElement<
      MailQuiltShell,
      "actions" | "heading" | "saveKey" | "value" | keyof HostAppProperties
    >;
  }
}
