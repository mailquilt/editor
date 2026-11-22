import { html, svg } from "lit";
import type { SVGTemplateResult } from "lit";

/** A 16px line icon in the current text color, hidden from assistive technology. */
export const icon = (content: SVGTemplateResult) => html`
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
  bold: icon(
    svg`<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" stroke-width="2.25" />`
  ),
  /** Three bullets, each before a line. */
  bulletList: icon(
    svg`<path d="M10 6h10M10 12h10M10 18h10" /><g fill="currentColor" stroke="none"><circle cx="5" cy="6" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="5" cy="18" r="1.5" /></g>`
  ),
  /** A dropdown's arrow. */
  chevronDown: icon(svg`<path d="m7 10 5 5 5-5" />`),
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
  left: icon(svg`<path d="M19 12H5M11 6l-6 6 6 6" />`),
  lineBreak: icon(svg`<path d="M20 5v7a4 4 0 0 1-4 4H5M9 12l-4 4 4 4" />`),
  link: icon(
    svg`<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />`
  ),
  /** A pair of braces, as a Merge Tag is written. */
  mergeTag: icon(
    svg`<path d="M9 4H8a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1" />`
  ),
  monitor: icon(
    svg`<rect height="13" rx="2" width="18" x="3" y="4" /><path d="M8 21h8M12 17v4" />`
  ),
  /** A 1 and a 2, each before a line, and a third line. */
  orderedList: icon(
    svg`<path d="M11 6h9M11 12h9M11 18h9M4 4.5 5.5 3.5V9M4 9h3M4 13a1.5 1.5 0 0 1 3 .25c0 1.25-3 2-3 3.75h3" />`
  ),
  plus: icon(svg`<path d="M12 5v14M5 12h14" />`),
  preview: icon(
    svg`<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />`
  ),
  redo: icon(svg`<path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />`),
  right: icon(svg`<path d="M5 12h14M13 6l6 6-6 6" />`),
  rows: icon(
    svg`<rect height="6" rx="1.5" width="18" x="3" y="4" /><rect height="6" rx="1.5" width="18" x="3" y="14" />`
  ),
  /** A dashed frame with a pointer at its corner, for selecting what it frames. */
  select: icon(
    svg`<rect height="12" rx="2" stroke-dasharray="3 3" width="12" x="3" y="3" /><path d="m12 12 8.5 3.2-3.7 1.6-1.6 3.7z" fill="currentColor" />`
  ),
  settings: icon(
    svg`<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" /><circle cx="16" cy="6" r="2.5" /><circle cx="10" cy="12" r="2.5" /><circle cx="18" cy="18" r="2.5" />`
  ),
  underline: icon(svg`<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" />`),
  undo: icon(svg`<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />`),
  up: icon(svg`<path d="M12 19V5M6 11l6-6 6 6" />`),
};
