import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");

// The skill has no package of its own, so Playwright comes from the docs site's.
const { chromium } = createRequire(
  path.join(ROOT, "apps/docs/package.json")
)("@playwright/test");

/** Where the site runs; `SCREENS_URL`, or the preview server the skill starts. */
export const BASE_URL = process.env.SCREENS_URL ?? "http://localhost:4180";

export const PHONE_BELOW = 700;

/** Reads `--name value` pairs into an object; a repeated flag becomes an array. */
export const readArgs = (argv) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index].replace(/^--/u, "");
    const value = argv[index + 1];

    args[key] = args[key] === undefined ? value : [args[key], value].flat();
  }

  return args;
};

const DARK_THEME_BLOCK =
  /```css[^\n]*\n(mail-quilt \{[^`]*--mq-color-scheme: dark;[^`]*?\n\})\n```/u;

/**
 * The dark theme exactly as `theme-the-editor.mdx` documents it, so the
 * screenshots and the docs can't drift apart. Each token is `!important`,
 * because a page such as the Playground sets some tokens inline.
 */
const editorDarkTheme = () => {
  const docs = readFileSync(
    path.join(ROOT, "apps/docs/docs/theme-the-editor.mdx"),
    "utf8"
  );
  const block = DARK_THEME_BLOCK.exec(docs)?.[1];

  if (!block) {
    throw new Error(
      "No dark theme found in apps/docs/docs/theme-the-editor.mdx; update DARK_THEME_BLOCK in browser.mjs"
    );
  }

  return block
    .replace("mail-quilt {", "mail-quilt, mail-quilt-shell {")
    .replaceAll(/;\n/gu, " !important;\n");
};

/**
 * Opens a page `width` wide. `theme` is what the browser tells the page it
 * prefers, which the site follows. `editorTheme` "dark" also gives every
 * editor on the page the documented dark theme, as a host app would.
 */
export const openPage = async ({ width, theme, editorTheme = "light" }) => {
  const browser = await chromium.launch();
  const phone = width < PHONE_BELOW;
  const context = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: 1,
    hasTouch: phone,
    isMobile: phone,
    reducedMotion: process.env.SCREENS_REDUCED_MOTION ? "reduce" : "no-preference",
    viewport: { height: phone ? 844 : 900, width },
  });
  const page = await context.newPage();

  if (editorTheme === "dark") {
    await page.addInitScript((css) => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = css;
        document.head.append(style);
      });
    }, editorDarkTheme());
  }

  return { browser, context, page };
};

/** Opens `url`, and fails instead of capturing an error page when it can't load. */
export const navigate = async (page, url) => {
  try {
    const response = await page.goto(url, { waitUntil: "load" });

    if (response && !response.ok()) {
      throw new Error(`HTTP ${response.status()}`);
    }
  } catch (error) {
    throw new Error(
      `Couldn't load ${url}: ${error.message}. Is the preview server running?`,
      { cause: error }
    );
  }
};

const STEP_TIMEOUT = 5000;

/**
 * Runs one step, as a person would: real mouse and keyboard input, so focus
 * moves as it does for them. Targets are Playwright selectors, which reach
 * inside the editor's Shadow DOM: CSS, `text=Label`, or
 * `role=button[name="Preview"]`. A target that matches nothing, or more than
 * one thing, stops the run.
 */
export const runStep = async (page, step) => {
  const [kind, ...rest] = step.split("=");
  const value = rest.join("=");
  const options = { timeout: STEP_TIMEOUT };

  if (kind === "click") {
    await page.locator(value).click(options);
  } else if (kind === "hover") {
    await page.locator(value).hover(options);
  } else if (kind === "type") {
    await page.keyboard.type(value);
  } else if (kind === "press") {
    await page.keyboard.press(value);
  } else if (kind === "drag") {
    await dragAndHold(page, value);
  } else if (kind === "wait") {
    await page.waitForTimeout(Number(value));
  } else {
    throw new Error(
      `Unknown step "${kind}". Known: click, hover, type, press, drag, wait`
    );
  }
};

/**
 * Picks `from` up and moves it over `to` without dropping it, so the shot
 * shows the drag in progress. Add `press=Escape` or another step to finish it.
 */
const dragAndHold = async (page, value) => {
  const [from, to] = value.split(" -> ");

  if (!to) {
    throw new Error('A drag is "drag=<from> -> <to>"');
  }

  const start = await page.locator(from).boundingBox({ timeout: STEP_TIMEOUT });
  const end = await page.locator(to).boundingBox({ timeout: STEP_TIMEOUT });

  if (!(start && end)) {
    throw new Error(`Can't drag ${value}: one end isn't on screen`);
  }

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  // In steps, so the editor sees the pointer travel, as it would from a hand.
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
    steps: 12,
  });
};

/** Names what has focus, looking through every shadow root on the way. */
export const describeFocus = (page) =>
  page.evaluate(() => {
    let element = document.activeElement;

    while (element?.shadowRoot?.activeElement) {
      element = element.shadowRoot.activeElement;
    }

    if (!element || element === document.body) {
      return "the page (nothing focused)";
    }

    const name =
      element.getAttribute("aria-label") ??
      element.textContent?.trim().slice(0, 60) ??
      "";

    return `${element.tagName.toLowerCase()} ${JSON.stringify(name)}`;
  });

/** Renders an HTML contact sheet, all of it, to a PNG file. */
export const renderSheet = async (htmlPath, pngPath, width) => {
  const { browser, page } = await openPage({ theme: "light", width });

  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.screenshot({ fullPage: true, path: pngPath });
  } finally {
    await browser.close();
  }
};
