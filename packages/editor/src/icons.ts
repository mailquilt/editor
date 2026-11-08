import { html, svg } from "lit";
import type { SVGTemplateResult } from "lit";

/** A 16px line icon in the current text color, hidden from assistive technology. */
const icon = (content: SVGTemplateResult) => html`
  <svg
    aria-hidden="true"
    class="icon"
    fill="none"
    focusable="false"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="1.75"
    viewBox="0 0 24 24"
  >
    ${content}
  </svg>
`;

export const ICONS = {
  back: icon(svg`<path d="M19 12H5M11 6l-6 6 6 6" />`),
  bold: icon(
    svg`<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" stroke-width="2.25" />`
  ),
  content: icon(
    svg`<rect height="7" rx="1.5" width="7" x="3.5" y="3.5" /><rect height="7" rx="1.5" width="7" x="13.5" y="3.5" /><rect height="7" rx="1.5" width="7" x="3.5" y="13.5" /><rect height="7" rx="1.5" width="7" x="13.5" y="13.5" />`
  ),
  delete: icon(
    svg`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />`
  ),
  down: icon(svg`<path d="M12 5v14M6 13l6 6 6-6" />`),
  grip: icon(
    svg`<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></g>`
  ),
  italic: icon(svg`<path d="M10 5h8M6 19h8M14 5l-4 14" />`),
  layout: icon(
    svg`<rect height="16" rx="2" width="18" x="3" y="4" /><path d="M12 4v16" />`
  ),
  left: icon(svg`<path d="M19 12H5M11 6l-6 6 6 6" />`),
  lineBreak: icon(svg`<path d="M20 5v7a4 4 0 0 1-4 4H5M9 12l-4 4 4 4" />`),
  link: icon(
    svg`<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />`
  ),
  preview: icon(
    svg`<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />`
  ),
  redo: icon(svg`<path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />`),
  right: icon(svg`<path d="M5 12h14M13 6l6 6-6 6" />`),
  rows: icon(
    svg`<rect height="6" rx="1.5" width="18" x="3" y="4" /><rect height="6" rx="1.5" width="18" x="3" y="14" />`
  ),
  settings: icon(
    svg`<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" /><circle cx="16" cy="6" r="2.5" /><circle cx="10" cy="12" r="2.5" /><circle cx="18" cy="18" r="2.5" />`
  ),
  underline: icon(svg`<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" />`),
  undo: icon(svg`<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />`),
  up: icon(svg`<path d="M12 19V5M6 11l6-6 6 6" />`),
};

const BLOCK_ICONS: Record<string, ReturnType<typeof icon>> = {
  button: icon(
    svg`<rect height="8" rx="3" width="18" x="3" y="8" /><path d="M8 12h8" />`
  ),
  divider: icon(
    svg`<path d="M7 6h10M7 18h10" stroke-opacity="0.45" /><path d="M3 12h18" />`
  ),
  heading: icon(svg`<path d="M6 4v16M18 4v16M6 12h12" />`),
  image: icon(
    svg`<rect height="16" rx="2" width="18" x="3" y="4" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" />`
  ),
  spacer: icon(svg`<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" />`),
  text: icon(svg`<path d="M4 7V5h16v2M9 19h6M12 5v14" />`),
};

/** A type of Block's icon, or a plain square for a type this doesn't know. */
export const blockIcon = (type: string) =>
  BLOCK_ICONS[type] ??
  icon(svg`<rect height="16" rx="2" width="16" x="4" y="4" />`);
