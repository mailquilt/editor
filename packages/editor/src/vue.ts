// Vue's templates type `<mail-quilt>` and `<mail-quilt-shell>` from this, which
// a Vue app adds with `/// <reference types="@mailquilt/editor/vue" />`. Only
// types, as `vue` is the app's own.
// Each of these is exported by every Vue 3. Vue's own `PublicProps` and `EmitFn`,
// which these spell out, aren't exported before 3.4 and 3.5.
import type {
  AllowedComponentProps,
  ComponentCustomProps,
  HTMLAttributes,
  VNodeProps,
} from "vue";

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
  $props: HTMLAttributes &
    Partial<Pick<Element, Props>> &
    VNodeProps &
    AllowedComponentProps &
    ComponentCustomProps;
  /** @deprecated Not on the element. Vue's templates read its events from here. */
  $emit: ((name: "mq-change", event: MailQuiltChangeEvent) => void) &
    ((name: "mq-error", event: MailQuiltErrorEvent) => void);
};

declare module "vue" {
  interface GlobalComponents {
    "mail-quilt": VueElement<
      MailQuilt,
      "theme" | "value" | keyof HostAppProperties
    >;
    "mail-quilt-shell": VueElement<
      MailQuiltShell,
      | "actions"
      | "heading"
      | "saveKey"
      | "theme"
      | "value"
      | keyof HostAppProperties
    >;
  }
}
