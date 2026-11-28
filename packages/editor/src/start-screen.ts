import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

import { findPlaces, place } from "./editor-places.js";
import { ICONS } from "./icons.js";
import type { OfferedStarter } from "./starter-emails.js";
import { styleProperties } from "./style-properties.js";
import type { Text } from "./text.js";
import { modePanelId, modeTabId } from "./top-bar.js";

/**
 * A card: a button named by its name, with its description, which is hidden
 * from its name, as its description.
 */
const renderCard = (
  index: number,
  name: string,
  description: string | undefined,
  content: TemplateResult,
  onClick: (fromKeyboard: boolean) => void
) => html`
  <li>
    <button
      aria-describedby=${description ? `starter-text-${index}` : nothing}
      class="starter"
      type="button"
      @click=${({ detail }: MouseEvent) => onClick(detail === 0)}
    >
      ${content}
      <span class="starter-name">${name}</span>
      ${
        description
          ? html`<span
              aria-hidden="true"
              class="starter-text"
              id=${`starter-text-${index}`}
              >${description}</span
            >`
          : nothing
      }
    </button>
  </li>
`;

/**
 * The start screen, in Edit's place while the email has no Rows and the person
 * hasn't started it: "Blank", then each of the Host app's Starter emails, as a
 * card with a picture of it. Frames 7-start and p10-start.
 */
export const renderStartScreen = ({
  onBlank,
  onPick,
  picture,
  starters,
  text,
}: {
  /** From a button's click, which from a key has a `detail` of 0. */
  onBlank: (fromKeyboard: boolean) => void;
  onPick: (starter: OfferedStarter) => void;
  /** The email drawn at its own width, which the card scales to fit. */
  picture: (starter: OfferedStarter) => TemplateResult;
  starters: readonly OfferedStarter[];
  text: Text;
}) => html`
  <div
    aria-labelledby=${modeTabId("edit")}
    class="ui start-screen"
    data-testid="start-screen"
    id=${modePanelId("edit")}
    role="tabpanel"
  >
    <div class="start-inner">
      <h2 class="start-heading" id="start-heading">${text("start.title")}</h2>
      <p class="start-intro">${text("start.text")}</p>
      <ul aria-labelledby="start-heading" class="starters">
        ${renderCard(
          0,
          text("start.blank"),
          text("start.blankText"),
          html`<span class="starter-picture blank" aria-hidden="true">
            <span class="starter-plus">${ICONS.plus}</span>
          </span>`,
          onBlank
        )}
        ${starters.map((starter, index) =>
          renderCard(
            index + 1,
            starter.name,
            starter.description,
            html`<span
              class="starter-picture"
              data-email-width=${starter.email.settings.width}
              data-place=${place("emailPicture")}
              style=${styleProperties({
                "background-color": starter.email.settings.backgroundColor,
              })}
            >
              ${picture(starter)}
            </span>`,
            () => onPick(starter)
          )
        )}
      </ul>
    </div>
  </div>
`;

/** Scales a Starter email's picture to its card's width. */
const scale = (picture: HTMLElement) => {
  picture.style.setProperty(
    "--_mq-picture-scale",
    String(picture.clientWidth / Number(picture.dataset.emailWidth))
  );
};

/**
 * Scales each Starter email's picture to its card, whose width the screen's
 * grid decides, as it changes, and after each update, which can give a card
 * another email. A ResizeObserver reports before the page is painted, so a
 * picture is never drawn at a guessed size.
 */
export const createEmailPictures = (root: ShadowRoot) => {
  const observed = new Set<Element>();
  const sizes = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      scale(target as HTMLElement);
    }
  });
  return {
    destroy: () => sizes.disconnect(),

    /** After an update: the pictures it drew, and none it took away. */
    sync() {
      for (const picture of observed) {
        if (!picture.isConnected) {
          observed.delete(picture);
          sizes.unobserve(picture);
        }
      }
      for (const picture of findPlaces(root, "emailPicture")) {
        if (observed.has(picture)) {
          scale(picture);
        } else {
          observed.add(picture);
          sizes.observe(picture);
        }
      }
    },
  };
};

export const startScreenStyles = css`
  .start-screen {
    align-items: center;
    background-color: var(--mq-color-workspace);
    display: flex;
    flex: 1 0 auto;
    justify-content: center;
    padding: var(--mq-space-5);
  }

  .app[data-phone] .start-screen {
    align-items: flex-start;
    padding: var(--mq-space-5) var(--mq-space-4);
  }

  /* Capped and centred, as frame 7-start draws it at 1440. */
  .start-inner {
    width: min(980px, 100%);
  }

  .start-heading {
    color: var(--mq-color-text);
    font-size: var(--_mq-font-size-page-title);
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.3;
    margin: 0 0 var(--mq-space-1);
  }

  .start-intro {
    color: var(--mq-color-text-muted);
    font-size: var(--_mq-font-size-bar-title);
    line-height: 1.45;
    margin: 0 0 var(--mq-space-5);
  }

  .starters {
    display: grid;
    gap: var(--mq-space-4);
    /* Four across at most, as frame 7-start, and none narrower than 160px. */
    grid-template-columns: repeat(
      auto-fill,
      minmax(max(160px, (100% - 3 * var(--mq-space-4)) / 4), 1fr)
    );
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .app[data-phone] .starters {
    gap: var(--mq-space-3);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .starter {
    background-color: var(--mq-color-surface);
    border: 0;
    border-radius: var(--mq-radius);
    box-shadow: inset 0 0 0 1px var(--mq-color-border);
    color: var(--mq-color-text);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    height: 100%;
    padding: var(--mq-space-2);
    text-align: start;
    transition: box-shadow 120ms;
    width: 100%;
  }

  .starter:hover {
    box-shadow: inset 0 0 0 1px var(--mq-color-border-strong);
  }

  /* Pressed, as the picker's tiles are. */
  .starter:active {
    scale: 0.98;
  }

  .starter:focus-visible {
    box-shadow: inset 0 0 0 1px var(--mq-color-border);
    outline: 2px solid var(--mq-color-accent);
    outline-offset: 2px;
  }

  /* The top of the email, at the card's width. */
  .starter-picture {
    aspect-ratio: 3 / 4;
    border-radius: var(--mq-radius-small);
    display: block;
    overflow: hidden;
    position: relative;
  }

  .starter-picture .rows-picture {
    position: absolute;
    inset: 0 auto auto 0;
  }

  .starter-picture.blank {
    align-items: center;
    background-color: var(--mq-color-workspace);
    border: 1px dashed var(--mq-color-border-strong);
    display: flex;
    justify-content: center;
  }

  .starter-plus {
    align-items: center;
    background-color: var(--mq-color-surface);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow-small);
    display: flex;
    height: 44px;
    justify-content: center;
    width: 44px;
  }

  /* A long word, such as a German name, wraps rather than leaving the card. */
  .starter-name,
  .starter-text {
    overflow-wrap: anywhere;
  }

  .starter-name {
    font-weight: 500;
    padding: var(--mq-space-3) var(--mq-space-1) 0;
  }

  .starter-text {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
    padding: 2px var(--mq-space-1) var(--mq-space-1);
  }
`;
