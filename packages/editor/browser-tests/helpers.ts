import { AxeBuilder } from "@axe-core/playwright";
import type { Block, BlockType } from "@mailquilt/core";
import type { BlockProps } from "@mailquilt/core/internal";
import { expect, test as base } from "@playwright/test";
import type { BrowserContext, Locator, Page } from "@playwright/test";

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

export const linkUrlField = (page: Page) =>
  page.getByRole("textbox", { name: "Link URL" });

export const previewButton = (page: Page) =>
  page.getByRole("button", { exact: true, name: "Preview" });

export const previewDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Preview" });

/** The email in the open Preview. */
export const previewEmail = (page: Page) =>
  page.getByTitle("Email preview").contentFrame().locator("body");

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

/** On macOS, End scrolls the page and leaves the cursor where it is. */
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
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowLeft" : "Home"
  );
  // ProseMirror learns of the moved cursor a moment later. A key it handles
  // itself, such as Enter, would act on the old position before then.
  await settle(page);
};

export const palette = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Add content" })
    .getByRole("button", { exact: true, name: `Add ${name} Block` });

/** The Rows tab's tile for a layout, with the tab showing. */
export const layoutTile = (page: Page, layout: string) =>
  canvas(page)
    .getByRole("group", { name: "Add a Row" })
    .getByRole("button", { exact: true, name: `Add ${layout} Row` });

/**
 * Shows a side panel tab. A selected Block's settings show instead of the tabs, so
 * this goes back to them first, and the Block stays selected.
 */
export const openTab = async (page: Page, name: string) => {
  const back = canvas(page).getByRole("button", { exact: true, name: "Back" });
  if (await back.isVisible()) {
    await back.click();
  }
  const tab = canvas(page).getByRole("tab", { exact: true, name });
  if ((await tab.getAttribute("aria-selected")) !== "true") {
    await tab.click();
  }
};

/** The Content tab's tile for a type of Block, with the tab showing. */
const showPalette = async (page: Page, name: string) => {
  await openTab(page, "Content");
  return palette(page, name);
};

/** Adds a Row with this layout from the Rows tab. */
export const addRow = async (page: Page, layout = "100") => {
  await openTab(page, "Rows");
  await layoutTile(page, layout).click();
};

export const rowTools = (page: Page, position: number) =>
  canvas(page).getByRole("toolbar", { exact: true, name: `Row ${position}` });

export const selectRowButton = (page: Page, position: number) =>
  rowTools(page, position).getByRole("button", { name: "Select Row" });

/** What the editor last said to screen readers. */
export const announcement = (page: Page) => canvas(page).getByRole("status");

/** The test host's count of `mq-change` events. */
export const changeCount = (page: Page) => page.getByTestId("change-count");

/** The document the test host last received in an `mq-change`. */
export const latestDocument = async (page: Page) =>
  JSON.parse(
    (await page.getByTestId("latest-document").textContent()) ?? ""
  ) as Document;

/** Counts the Escape presses that reach the host page, from here on. */
export const countHostEscapes = async (page: Page) => {
  await page.evaluate(() => {
    const counter = window as unknown as { hostEscapes: number };
    counter.hostEscapes = 0;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        counter.hostEscapes += 1;
      }
    });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { hostEscapes: number }).hostEscapes
    );
};

/**
 * Whether the editor kept the browser from acting on the last press of this
 * key, from here on, as the host page sees it. Undefined until one reaches it.
 */
export const watchPrevented = async (page: Page, key: string) => {
  await page.evaluate((watched) => {
    document.addEventListener("keydown", (event) => {
      if (event.key === watched) {
        Object.assign(window, { lastPrevented: event.defaultPrevented });
      }
    });
  }, key);
  return () => page.evaluate(() => Reflect.get(window, "lastPrevented"));
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

/** Opens the test page with an email of these Rows of Text Blocks. */
export const openEmail = async (page: Page, rows: string[][][]) => {
  await page.goto("/");
  await setValue(page, emailWith(rows));
  await expect(textBlock(page).first()).toBeVisible();
  // An email the editor refused, such as one with two Blocks of the same text
  // and so the same id, would leave the test working on something else.
  expect(await structure(page)).toEqual(rows);
};

/** A Row's frame. A drag's copy of it is left out. */
export const rowFrame = (page: Page, position: number) =>
  canvas(page)
    .locator('[data-testid="row-frame"]:not([data-drag-ghost])')
    .nth(position - 1);

export const rowTag = (page: Page, position: number) =>
  rowFrame(page, position).getByTestId("row-tag");

/** A Row's toolbar shows on hover, so the pointer goes there first. */
export const hoverRow = (page: Page, position: number) =>
  rowFrame(page, position)
    .getByTestId("row")
    .hover({ position: { x: 4, y: 4 } });

/**
 * Shows a Row's toolbar. While one of its Blocks is selected, it only shows
 * once its tag has selected the Row.
 */
const showRowTools = async (page: Page, position: number) => {
  await hoverRow(page, position);
  if (
    (await rowFrame(page, position)
      .locator('[role="group"][aria-current="true"]')
      .count()) > 0
  ) {
    await rowTag(page, position).click();
  }
};

/** Selects a Row from its toolbar, with the mouse, to show it in the side panel. */
export const selectRow = async (page: Page, position: number) => {
  await showRowTools(page, position);
  await selectRowButton(page, position).click();
};

/** A layout in the selected Row's side panel. */
export const layoutOption = (page: Page, layout: string) =>
  canvas(page)
    .getByTestId("side-panel")
    .getByRole("group", { name: "Layout" })
    .getByRole("button", { exact: true, name: layout });

/** Chooses a Row's layout in the side panel, with the mouse. */
export const chooseLayout = async (
  page: Page,
  position: number,
  layout: string
) => {
  await selectRow(page, position);
  await layoutOption(page, layout).click();
};

/** Deletes a Row from its toolbar, with the mouse. */
export const deleteRow = async (page: Page, position: number) => {
  await showRowTools(page, position);
  await rowTools(page, position)
    .getByRole("button", { name: "Delete Row" })
    .click();
};

/** The selected Block's toolbar, on the canvas. */
export const blockTools = (page: Page) =>
  canvas(page).getByRole("toolbar", { name: "Block tools" });

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

export const blockTool = (page: Page, name: string) =>
  blockTools(page).getByRole("button", { exact: true, name });

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

/** The text of the Text Block with this exact text. */
export const textOf = (page: Page, text: string) =>
  blockWith(page, text).getByRole("textbox", { name: "Text Block" });

/** The selected Block, if there is one. */
export const selectedBlock = (page: Page) =>
  canvas(page).locator('[role="group"][aria-current="true"]');

/** The text of the selected Block. */
export const selectedText = (page: Page) =>
  selectedBlock(page).getByRole("textbox");

export const panelBlock = (page: Page) =>
  page.getByRole("group", { exact: true, name: "Block" });

export const field = (page: Page, name: string) =>
  panelBlock(page).getByLabel(name, { exact: true });

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
      spacer: {},
      text: {
        content: {
          content: [
            { content: [{ text: "Words", type: "text" }], type: "paragraph" },
          ],
          type: "doc",
        },
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
    // oxlint-disable-next-line no-await-in-loop -- Order doesn't matter, and there are few.
    await expect(image).toHaveJSProperty("complete", true);
  }
};

export const openExport = async (page: Page) => {
  const html = await exportHtml(page);
  const opened = await page.context().newPage();
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

/**
 * Drags a file over the element and drops it there. Returns whether each event
 * kept the browser's own handling: false once it's prevented.
 */
export const dropFileOn = (target: Locator) =>
  target.evaluate((element) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["x"], "photo.png", { type: "image/png" }));
    return ["dragover", "drop"].map((type) =>
      element.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          dataTransfer,
        })
      )
    );
  });

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
 * hangs in Chromium and WebKit while the Preview's sandboxed iframe is showing.
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
