import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt, SavedRow } from "../src/index.js";
import {
  addPanel,
  announcement,
  barButton,
  boxOf,
  canvas,
  consoleErrors,
  dropIndicator,
  emailWith,
  hostEvents,
  openAddPanel,
  openEmail,
  rowTools,
  selectRow,
  settle,
  structure,
  test,
  undoByKey,
  violations,
} from "./helpers.js";

/** Wide enough for the Rows list to start expanded, beside the email and More. */
test.use({ viewport: { height: 1600, width: 1440 } });

const footerEmail = emailWith([[["Thanks"], ["Unsubscribe"]]]);

const FOOTER = {
  name: "Footer",
  row: footerEmail.rows[0],
  version: footerEmail.version,
} satisfies SavedRow;

const giveSavedRows = (page: Page, savedRows: unknown[] | undefined) =>
  canvas(page).evaluate((element, given) => {
    (element as MailQuilt).savedRows = given as SavedRow[];
  }, savedRows);

const rowsAdd = (page: Page) => canvas(page).getByTestId("rows-add");

const openRowsAdd = async (page: Page) => {
  await canvas(page)
    .getByTestId("rows-list")
    .getByRole("button", { name: "Add a Row" })
    .press("Enter");
  await expect(rowsAdd(page)).toBeVisible();
};

test("a Saved Row from the Rows list's + is added below the current Row in one undo step, selected and announced, with focus on its chip", async ({
  page,
}) => {
  await openEmail(page, [[["A"]], [["B"]]]);
  await giveSavedRows(page, [FOOTER]);
  await selectRow(page, 1);
  await openRowsAdd(page);
  await expect(
    rowsAdd(page).getByRole("heading", { name: "Saved Rows" })
  ).toBeVisible();
  expect(await violations(page)).toStrictEqual([]);
  const changes = await hostEvents(page, "mq-change", ["type"]);

  // Tab from the layouts reaches the Saved Rows.
  await page.keyboard.press("Tab");
  await expect(
    rowsAdd(page).getByRole("button", { name: "Footer" })
  ).toBeFocused();
  await page.keyboard.press("Enter");

  expect(await structure(page)).toStrictEqual([
    [["A"]],
    [["Thanks"], ["Unsubscribe"]],
    [["B"]],
  ]);
  expect(await changes()).toHaveLength(1);
  await expect(rowsAdd(page)).toBeHidden();
  await expect(rowTools(page, 2)).toBeVisible();
  await expect(announcement(page)).toHaveText("Footer added, position 2 of 3.");
  await expect(barButton(page, "Row 2")).toBeFocused();

  await undoByKey(page);

  expect(await structure(page)).toStrictEqual([[["A"]], [["B"]]]);
});

test("a Saved Row the checks refuse isn't offered, and the console says why", async ({
  page,
}) => {
  const errors = consoleErrors(page);
  await openEmail(page, [[["A"]]]);
  await giveSavedRows(page, [{ ...FOOTER, name: "Broken", row: {} }]);
  await openRowsAdd(page);

  // With nothing to offer, there's no Saved Rows section, as frame l04 draws.
  await expect(rowsAdd(page).getByText("Saved Rows")).toHaveCount(0);
  expect(errors).toStrictEqual([
    expect.stringContaining('left out a Saved Row in savedRows, "Broken"'),
  ]);
});

test("the Add panel's search finds a Saved Row by its name, and a drag adds it between two Rows", async ({
  page,
}) => {
  await openEmail(page, [[["A"]], [["B"]]]);
  await giveSavedRows(page, [{ ...FOOTER, name: "Quote" }, FOOTER]);
  await openAddPanel(page);
  await page.keyboard.type("foot");
  const card = addPanel(page).getByRole("button", { name: "Footer" });
  await expect(addPanel(page).getByTestId("saved-row")).toHaveCount(1);
  const from = await boxOf(card);
  const second = await boxOf(canvas(page).getByTestId("row").nth(1));

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 3 });
  await page.mouse.move(second.x + 100, second.y + 4, { steps: 8 });
  await settle(page);
  await expect(dropIndicator(page)).toBeVisible();
  await page.mouse.up();
  await settle(page);

  expect(await structure(page)).toStrictEqual([
    [["A"]],
    [["Thanks"], ["Unsubscribe"]],
    [["B"]],
  ]);
  await expect(rowTools(page, 2)).toBeVisible();
});
