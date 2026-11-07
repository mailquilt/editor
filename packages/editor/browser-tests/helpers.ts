import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

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
};
