// How big an email is, in the words a page uses for it.

import type { BlocksDocument } from "@mailquilt/core";

/** A size in bytes, as people say it. */
export const kilobytes = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/** How much of that an email's HTML is. */
export const htmlSize = (html: string) =>
  kilobytes(new TextEncoder().encode(html).byteLength);

const counted = (count: number, name: string) =>
  `${count} ${name}${count === 1 ? "" : "s"}`;

/** What an email is made of, such as "2 Rows, 5 Blocks". */
export const emailShape = ({ rows }: BlocksDocument) => {
  const blocks = rows.flatMap(({ columns }) =>
    columns.flatMap((column) => column.blocks)
  );
  return `${counted(rows.length, "Row")}, ${counted(blocks.length, "Block")}`;
};
