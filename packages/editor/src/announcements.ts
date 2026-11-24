import type { BlocksDocument } from "@mailquilt/core";
import { html } from "lit";
import { keyed } from "lit/directives/keyed.js";

import { blockPlace, locateRow, placeIn } from "./positions.js";
import type { StringId } from "./strings.js";
import type { Text } from "./text.js";

/**
 * What a screen reader hears about changes it can't see, such as a move or a
 * deletion, from a status region the editor renders.
 */

interface AnnouncementsHost {
  /** The email as it is now, after the change being announced. */
  email: () => BlocksDocument | undefined;
  requestUpdate: () => void;
  text: Text;
}

export type Announcements = ReturnType<typeof createAnnouncements>;

export const createAnnouncements = ({
  email: current,
  requestUpdate,
  text: textOf,
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

  /** `said` names where the Block is now, as `blockPlace` gives it. */
  const blockMoved = (blockId: string, said: StringId = "said.blockMoved") => {
    const email = current();
    const place = email && blockPlace(email, blockId);
    if (place) {
      say(textOf(said, place));
    }
  };

  /** `said` names where the Row is now, as `placeIn` gives it. */
  const rowMoved = (rowId: string, said: StringId = "said.rowMoved") => {
    const email = current();
    const position = email && locateRow(email, rowId);
    if (position) {
      say(textOf(said, placeIn(position.rowIndex, email.rows.length)));
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
        <div class="visually-hidden" lang=${textOf("language")} role="status">
          ${keyed(id, html`<span>${text}</span>`)}
        </div>
      `;
    },

    rowMoved,
    say,
  };
};
