import type { BlockProps, BlockType } from "./blocks.js";

/** The version of the saved format that this code writes. */
export const DOCUMENT_VERSION = 4;

export const createId = () => {
  // getRandomValues, unlike randomUUID, also works on plain-HTTP host pages.
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

/**
 * The look every Block in an email uses unless it sets its own (ADR 0022). Each
 * field left out gives the built-in look.
 */
export interface EmailStyle {
  /** Behind the email's Rows. The page around them is the settings' `backgroundColor`. */
  emailBackgroundColor?: string;
  /** Text and Headings. */
  textColor?: string;
  /** Links in text. Without it, a link is in its Block's text color. */
  linkColor?: string;
  buttonBackgroundColor?: string;
  /** In pixels. */
  buttonBorderRadius?: number;
  /** Headings. The body font is the settings' `fontFamily`. */
  headingFontFamily?: string;
  heading1FontSize?: number;
  heading2FontSize?: number;
  heading3FontSize?: number;
  /** Text Blocks and Buttons. */
  textFontSize?: number;
}

export interface EmailSettings {
  width: number;
  /** The page, around the email. */
  backgroundColor: string;
  /** The body font. */
  fontFamily: string;
  preheader?: string;
  language?: string;
  style?: EmailStyle;
}

/** A Block of any type, whose props are its own type's. */
export type Block = {
  [Type in BlockType]: { id: string; type: Type; props: BlockProps[Type] };
}[BlockType];

export interface Column {
  id: string;
  /** Percentage. A Row's Column widths add up to 100. */
  width: number;
  props: Record<string, unknown>;
  blocks: Block[];
}

export interface Row {
  id: string;
  props: Record<string, unknown>;
  columns: Column[];
}

export interface BlocksDocument {
  kind: "blocks";
  version: number;
  settings: EmailSettings;
  rows: Row[];
}
