import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import type { MailQuilt, StarterEmail } from "../src/index.js";
import {
  announcement,
  canvas,
  changesSince,
  emailWith,
  setValue,
  structure,
  test,
  undo,
  violations,
} from "./helpers.js";

const LETTER = {
  description: "Heading, text, sign-off",
  email: emailWith([[["Dear Ana"]], [["See you"], ["Jonah"]]]),
  name: "Letter",
} satisfies StarterEmail;

const startScreen = (page: Page) => canvas(page).getByTestId("start-screen");

const card = (page: Page, name: string) =>
  startScreen(page).getByRole("button", { name });

/** The test page, with an email of no Rows, and Starter emails if given. */
const openEmpty = async (page: Page, starters?: StarterEmail[]) => {
  await page.goto("/");
  await canvas(page).evaluate((element, given) => {
    (element as MailQuilt).starterEmails = given;
  }, starters);
  await setValue(page, emailWith([]));
};

test("picking a Starter email makes the email a copy of it, in one undo step", async ({
  page,
}) => {
  await openEmpty(page, [LETTER]);
  await expect(
    startScreen(page).getByRole("heading", { name: "Start an email" })
  ).toBeVisible();
  await expect(card(page, "Blank")).toHaveAccessibleDescription(
    "An empty email"
  );
  await expect(card(page, "Letter")).toHaveAccessibleDescription(
    "Heading, text, sign-off"
  );
  expect(await violations(page)).toStrictEqual([]);
  const changes = await changesSince(page);

  await card(page, "Letter").click();

  await expect(startScreen(page)).toHaveCount(0);
  expect(await structure(page)).toStrictEqual([
    [["Dear Ana"]],
    [["See you"], ["Jonah"]],
  ]);
  await expect(announcement(page)).toHaveText("Started from Letter.");
  await changes(1);

  await undo(page);

  // Started, so the empty email shows rather than the start screen.
  expect(await structure(page)).toStrictEqual([]);
  await expect(canvas(page).getByTestId("start-row")).toBeVisible();
  await expect(startScreen(page)).toHaveCount(0);
});

test("Blank closes the start screen, with focus on the email's first layout", async ({
  page,
}) => {
  await openEmpty(page, [LETTER]);
  await card(page, "Blank").focus();

  await page.keyboard.press("Enter");

  await expect(startScreen(page)).toHaveCount(0);
  await expect(
    canvas(page).getByTestId("start-row").getByRole("button").first()
  ).toBeFocused();
});

test("there's no start screen without Starter emails, or once the email has a Row", async ({
  page,
}) => {
  await openEmpty(page);
  await expect(canvas(page).getByTestId("start-row")).toBeVisible();

  await setValue(page, emailWith([[["Hello"]]]));
  await canvas(page).evaluate(
    (element, given) => {
      (element as MailQuilt).starterEmails = given;
    },
    [LETTER]
  );

  await expect(canvas(page).getByText("Hello")).toBeVisible();
  await expect(startScreen(page)).toHaveCount(0);
});

test("a Starter email with no Rows closes the start screen too", async ({
  page,
}) => {
  const branded = {
    email: {
      ...emailWith([]),
      settings: { ...emailWith([]).settings, backgroundColor: "#fbf7f1" },
    },
    name: "Branded blank",
  } satisfies StarterEmail;
  await openEmpty(page, [branded]);

  await card(page, "Branded blank").click();

  await expect(startScreen(page)).toHaveCount(0);
  await expect(canvas(page).getByTestId("start-row")).toBeVisible();
});
