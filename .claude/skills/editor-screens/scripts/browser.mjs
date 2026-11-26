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

/**
 * Gives every editor on the page the built-in dark theme, as a host app would
 * with `theme="dark"`, from before it starts. Tokens a page sets inline, such
 * as the Playground's orange accent, are taken off, as they'd win over the
 * theme, so the shots show the theme itself, and so are any it sets later,
 * such as the home page's theme buttons do. The Shell passes it to its editor.
 * Only `style` is watched, so setting `theme` doesn't start another sweep.
 */
const darkenEditors = () => {
  const darken = (element) => {
    element.setAttribute("theme", "dark");
    for (const name of [...element.style]) {
      if (name.startsWith("--mq-")) {
        element.style.removeProperty(name);
      }
    }
  };
  const sweep = () => {
    for (const element of document.querySelectorAll(
      "mail-quilt, mail-quilt-shell"
    )) {
      darken(element);
    }
  };

  new MutationObserver(sweep).observe(document, {
    attributeFilter: ["style"],
    childList: true,
    subtree: true,
  });
};

/**
 * Opens a page `width` wide. `theme` is what the browser tells the page it
 * prefers, which the site follows. `editorTheme` "dark" also gives every
 * editor on the page the built-in dark theme, as a host app would. Below
 * `PHONE_BELOW` the page is a touch phone, unless `phone` is false.
 */
export const openPage = async ({
  width,
  theme,
  editorTheme = "light",
  phone = width < PHONE_BELOW,
}) => {
  const browser = await chromium.launch();
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
    await page.addInitScript(darkenEditors);
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

  await page.locator(from).scrollIntoViewIfNeeded({ timeout: STEP_TIMEOUT });

  const start = await page.locator(from).boundingBox({ timeout: STEP_TIMEOUT });
  const end = await page.locator(to).boundingBox({ timeout: STEP_TIMEOUT });
  const viewport = page.viewportSize();
  // A box can lie outside the window, where the mouse can't reach it.
  const onScreen = (box) => {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    return x >= 0 && y >= 0 && x < viewport.width && y < viewport.height;
  };

  if (!(start && end && onScreen(start) && onScreen(end))) {
    throw new Error(
      `Can't drag ${value}: both ends must be on screen at once, so pick two that fit in one window`
    );
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
  // Never a phone, which would lay the sheet out wider and shrink it.
  const { browser, page } = await openPage({ phone: false, theme: "light", width });

  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.screenshot({ fullPage: true, path: pngPath });
  } finally {
    await browser.close();
  }
};
