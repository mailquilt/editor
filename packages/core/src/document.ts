export interface EmailSettings {
  width: number;
  backgroundColor: string;
  fontFamily: string;
  preheader?: string;
  language?: string;
}

export interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

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
