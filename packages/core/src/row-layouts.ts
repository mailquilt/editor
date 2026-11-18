import type { Row } from "./document.js";

/** The layouts a Row can have, in the order a person chooses from them. */
export const ROW_LAYOUTS = [
  "100",
  "50/50",
  "33/67",
  "67/33",
  "33/33/33",
  "25/25/25/25",
] as const;

export type RowLayout = (typeof ROW_LAYOUTS)[number];

/** Percentages that add up to 100, so thirds can't all be the same width. */
export const LAYOUT_WIDTHS: Record<RowLayout, readonly number[]> = {
  "100": [100],
  "25/25/25/25": [25, 25, 25, 25],
  "33/33/33": [33.33, 33.33, 33.34],
  "33/67": [33, 67],
  "50/50": [50, 50],
  "67/33": [67, 33],
};

/**
 * The preset a Row uses. A saved email may have other widths, so none.
 * For Mail Quilt's own packages: not documented, and not yet a promise to hosts.
 */
export const rowLayoutOf = ({ columns }: Row) =>
  ROW_LAYOUTS.find((layout) => {
    const widths = LAYOUT_WIDTHS[layout];
    return (
      widths.length === columns.length &&
      widths.every((width, index) => width === columns[index]?.width)
    );
  });
