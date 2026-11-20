// What the landing page does in the browser: starts the real editor, and keeps
// the page around it in step with the email being edited.

import type { MailQuilt } from "@mailquilt/editor";

import { accentTokens, EDITOR_MIN_WIDTH } from "./editor-facts";
import { homeEmail } from "./home-email";
import { emailShape, htmlSize } from "./measure";
import { paintHtml, paintJson } from "./paint";

/** Narrower than this, the page shows the picture alone. */
const WIDE_ENOUGH = "(min-width: 44rem)";

const find = <Element extends HTMLElement>(selector: string) =>
  document.querySelector<Element>(selector);

const findAll = <Element extends HTMLElement>(selector: string) => [
  ...document.querySelectorAll<Element>(selector),
];

const wireCopy = () => {
  for (const button of findAll<HTMLButtonElement>("[data-copy]")) {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy ?? "");
        button.textContent = "Copied";
      } catch {
        // The browser refused, as it does on a page that isn't secure.
        button.textContent = "Couldn't copy";
      }
      setTimeout(() => {
        button.textContent = "Copy";
      }, 2000);
    });
  }
};

/** The four packages, as tabs laid out like the logo's grid. */
const wirePackages = () => {
  const tabs = findAll<HTMLButtonElement>("[data-home-packages] [role=tab]");
  const select = (tab: HTMLButtonElement) => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      other.tabIndex = selected ? 0 : -1;
      const panel = find(`#${other.getAttribute("aria-controls")}`);
      if (panel) {
        panel.hidden = !selected;
      }
    }
  };
  // The tabs are in reading order, two to a row. Past an edge, nothing moves.
  const steps: Record<string, number> = {
    ArrowDown: 2,
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -2,
  };
  // Until now every panel could be read. From here, only the chosen one.
  const chosen = tabs.find(
    (tab) => tab.getAttribute("aria-selected") === "true"
  );
  if (chosen) {
    select(chosen);
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      const step = steps[event.key];
      const next =
        {
          End: tabs.at(-1),
          Home: tabs[0],
        }[event.key] ?? (step === undefined ? undefined : tabs[index + step]);
      if (next && next !== tab) {
        event.preventDefault();
        select(next);
        next.focus();
      }
    });
  }
};

/** One Row whose Columns take the layout chosen beside it. */
const wireLayouts = () => {
  const buttons = findAll<HTMLButtonElement>(
    "[data-home-layouts] [data-layout]"
  );
  const columns = findAll("[data-home-layouts] .home-column");
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const widths = (button.dataset.layout ?? "").split("/");
      for (const [index, column] of columns.entries()) {
        const width = widths[index];
        column.style.flex = width ?? "0";
        const label = column.firstElementChild;
        if (label && width !== undefined) {
          label.textContent = width;
        }
      }
      for (const other of buttons) {
        other.setAttribute("aria-pressed", String(other === button));
      }
    });
  }
};

/** Starts the HTML where the email's own content is, past MJML's preamble. */
const showFirstMergeTag = (output: HTMLElement) => {
  const tag = output.querySelector<HTMLElement>(".t");
  if (tag) {
    output.scrollTop = Math.max(0, tag.offsetTop - output.offsetTop - 120);
  }
};

const wireThemes = (editor: MailQuilt) => {
  const token = find("[data-home-token]");
  const buttons = findAll<HTMLButtonElement>("[data-home-themes] button");
  const apply = (button: HTMLButtonElement) => {
    const { accent = "", strong = "" } = button.dataset;
    for (const [name, value] of Object.entries(accentTokens(accent, strong))) {
      editor.style.setProperty(name, value);
    }
    for (const other of buttons) {
      other.setAttribute("aria-pressed", String(other === button));
    }
    if (token) {
      token.textContent = `--mq-color-accent: ${accent}`;
    }
  };
  for (const button of buttons) {
    button.addEventListener("click", () => apply(button));
  }
  const [first] = buttons;
  if (first) {
    apply(first);
  }
};

const startEditor = async (stage: HTMLElement) => {
  await import("@mailquilt/editor");
  const editor = document.createElement("mail-quilt") as MailQuilt;
  const json = find("[data-home-json]");
  const jsonMeta = find("[data-home-json-meta]");
  const html = find("[data-home-html]");
  const htmlMeta = find("[data-home-html-meta]");
  const htmlNote = find("[data-home-html-note]");
  const exportAgain = find<HTMLButtonElement>("[data-home-export]");

  // Typing changes the email on each key, so the JSON is painted once a frame.
  let painting = 0;
  editor.addEventListener("mq-change", ({ detail }) => {
    if (json && jsonMeta) {
      cancelAnimationFrame(painting);
      painting = requestAnimationFrame(() => {
        json.innerHTML = paintJson(detail.document);
        jsonMeta.textContent = emailShape(detail.document);
      });
    }
    // Said once, as the note is announced each time its words change.
    const changed = "You've changed the email since this export.";
    if (htmlNote && exportAgain && htmlNote.textContent !== changed) {
      htmlNote.textContent = changed;
      exportAgain.hidden = false;
    }
  });
  exportAgain?.addEventListener("click", async () => {
    if (!(html && htmlMeta && htmlNote)) {
      return;
    }
    // Emptied while it works, so the same result said again is still heard.
    htmlNote.textContent = "";
    try {
      const exported = await editor.exportHtml();
      html.innerHTML = paintHtml(exported);
      htmlMeta.textContent = htmlSize(exported);
      showFirstMergeTag(html);
      // The button stays, so focus isn't lost from under the person who pressed it.
      htmlNote.textContent = "This is the email as it is now.";
    } catch {
      htmlNote.textContent = "The export didn't work. Try it again.";
    }
  });
  wireThemes(editor);
  editor.value = homeEmail;
  stage.replaceChildren(editor);
  // From here the page can say the editor is real, and offer to recolor it.
  stage.dataset.live = "true";
};

const start = () => {
  const stage = find("[data-home-editor]");
  if (!stage || stage.dataset.started) {
    return;
  }
  stage.dataset.started = "true";
  wireCopy();
  wirePackages();
  wireLayouts();
  const html = find("[data-home-html]");
  if (html) {
    showFirstMergeTag(html);
  }
  // A scrollbar can take the stage under the editor's width at the breakpoint.
  if (
    matchMedia(WIDE_ENOUGH).matches &&
    stage.clientWidth >= EDITOR_MIN_WIDTH
  ) {
    // oxlint-disable-next-line promise/prefer-await-to-then -- Nothing here waits on the editor.
    startEditor(stage).catch(() => {
      // The picture of the editor stays where it is.
    });
  }
};

// Blume moves between pages without reloading, so this runs on each arrival.
document.addEventListener("astro:page-load", start);
