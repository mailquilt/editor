import { AxeBuilder } from "@axe-core/playwright";
import type { Block, BlockType } from "@mailquilt/core";
import type { BlockProps } from "@mailquilt/core/internal";
import { expect, test as base } from "@playwright/test";
import type { BrowserContext, Locator, Page, Route } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";
import { emailWith, emailWithInline } from "./host/email.js";

/**
 * Playwright's `test`, where an error any page of the test doesn't catch fails
 * the test, once it has run.
 */
export const test = base.extend<{ uncaughtErrors: undefined }>({
  uncaughtErrors: [
    async ({ context }, use) => {
      const errors: string[] = [];
      context.on("weberror", (error) => errors.push(error.error().message));
      await use(undefined);
      expect(errors, "errors a page didn't catch").toStrictEqual([]);
    },
    { auto: true },
  ],
});

export const canvas = (page: Page) => page.locator("mail-quilt");

export const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

/** The test host's unfriendly CSS pushes the canvas far down the page. */
export const TALL_VIEWPORT = { height: 1600, width: 1280 };

/** A phone's, below 640px, where the editor is laid out for a phone. */
export const PHONE_VIEWPORT = { height: 800, width: 375 };

/** On a phone, the sheet open in front, which is a modal dialog. */
export const sheet = (page: Page, name: string | RegExp) =>
  canvas(page).getByRole("dialog", { name });

/** On a phone, the top bar's button that opens its menu. */
export const topMenuButton = (page: Page) =>
  canvas(page).getByRole("button", { exact: true, name: "More" });

/** The test host's page, with its first email showing. */
export const openTestPage = async (page: Page) => {
  await page.goto("/");
  await expect(textBlock(page)).toHaveText("Hello");
};

/**
 * Has the pages of the test say they're on this platform, as Windows and Linux
 * or as a Mac, from before the editor loads and reads it.
 */
export const pretendPlatform = (page: Page, platform: "MacIntel" | "Win32") =>
  page.addInitScript((name) => {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => name });
  }, platform);

export const linkUrlField = (page: Page) =>
  page.getByRole("textbox", { name: "Link URL" });

/** The floating toolbar's button, which opens Check. */
export const checkButton = (page: Page) =>
  canvas(page).getByRole("button", { exact: true, name: "Check the email" });

/** The Check Mode's tab, which after a check is named with its count too. */
export const checkTab = (page: Page) =>
  canvas(page).getByRole("tab", { name: /^Check\b/u });

/** Check's panel of Problems. */
export const checkPanel = (page: Page) =>
  canvas(page).getByRole("region", { name: "Before you export" });

/** Chooses the Check Mode, and waits for its panel. */
export const openCheck = async (page: Page) => {
  await checkTab(page).click();
  await expect(checkPanel(page)).toBeVisible();
};

/** The frame of Check's desktop inbox, where the email is. */
export const inboxFrame = (page: Page) =>
  canvas(page).getByTitle("The email on a desktop");

/** The email in Check's desktop inbox. */
export const inboxEmail = (page: Page) =>
  inboxFrame(page).contentFrame().locator("body");

export const undoButton = (page: Page) =>
  canvas(page).getByRole("button", { exact: true, name: "Undo" });

export const redoButton = (page: Page) =>
  canvas(page).getByRole("button", { exact: true, name: "Redo" });

export const tooltip = (page: Page) => canvas(page).getByRole("tooltip");

/** What a drag leaves while it lasts: the copy that moves, and its empty space. */
export const dragMarks = (page: Page) =>
  canvas(page).locator("[data-drag-ghost], [data-drag-source]");

type Document = NonNullable<MailQuilt["value"]>;

export { emailWith } from "./host/email.js";

/** An email with one Text Block, whose text is a link to `href`. */
export const emailWithLink = (text: string, href: string) =>
  emailWithInline({
    marks: [{ attrs: { href }, type: "link" }],
    text,
    type: "text",
  });

export const currentValue = (page: Page) =>
  canvas(page).evaluate((element) => (element as MailQuilt).value as Document);

/** Each Row's Columns, as the text of each Column's Blocks. */
export const structure = async (page: Page) => {
  const { rows } = await currentValue(page);
  return rows.map((row) =>
    row.columns.map((column) =>
      column.blocks.map(({ props }) => {
        const { content } = props as {
          content: { content: { content?: { text: string }[] }[] };
        };
        return content.content
          .flatMap((paragraph) => paragraph.content ?? [])
          .map(({ text }) => text)
          .join("");
      })
    )
  );
};

export const exportHtml = (page: Page) =>
  canvas(page).evaluate((element) => (element as MailQuilt).exportHtml());

export const setValue = (page: Page, email: unknown) =>
  canvas(page).evaluate((element, value) => {
    (element as MailQuilt).value = value as MailQuilt["value"];
  }, email);

/** On macOS, Home and End scroll the page and leave the cursor where it is. */
export const moveCursorToLineStart = (page: Page) =>
  page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );

export const moveCursorToLineEnd = (page: Page) =>
  page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowRight" : "End"
  );

/**
 * Lets the page catch up with a key or a pointer move: a frame for a drag to
 * act on the pointer, one more for what that changed, then a task, as Chromium
 * reports a moved text selection just after the key press. A person's next
 * action is always later than this.
 */
export const settle = (page: Page) =>
  page.evaluate(
    () =>
      // oxlint-disable-next-line promise/avoid-new -- These browser callbacks have no promise form.
      new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 0))
        );
      })
  );

/** Types at the start of the Text Block, so a lost cursor scrambles the text. */
export const focusStartOfTextBlock = async (page: Page) => {
  await textBlock(page).click();
  await expect(textBlock(page)).toBeFocused();
  await moveCursorToLineStart(page);
  // ProseMirror learns of the moved cursor a moment later. A key it handles
  // itself, such as Enter, would act on the old position before then.
  await settle(page);
};

/** The Add panel, while it's open. */
export const addPanel = (page: Page) => canvas(page).getByTestId("add-panel");

/** The Add panel's tile for a type of Block. */
export const palette = (page: Page, name: string) =>
  addPanel(page).getByRole("button", {
    exact: true,
    name: `Add ${name} Block`,
  });

/** The Add panel's tile for a layout. */
export const layoutTile = (page: Page, layout: string) =>
  addPanel(page).getByRole("button", {
    exact: true,
    name: `Add ${layout} Row`,
  });

/**
 * Opens the Add panel, as `/` does from the Selection bar's More button, or
 * with nothing selected, its Add button, so what's selected stays selected.
 */
export const openAddPanel = async (page: Page) => {
  if (await addPanel(page).isVisible()) {
    return;
  }
  const bar = canvas(page).getByTestId("selection-bar");
  await bar
    .getByRole("button", { exact: true, name: "More settings and actions" })
    .or(bar.locator('[data-action="add"]'))
    .focus();
  await page.keyboard.press("/");
  await expect(addPanel(page)).toBeVisible();
};

/** The Add panel's tile for a type of Block, with the panel open. */
const showPalette = async (page: Page, name: string) => {
  await openAddPanel(page);
  return palette(page, name);
};

/** Adds a Block of this type from the Add panel, with a click. */
export const addBlock = async (page: Page, name: string) => {
  await openAddPanel(page);
  await palette(page, name).click();
};

/** Adds a Row with this layout from the Add panel. */
export const addRow = async (page: Page, layout = "100") => {
  await openAddPanel(page);
  await layoutTile(page, layout).click();
};

/** The Selection bar above the Canvas, whatever it's showing. */
export const selectionBar = (page: Page) =>
  canvas(page).getByTestId("selection-bar");

/** A button in the Selection bar, by its name. */
export const barButton = (page: Page, name: string) =>
  selectionBar(page).getByRole("button", { exact: true, name });

/**
 * Selects nothing, with a click on the workspace beside the email, away
 * from the floating toolbar, so the Selection bar shows the email's settings.
 */
export const selectNothing = async (page: Page) => {
  const area = await boxOf(canvas(page).getByTestId("workspace"));
  const bar = await boxOf(selectionBar(page));
  // Just below the bar, at the workspace's end, beside the email.
  await page.mouse.click(area.x + area.width - 10, bar.y + bar.height + 10);
  await expect(selectionBar(page)).toHaveAccessibleName("Email settings");
};

/** The Selection bar while a Row is selected, which has that Row's tools. */
export const rowTools = (page: Page, position: number) =>
  canvas(page).getByRole("toolbar", {
    exact: true,
    name: `Row ${position} settings`,
  });

/** More, opened from the Selection bar. */
export const morePanel = (page: Page) => canvas(page).getByTestId("more-panel");

export const moreButton = (page: Page) =>
  barButton(page, "More settings and actions");

/** Opens More from the Selection bar, if it isn't open. */
export const openMore = async (page: Page) => {
  if ((await moreButton(page).getAttribute("aria-expanded")) !== "true") {
    await moreButton(page).click();
  }
  return morePanel(page);
};

/** One of More's actions, such as Copy, opening More first. */
export const moreAction = async (page: Page, name: string) => {
  const more = await openMore(page);
  return more.getByRole("button", { exact: true, name });
};

/**
 * Opens the popover a Selection bar button opens, such as Padding, if it
 * isn't open. Its name can be the start of the button's, as a color's
 * button is named with its value.
 */
export const openPopover = async (page: Page, name: string | RegExp) => {
  const button = selectionBar(page).getByRole("button", { name });
  if ((await button.getAttribute("aria-expanded")) !== "true") {
    await button.click();
  }
  return canvas(page).getByRole("dialog");
};

/** What the editor last said to screen readers. */
export const announcement = (page: Page) => canvas(page).getByRole("status");

/** The test host's count of `mq-change` events. */
export const changeCount = (page: Page) => page.getByTestId("change-count");

/**
 * Checks how many `mq-change` events the test host has had since this was
 * called, as the count it shows. For none, the page settles first, as the count
 * already shows none, and an event that comes a moment later would be missed.
 */
export const changesSince = async (page: Page) => {
  const before = Number(await changeCount(page).textContent());
  return async (count: number) => {
    if (count === 0) {
      await settle(page);
    }
    await expect(changeCount(page)).toHaveText(String(before + count));
  };
};

/** The document the test host last received in an `mq-change`. */
export const latestDocument = async (page: Page) =>
  JSON.parse(
    (await page.getByTestId("latest-document").textContent()) ?? ""
  ) as Document;

let hostListeners = 0;

/**
 * Reads the events of `type` that reach the host page's window from here on,
 * each as the fields named, as they were when it got there. With `capture`,
 * each is heard on its way in, before the editor.
 */
export const hostEvents = async (
  page: Page,
  type: string,
  fields: readonly string[],
  { capture = false } = {}
) => {
  hostListeners += 1;
  const store = `hostEvents${hostListeners}`;
  await page.evaluate(
    (listener) => {
      const heard: Record<string, unknown>[] = [];
      Reflect.set(window, listener.store, heard);
      window.addEventListener(
        listener.type,
        (event) => {
          heard.push(
            Object.fromEntries(
              listener.fields.map((name) => [name, Reflect.get(event, name)])
            )
          );
        },
        { capture: listener.capture }
      );
    },
    { capture, fields, store, type }
  );
  return () =>
    page.evaluate(
      (name) => Reflect.get(window, name) as Record<string, unknown>[],
      store
    );
};

/** Counts the Escape presses that reach the host page, from here on. */
export const countHostEscapes = async (page: Page) => {
  const presses = await hostEvents(page, "keydown", ["key"]);
  return async () => {
    const heard = await presses();
    return heard.filter(({ key }) => key === "Escape").length;
  };
};

/**
 * Whether the editor kept the browser from acting on the last press of this
 * key, from here on, as the host page sees it. Undefined until one reaches it.
 */
export const watchPrevented = async (page: Page, key: string) => {
  const presses = await hostEvents(page, "keydown", [
    "defaultPrevented",
    "key",
  ]);
  return async () => {
    const heard = await presses();
    return heard.findLast((press) => press.key === key)?.defaultPrevented;
  };
};

/**
 * The errors the page logs, from here on. One it doesn't catch fails any test
 * already.
 */
export const consoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
};

/** Sets the editor's width on the test page, with no padding around it. */
export const editorOf = async (page: Page, width: number) => {
  await page.addStyleTag({
    content: `main { padding: 0 !important } mail-quilt { width: ${width}px !important }`,
  });
};

/** Opens the test page with an email of these Rows of Text Blocks. */
export const openEmail = async (page: Page, rows: string[][][]) => {
  await page.goto("/");
  await setValue(page, emailWith(rows));
  await expect(textBlock(page).first()).toBeVisible();
  // An email the editor refused would leave the test working on something else.
  expect(await structure(page)).toEqual(rows);
};

/** A Row's frame. A drag's copy of it is left out. */
export const rowFrame = (page: Page, position: number) =>
  canvas(page)
    .locator('[data-testid="row-frame"]:not([data-drag-ghost])')
    .nth(position - 1);

export const rowTag = (page: Page, position: number) =>
  rowFrame(page, position).getByTestId("row-tag");

/** A Row's tag shows on hover, so the pointer goes there first. */
export const hoverRow = (page: Page, position: number) =>
  rowFrame(page, position)
    .getByTestId("row")
    .hover({ position: { x: 4, y: 4 } });

/**
 * Selects a Row with the mouse, from its tag, so the Selection bar shows its
 * tools.
 */
export const selectRow = async (page: Page, position: number) => {
  // The Rows list takes its shape a frame after the editor's width changes,
  // which can move the Row from under the pointer.
  await settle(page);
  // More, where it floats over the Canvas, can cover the Row's tag.
  const close = canvas(page)
    .getByTestId("more-panel")
    .getByRole("button", { exact: true, name: "Close" });
  if (await close.isVisible()) {
    await close.click();
  }
  // In an editor wider than the window, the tag at the Row's end can be out
  // of sight, and scrolling to it on the click would leave the Row's hover.
  await rowTag(page, position).scrollIntoViewIfNeeded();
  await hoverRow(page, position);
  await rowTag(page, position).click();
  await expect(rowTools(page, position)).toBeVisible();
};

/** A layout in the Selection bar, with a Row selected. */
export const layoutOption = (page: Page, layout: string) =>
  selectionBar(page)
    .getByRole("group", { name: "Columns" })
    .getByRole("button", { exact: true, name: `${layout} layout` });

/** Chooses a Row's layout in the Selection bar, with the mouse. */
export const chooseLayout = async (
  page: Page,
  position: number,
  layout: string
) => {
  await selectRow(page, position);
  await layoutOption(page, layout).click();
};

/** Deletes a Row from the Selection bar, with the mouse. */
export const deleteRow = async (page: Page, position: number) => {
  await selectRow(page, position);
  await rowTools(page, position)
    .getByRole("button", { name: "Delete Row" })
    .click();
};

/** The Selection bar, which has the selected Block's tools. */
export const blockTools = selectionBar;

/** The format bar, which shows while a Block's text is being edited. */
export const formatBar = (page: Page) =>
  canvas(page).getByRole("toolbar", { name: "Text formatting" });

export const formatButton = (page: Page, name: string) =>
  formatBar(page).getByRole("button", { exact: true, name });

export const addText = async (page: Page) => {
  const text = await showPalette(page, "Text");
  await text.click();
};

/**
 * What a copy of the selection in some text would give. Tests copy and paste
 * through events, as tests running at the same time could share the system's
 * clipboard.
 */
export const copySelection = (target: Locator) =>
  target.evaluate((element) => {
    const clipboardData = new DataTransfer();
    // Not a ClipboardEvent, whose constructor ignores this data in Firefox.
    const event = new Event("copy", {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    element.dispatchEvent(event);
    return {
      html: clipboardData.getData("text/html"),
      text: clipboardData.getData("text/plain"),
    };
  });

/** Pastes into some text, as a paste of `type` from another app would. */
const paste = (target: Locator, type: string, data: string) =>
  target.evaluate(
    (element, { format, value }) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData(format, value);
      // Not a ClipboardEvent, whose constructor ignores this data in Firefox.
      const event = new Event("paste", {
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      Object.defineProperty(event, "clipboardData", { value: clipboardData });
      element.dispatchEvent(event);
    },
    { format: type, value: data }
  );

/** Pastes HTML into some text, as a paste from another app would. */
export const pasteHtml = (target: Locator, html: string) =>
  paste(target, "text/html", html);

/** Pastes plain text into some text, as a paste from a text editor would. */
export const pasteText = (target: Locator, text: string) =>
  paste(target, "text/plain", text);

export const blockTool = barButton;

export const deleteBlock = (page: Page) => blockTool(page, "Delete Block");

export const blockGroup = (page: Page, name: string) =>
  canvas(page).getByRole("group", { name: `${name} Block` });

/**
 * A Text Block itself, as opposed to the text inside it, found by its exact
 * text. A drag's copy of it is hidden from screen readers, so it's left out.
 */
export const blockWith = (page: Page, text: string) =>
  blockGroup(page, "Text").filter({
    has: textBlock(page).getByText(text, { exact: true }),
  });

/** The drag handle of the Text Block with this exact text. */
export const handleOf = (page: Page, text: string) =>
  blockWith(page, text).getByTestId("drag-handle");

/** Where a drag would drop what it carries. */
export const dropIndicator = (page: Page) =>
  canvas(page).getByTestId("drop-indicator");

/** The text of the Text Block with this exact text. */
export const textOf = (page: Page, text: string) =>
  blockWith(page, text).getByRole("textbox", { name: "Text Block" });

/** The picture in an Image Block. */
export const imageOf = (page: Page) => blockGroup(page, "Image").locator("img");

/** The selected Block, if there is one. */
export const selectedBlock = (page: Page) =>
  canvas(page).locator('[role="group"][aria-current="true"]');

/** The text of the selected Block. */
export const selectedText = (page: Page) =>
  selectedBlock(page).getByRole("textbox");

/**
 * A setting's field, where it shows: in the Selection bar, or in a popover
 * from it or More once that's open.
 */
export const field = (page: Page, name: string) =>
  canvas(page)
    .getByLabel(name, { exact: true })
    .and(canvas(page).locator("input, select"));

/**
 * The Selection bar's button that opens a field in a popover, by the field's
 * label: a color's is named with its value, after its label.
 */
const POPOVER_OPENERS: readonly [RegExp, RegExp][] = [
  // A Button's colors, which its bar calls Fill and Text.
  [/^Background color$/u, /^Fill:/u],
  [/^Text color$/u, /^Text:/u],
  [/^(?:Top|Right|Bottom|Left) padding \(px\)$/u, /^Padding$/u],
  [/^Stack Columns on phones$/u, /^Stack on phones$/u],
  [/^(?!Image URL$).+ URL$|^Choose a network$/u, /^Links/u],
  [/^Width \(px\)$/u, /^Width/u],
];

/**
 * A setting's field, opening what shows it if it isn't showing: its popover
 * from the Selection bar, or else More. A side of a Row's padding shows once
 * "Same on every side" is off.
 */
export const setting = async (page: Page, name: string) => {
  const control = field(page, name);
  if (await control.isVisible()) {
    return control;
  }
  const opener =
    POPOVER_OPENERS.find(([label]) => label.test(name))?.[1] ??
    new RegExp(
      `^${name.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&")}(?::|$)`,
      "u"
    );
  const button = selectionBar(page).getByRole("button", { name: opener });
  await ((await button.count()) === 1
    ? openPopover(page, opener)
    : openMore(page));
  const sameOnEverySide = canvas(page).getByRole("switch", {
    name: "Same on every side",
  });
  if (name.endsWith(" padding (px)") && (await sameOnEverySide.isChecked())) {
    await sameOnEverySide.click();
  }
  await expect(control).toBeVisible();
  return control;
};

/**
 * Chooses one of a setting's few values in the Selection bar, such as an
 * alignment, each a button in a group named for the setting.
 */
export const choose = (page: Page, name: string, option: string) =>
  selectionBar(page)
    .getByRole("group", { exact: true, name })
    .getByRole("button", { exact: true, name: option })
    .click();

/** Which of a setting's few values in the Selection bar is chosen. */
export const chosen = (page: Page, name: string) =>
  selectionBar(page)
    .getByRole("group", { exact: true, name })
    .locator('[aria-pressed="true"]');

export const change = async (control: Locator, text: string) => {
  await control.fill(text);
  await control.press("Enter");
};

export const undo = (page: Page) => undoButton(page).click();
export const redo = (page: Page) => redoButton(page).click();

export const undoByKey = (page: Page) => page.keyboard.press("ControlOrMeta+z");
export const redoByKey = (page: Page) =>
  page.keyboard.press("ControlOrMeta+Shift+z");

/** A copy of the first Block, after it in its Column. */
export const addSecondTextBlock = (page: Page) =>
  canvas(page).evaluate((element) => {
    const mailQuilt = element as MailQuilt;
    const email = mailQuilt.value;
    const column = email?.rows[0]?.columns[0];
    const block = column?.blocks[0];
    if (block) {
      column?.blocks.push({ ...structuredClone(block), id: "block-2" });
    }
    mailQuilt.value = email;
  });

export const blocks = async (page: Page, rowIndex = 0, columnIndex = 0) => {
  const { rows } = await currentValue(page);
  return rows[rowIndex]?.columns[columnIndex]?.blocks ?? [];
};

/** The props of a Block in that Column, counted from its end when `index` is negative. */
export const blockProps = async (page: Page, index = 0) => {
  const found = await blocks(page);
  return found.at(index)?.props;
};

export const blockTypes = async (page: Page, rowIndex = 0, columnIndex = 0) => {
  const found = await blocks(page, rowIndex, columnIndex);
  return found.map(({ type }) => type);
};

/** An email whose only Row's Columns hold these Blocks, by type. */
export const openBlocks = async (page: Page, ...columns: BlockType[][]) => {
  const email = emailWith([[[]]]);
  const [row] = email.rows;
  if (row) {
    const props: { [Type in BlockType]: BlockProps[Type] } = {
      button: { label: "Buy" },
      divider: {},
      heading: {
        content: {
          content: [
            { content: [{ text: "Sale", type: "text" }], type: "paragraph" },
          ],
          type: "doc",
        },
        level: 2,
      },
      image: { src: "https://cdn.example/photo.png" },
      menu: { links: [{ label: "Shop", url: "https://shop.example" }] },
      social: { links: [] },
      spacer: {},
      text: {
        content: {
          content: [
            { content: [{ text: "Words", type: "text" }], type: "paragraph" },
          ],
          type: "doc",
        },
      },
      video: {
        alt: "A cup",
        thumbnail: "https://cdn.example/photo.png",
        url: "https://video.example/watch",
      },
    };
    row.columns = columns.map((types, columnIndex) => ({
      blocks: types.map(
        (type, blockIndex) =>
          // Safe, as each type's props are found by that type.
          ({
            id: `${type}-${columnIndex}-${blockIndex}`,
            props: props[type],
            type,
          }) as Block
      ),
      id: `column-${columnIndex}`,
      props: {},
      width: 100 / columns.length,
    }));
  }
  await page.goto("/");
  await setValue(page, email);
  await expect(
    canvas(page)
      .getByRole("group", { name: / Block, Row /u })
      .first()
  ).toBeVisible();
  // An image that's still loading would go on to move what's below it.
  for (const image of await canvas(page).locator("img").all()) {
    await expect(image).toHaveJSProperty("complete", true);
  }
};

/**
 * A page for an opened export to fill: wider than the email, so it shows whole
 * and centered, and the same size each time, so a test knows where.
 */
export const EXPORT_VIEWPORT = { height: 800, width: 800 };

/** The exported HTML, and a new page showing it, at this size if one is given. */
export const openExport = async (
  page: Page,
  viewport?: { height: number; width: number }
) => {
  const html = await exportHtml(page);
  const opened = await page.context().newPage();
  if (viewport) {
    await opened.setViewportSize(viewport);
  }
  await opened.setContent(html);
  return { html, opened };
};

/**
 * Keys typed within a second of each other are one undo step, and a slow run
 * could take longer than that. This stops the page's clock, so it can't. Timers
 * and frames wait too from then on, so it comes after anything that settles.
 */
export const stopClock = async (page: Page) => {
  await page.clock.install();
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
};

export interface Point {
  x: number;
  y: number;
}

/** A file to drop, by its name and type. */
interface DroppedFile {
  name: string;
  type: string;
}

const PHOTO_FILE = { name: "photo.png", type: "image/png" };

interface FileDrag {
  drop: boolean;
  files: readonly DroppedFile[];
  point?: Point;
}

/**
 * What the browser does with files dragged over the element, at `point` or its
 * center, and, with `drop`, dropped there. As the browser does, the drop comes
 * only if the last `dragover` was prevented and didn't refuse it. The browser
 * "opens" a file the page doesn't take, in place of the page. It runs in the
 * page, so it has nothing from outside.
 */
const fireFileDrag = (element: Element, { drop, files, point }: FileDrag) => {
  const box = element.getBoundingClientRect();
  const { x: clientX, y: clientY } = point ?? {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
  const dataTransfer = new DataTransfer();
  for (const { name, type } of files) {
    dataTransfer.items.add(new File(["x"], name, { type }));
  }
  const fire = (type: string) =>
    element.dispatchEvent(
      new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        composed: true,
        dataTransfer,
      })
    );
  // What the browser offers for a file from outside. Chromium ignores what the
  // page sets on a DataTransfer that isn't the browser's own, so it's kept here.
  let effect = "copy";
  Object.defineProperty(dataTransfer, "dropEffect", {
    get: () => effect,
    set: (value: string) => {
      effect = value;
    },
  });
  fire("dragenter");
  if (fire("dragover")) {
    return "opens";
  }
  if (effect === "none") {
    return "refused";
  }
  if (!drop) {
    return "allowed";
  }
  return fire("drop") ? "opens" : "taken";
};

/** Drags a file over the element, at `point` or its center, and drops it there. */
export const dropFileOn = (target: Locator, point?: Point) =>
  target.evaluate(fireFileDrag, { drop: true, files: [PHOTO_FILE], point });

/**
 * Drags files over a point in the window, onto whatever's there, even inside
 * the editor's shadow root, and drops them there unless `drop` is false.
 */
export const dropFilesAt = async (
  page: Page,
  point: Point,
  files: readonly DroppedFile[] = [PHOTO_FILE],
  { drop = true } = {}
) => {
  const target = await page.evaluateHandle(({ x, y }) => {
    let element = document.elementFromPoint(x, y);
    while (element?.shadowRoot) {
      const inner = element.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === element) {
        break;
      }
      element = inner;
    }
    if (!element) {
      throw new Error("Nothing is at that point");
    }
    return element;
  }, point);
  return target.evaluate(fireFileDrag, { drop, files, point });
};

export const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("The element has no box");
  }
  return box;
};

export const centerOf = async (locator: Locator): Promise<Point> => {
  const { height, width, x, y } = await boxOf(locator);
  return { x: x + width / 2, y: y + height / 2 };
};

/** The upper part of an element, so a drop there lands before it. */
export const topOf = async (locator: Locator): Promise<Point> => {
  const { height, width, x, y } = await boxOf(locator);
  return { x: x + width / 2, y: y + height / 4 };
};

/** The lower part of an element, so a drop there lands after it. */
export const bottomOf = async (locator: Locator): Promise<Point> => {
  const { height, width, x, y } = await boxOf(locator);
  return { x: x + width / 2, y: y + (height * 3) / 4 };
};

/** Presses on an element, and moves just far enough to start a drag. */
export const pickUp = async (page: Page, from: Locator) => {
  const start = await centerOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 8, start.y + 8, { steps: 2 });
  await settle(page);
};

export const moveTo = async (page: Page, { x, y }: Point) => {
  await page.mouse.move(x, y, { steps: 8 });
  await settle(page);
};

export const letGo = async (page: Page) => {
  await page.mouse.up();
  await settle(page);
};

export const drag = async (page: Page, from: Locator, to: Point) => {
  await pickUp(page, from);
  await moveTo(page, to);
  await letGo(page);
};

/** A 1×1 PNG, which any box scales it to: its height shows its width was kept. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64"
);

/** Stops MJML loading until the returned function is called. */
export const holdMjml = async (page: Page) => {
  const held: Route[] = [];
  let released = false;
  await page.route("**/*mjml-browser*", async (route) => {
    // The request can arrive after the page shows its loading message.
    if (released) {
      await route.continue();
    } else {
      held.push(route);
    }
  });
  return async () => {
    released = true;
    await Promise.all(held.map((route) => route.continue()));
  };
};

/**
 * Serves every image from https://cdn.example, to the whole context, so that an
 * export opened in a new page has its images too.
 */
export const serveImages = (context: BrowserContext) =>
  context.route("https://cdn.example/**", (route) =>
    route.fulfill({ body: PIXEL, contentType: "image/png" })
  );

/**
 * Legacy mode, because the default mode opens a new page to finish, which
 * hangs in Chromium and WebKit while Check's sandboxed iframes are showing.
 * The iframe itself, the email, can be left out too, and so can rules.
 */
export const violations = async (
  page: Page,
  element = "mail-quilt",
  {
    excludeIframe = false,
    skipRules = [],
  }: { excludeIframe?: boolean; skipRules?: string[] } = {}
): Promise<{ id: string; targets: unknown[] }[]> => {
  // What's opening, such as a popover that grows into place, is read once
  // it's there, rather than at a size it has only on the way.
  // One cancelled on the way, as by an update, ends too.
  await page.evaluate(() =>
    Promise.allSettled(
      [...document.querySelectorAll("mail-quilt")].flatMap(
        (host) =>
          host.shadowRoot?.getAnimations().map(({ finished }) => finished) ?? []
      )
    )
  );
  const builder = new AxeBuilder({ page })
    .include(element)
    .disableRules(skipRules);
  if (excludeIframe) {
    builder.exclude("iframe");
  }
  const { violations: found } = await builder
    .setLegacyMode()
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return found.map(({ id, nodes }) => ({
    id,
    targets: nodes.map(({ target }) => target),
  }));
};

/**
 * The contrast between two colors that `getComputedStyle` gives as `rgb()`, or
 * as `color(srgb …)` with channels from 0 to 1, as it gives a `color-mix()`.
 */
export const contrast = (...colors: string[]) => {
  const [lighter = 0, darker = 0] = colors
    .map((color) => {
      const scale = color.startsWith("color(srgb") ? 1 : 255;
      const [red = 0, green = 0, blue = 0] = (
        color.match(/[\d.]+/gu) ?? []
      ).map((value) => {
        const channel = Number(value) / scale;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    })
    .toSorted((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/** The Style Mode's panel, of the email's Email style. */
export const stylePanel = (page: Page) =>
  canvas(page).getByTestId("style-panel");

/** Chooses the Style Mode, and waits for its panel. */
export const openStyle = async (page: Page) => {
  await canvas(page).getByRole("tab", { exact: true, name: "Style" }).click();
  await expect(stylePanel(page)).toBeVisible();
  return stylePanel(page);
};

/** A setting in the Style panel, by its name, which its value follows. */
export const styleSetting = (page: Page, name: string) =>
  stylePanel(page).getByRole("button", {
    // "Body" isn't "Body text".
    name: new RegExp(`^${name} (?!text )(?:Default )?`, "u"),
  });

/** Sets a color in Style, typed in its picker's Hex field, and closes it. */
export const pickStyleColor = async (
  page: Page,
  name: string,
  color: string
) => {
  await styleSetting(page, name).click();
  await change(stylePanel(page).getByLabel("Hex"), color);
  await page.keyboard.press("Escape");
};

/** Picks a font in Style from its setting's list. */
export const pickStyleFont = async (page: Page, name: string, font: string) => {
  await styleSetting(page, name).click();
  await stylePanel(page)
    .getByRole("option", { exact: true, name: font })
    .click();
};
