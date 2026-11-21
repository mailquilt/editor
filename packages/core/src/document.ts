import type { BlockProps, BlockType } from "./blocks.js";

/** The version of the saved format that this code writes. */
export const DOCUMENT_VERSION = 3;

export const createId = () => {
  // getRandomValues, unlike randomUUID, also works on plain-HTTP host pages.
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
};

export interface EmailSettings {
  width: number;
  backgroundColor: string;
  fontFamily: string;
  preheader?: string;
  language?: string;
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
