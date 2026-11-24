// Vue's templates type `<mail-quilt>` and `<mail-quilt-shell>` from this, which
// a Vue app adds with `/// <reference types="@mailquilt/editor/vue" />`. Only
// types, as `vue` is the app's own.
import type { EmitFn, HTMLAttributes, PublicProps } from "vue";

import type { HostAppProperties } from "./host-app.js";
import type { MailQuiltShell } from "./mail-quilt-shell.js";
import type {
  MailQuilt,
  MailQuiltChangeEvent,
  MailQuiltErrorEvent,
} from "./mail-quilt.js";

/**
 * An element as Vue's templates read a component: its properties as props, and
 * the events both elements fire, as Vue's guide to Web Components types them.
 */
type VueElement<Element, Props extends keyof Element> = new () => Element & {
  /** @deprecated Not on the element. Vue's templates read its props from here. */
  $props: HTMLAttributes & Partial<Pick<Element, Props>> & PublicProps;
  /** @deprecated Not on the element. Vue's templates read its events from here. */
  $emit: EmitFn<{
    "mq-change": (event: MailQuiltChangeEvent) => void;
    "mq-error": (event: MailQuiltErrorEvent) => void;
  }>;
};

declare module "vue" {
  interface GlobalComponents {
    "mail-quilt": VueElement<MailQuilt, "value" | keyof HostAppProperties>;
    "mail-quilt-shell": VueElement<
      MailQuiltShell,
      "actions" | "heading" | "saveKey" | "value" | keyof HostAppProperties
    >;
  }
}
