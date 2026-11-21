import type { BlocksDocument } from "@mailquilt/core";
import { html } from "lit";
import { keyed } from "lit/directives/keyed.js";

import { blockPositionLabel, locateRow, positionLabel } from "./positions.js";
import { UI_LANG } from "./theme.js";

/**
 * What a screen reader hears about changes it can't see, such as a move or a
 * deletion, from a status region the editor renders.
 */

interface AnnouncementsHost {
  /** The email as it is now, after the change being announced. */
  email: () => BlocksDocument | undefined;
  requestUpdate: () => void;
}

export type Announcements = ReturnType<typeof createAnnouncements>;

export const createAnnouncements = ({
  email: current,
  requestUpdate,
}: AnnouncementsHost) => {
  /** What the screen reader last heard. */
  let text = "";
  /** Each announcement gets a new element, so the same words are read again. */
  let id = 0;
  /** Whether `text` has been shown, and so heard. */
  let shown = true;
  /** The words said last, so the same words aren't said twice in a row. */
  let last = "";

  /**
   * What's said before the last words are shown is heard after them, as
   * several uploads can end at once. The same words aren't said twice, and
   * nothing at all says nothing.
   */
  const say = (words: string) => {
    if (shown || !words || !text) {
      text = words;
    } else if (words !== last) {
      text = `${text} ${words}`;
    }
    last = words;
    shown = false;
    id += 1;
    requestUpdate();
  };

  const blockMoved = (blockId: string, prefix = "Moved to") => {
    const email = current();
    const label = email && blockPositionLabel(email, blockId);
    if (label) {
      say(`${prefix} ${label}.`);
    }
  };

  const rowMoved = (rowId: string, prefix = "Row moved to") => {
    const email = current();
    const position = email && locateRow(email, rowId);
    if (position) {
      say(`${prefix} ${positionLabel(position.rowIndex, email.rows.length)}.`);
    }
  };

  return {
    blockMoved,

    /** Says nothing more, without reading the empty region out. */
    clear: () => {
      text = "";
    },

    render: () => {
      shown = true;
      return html`
        <div class="visually-hidden" lang=${UI_LANG} role="status">
          ${keyed(id, html`<span>${text}</span>`)}
        </div>
      `;
    },

    rowMoved,
    say,
  };
};
