// Checked by the type check only: a Phone font size and an Image's Phone
// width are in the types hosts read, not only accepted when an email loads.
import type { BlockProps } from "../src/internal.js";

export const textOnPhone = {
  fontSize: 14,
} satisfies NonNullable<BlockProps["text"]["phone"]>;

export const imageOnPhone = {
  width: 120,
} satisfies NonNullable<BlockProps["image"]["phone"]>;
