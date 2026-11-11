import { AxeBuilder } from "@axe-core/playwright";
import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { MailQuilt } from "../src/index.js";

export const canvas = (page: Page) => page.locator("mail-quilt");

export const textBlock = (page: Page) =>
  page.getByRole("textbox", { name: "Text Block" });

type Document = NonNullable<MailQuilt["value"]>;

const blockWith = (text: string) => ({
  id: `block-${text}`,
  props: {
    content: {
      content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
      type: "doc",
    },
  },
  type: "text",
});

/** An email from each Row's Columns, as the text of each Column's Blocks. */
export const emailWith = (rows: string[][][]): Document => ({
  kind: "blocks",
  rows: rows.map((columns, rowIndex) => ({
    columns: columns.map((texts, columnIndex) => ({
      blocks: texts.map(blockWith),
      id: `column-${rowIndex}-${columnIndex}`,
      props: {},
      width: 100 / columns.length,
    })),
    id: `row-${rowIndex}`,
    props: {},
  })),
  settings: {
    backgroundColor: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    width: 600,
  },
  version: 1,
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

export const setValue = (page: Page, document: unknown) =>
  canvas(page).evaluate((element, value) => {
    (element as MailQuilt).value = value as MailQuilt["value"];
  }, document);

/** On macOS, End scrolls the page and leaves the cursor where it is. */
export const moveCursorToLineEnd = (page: Page) =>
  page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowRight" : "End"
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
  await page.evaluate(
    () =>
      // oxlint-disable-next-line promise/avoid-new -- These browser callbacks have no promise form.
      new Promise((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 0));
      })
  );
};

export const palette = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Add content" })
    .getByRole("button", { exact: true, name });

/**
 * Shows a side panel tab. A selected Block's settings take the tabs' place, so
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
export const showPalette = async (page: Page, name: string) => {
  await openTab(page, "Content");
  return palette(page, name);
};

/** Adds a Row with this layout from the Rows tab. */
export const addRow = async (page: Page, layout = "100") => {
  await openTab(page, "Rows");
  await canvas(page)
    .getByRole("group", { name: "Add a Row" })
    .getByRole("button", { exact: true, name: layout })
    .click();
};

export const rowTools = (page: Page, position: number) =>
  canvas(page).getByRole("group", { exact: true, name: `Row ${position}` });

/**
 * A Row's toolbar shows on hover, so the pointer goes there first. While one of
 * its Blocks is selected, it only shows once its tag has selected the Row.
 */
const showRowTools = async (page: Page, position: number) => {
  const frame = canvas(page)
    .locator(".row-frame")
    .nth(position - 1);
  await frame.locator(".row").hover({ position: { x: 4, y: 4 } });
  if ((await frame.locator('[aria-current="true"]').count()) > 0) {
    await frame.locator(".row-tag").click();
  }
};

/** Selects a Row from its toolbar, with the mouse, to show it in the side panel. */
export const selectRow = async (page: Page, position: number) => {
  await showRowTools(page, position);
  await rowTools(page, position)
    .getByRole("button", { name: "Select Row" })
    .click();
};

/** A layout in the selected Row's side panel. */
export const layoutOption = (page: Page, layout: string) =>
  canvas(page)
    .locator(".side-panel")
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
export const blockTool = (page: Page, name: string) =>
  canvas(page)
    .getByRole("toolbar", { name: "Block tools" })
    .getByRole("button", { exact: true, name });

export const blockGroup = (page: Page, name: string) =>
  canvas(page).getByRole("group", { name: `${name} Block` });

export const panelBlock = (page: Page) =>
  page
    .getByRole("group", { name: "Settings" })
    .getByRole("group", { exact: true, name: "Block" });

export const field = (page: Page, name: string) =>
  panelBlock(page).getByLabel(name, { exact: true });

export const change = async (control: Locator, text: string) => {
  await control.fill(text);
  await control.press("Enter");
};

export const undo = (page: Page) =>
  page.getByRole("button", { name: "Undo" }).click();
export const redo = (page: Page) =>
  page.getByRole("button", { name: "Redo" }).click();

export const blocks = async (page: Page, rowIndex = 0, columnIndex = 0) => {
  const { rows } = await currentValue(page);
  return rows[rowIndex]?.columns[columnIndex]?.blocks ?? [];
};

export const blockTypes = async (page: Page, rowIndex = 0, columnIndex = 0) => {
  const found = await blocks(page, rowIndex, columnIndex);
  return found.map(({ type }) => type);
};

/** An email whose only Row's Columns hold these Blocks, by type. */
export const openBlocks = async (page: Page, ...columns: string[][]) => {
  const email = emailWith([[[]]]);
  const [row] = email.rows;
  if (row) {
    const props = {
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
      blocks: types.map((type, blockIndex) => ({
        id: `${type}-${columnIndex}-${blockIndex}`,
        props: props[type as keyof typeof props],
        type,
      })),
      id: `column-${columnIndex}`,
      props: {},
      width: 100 / columns.length,
    }));
  }
  await page.goto("/");
  await setValue(page, email);
  await expect(canvas(page).locator(".block").first()).toBeVisible();
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

export const settle = (page: Page) =>
  page.evaluate(
    () =>
      // oxlint-disable-next-line promise/avoid-new -- requestAnimationFrame only takes a callback.
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );

export const dragTo = async (
  page: Page,
  from: Locator,
  to: Locator,
  part = 0.75
) => {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!(start && end)) {
    throw new Error("The element has no box");
  }
  const startX = start.x + start.width / 2;
  const startY = start.y + start.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY + 8, { steps: 2 });
  await settle(page);
  await page.mouse.move(end.x + end.width / 2, end.y + end.height * part, {
    steps: 8,
  });
  await settle(page);
  await page.mouse.up();
  await settle(page);
};

export const violations = async (
  page: Page,
  element = "mail-quilt"
): Promise<{ id: string; targets: unknown[] }[]> => {
  const { violations: found } = await new AxeBuilder({ page })
    .include(element)
    .setLegacyMode()
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return found.map(({ id, nodes }) => ({
    id,
    targets: nodes.map(({ target }) => target),
  }));
};
