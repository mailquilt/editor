import * as v from "valibot";

import { paddingEntries } from "./box-settings.js";

// Showing on a device, and Phone values: what a Block, a Row or a Column has
// apart from the desktop, below the phone breakpoint.

/**
 * The devices a Block or Row can show on alone. Unset, it shows on all.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const SHOW_ON = ["desktop", "phone"] as const;

export type ShowOn = (typeof SHOW_ON)[number];

/**
 * Phone values: one optional object holding only the settings that can have
 * one, which are padding and whatever `own` adds, such as a font size.
 */
export const phoneEntry = <Own extends v.ObjectEntries = Record<never, never>>(
  own: Own = {} as Own
) => ({
  phone: v.optional(v.strictObject({ ...paddingEntries, ...own })),
});

/** What a Block and a Row share: the devices they show on, and Phone values. */
export const deviceEntries = <
  Own extends v.ObjectEntries = Record<never, never>,
>(
  own: Own = {} as Own
) => ({
  ...phoneEntry(own),
  showOn: v.optional(v.picklist(SHOW_ON)),
});

/**
 * A Block, Row or Column as a phone shows it: each Phone value in place of
 * its setting. Its props must be valid, as in a loaded document.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const onPhone = <Item extends { props: object }>(item: Item): Item => {
  const { phone, ...props } = item.props as { phone?: object };
  return phone === undefined
    ? item
    : { ...item, props: { ...props, ...phone } };
};

/**
 * Whether a Block or Row is left out on `device`.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const isHiddenOn = ({ props }: { props: object }, device: ShowOn) => {
  const { showOn } = props as { showOn?: ShowOn };
  return showOn !== undefined && showOn !== device;
};
