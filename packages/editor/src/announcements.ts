import type { BlocksDocument } from "@mailquilt/core";
import { html } from "lit";
import { keyed } from "lit/directives/keyed.js";

import { locateRow, placeLabel, positionLabel } from "./places.js";
import { UI_LANG } from "./theme.js";

/**
 * What a screen reader hears about changes it can't see, such as a move or a
 * deletion, from a status region the editor renders.
 */

interface AnnouncementsHost {
  /** The email as it is now, after the change being announced. */
  document: () => BlocksDocument | undefined;
  requestUpdate: () => void;
}

export type Announcements = ReturnType<typeof createAnnouncements>;

export const createAnnouncements = (host: AnnouncementsHost) => {
  /** What the screen reader last heard. */
  let text = "";
  /** Each announcement gets a new element, so the same words are read again. */
  let id = 0;

  const say = (words: string) => {
    text = words;
    id += 1;
    host.requestUpdate();
  };

  const blockMoved = (blockId: string, prefix = "Moved to") => {
    const document = host.document();
    const place = document && placeLabel(document, blockId);
    if (place) {
      say(`${prefix} ${place}.`);
    }
  };

  const rowMoved = (rowId: string, prefix = "Row moved to") => {
    const document = host.document();
    const place = document && locateRow(document, rowId);
    if (place) {
      say(`${prefix} ${positionLabel(place.rowIndex, document.rows.length)}.`);
    }
  };

  return {
    blockMoved,

    /** Says nothing more, without reading the empty region out. */
    clear: () => {
      text = "";
    },

    render: () => html`
      <div class="visually-hidden" lang=${UI_LANG} role="status">
        ${keyed(id, html`<span>${text}</span>`)}
      </div>
    `,

    rowMoved,
    say,
  };
};
