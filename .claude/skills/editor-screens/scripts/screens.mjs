// oxlint-disable no-await-in-loop -- steps run in order, and each worker takes one screenshot at a time.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  BASE_URL,
  PHONE_BELOW,
  describeFocus,
  navigate,
  openPage,
  readArgs,
  renderSheet,
  runStep,
} from "./browser.mjs";

const USAGE = `Usage: node screens.mjs --out <dir> [--path /] [--name screen]
  [--widths 320,390,768,1024,1440,1920,2560] [--themes light,dark]
  [--editor light|dark|both] [--wait <ms>] [--parallel 4] [--block <url glob>]...
  [--step click=<target> | hover=<target> | type=<text> | press=<key> | drag=<from> -> <to> | wait=<ms>]...`;

const args = readArgs(process.argv.slice(2));

if (!args.out) {
  console.error(USAGE);
  process.exit(1);
}

const out = path.resolve(args.out);
const name = args.name ?? "screen";
const widths = (args.widths ?? "320,390,768,1024,1440,1920,2560")
  .split(",")
  .map(Number);
const themes = (args.themes ?? "light,dark").split(",");
const editorThemes =
  args.editor === "both" ? ["light", "dark"] : [args.editor ?? "light"];
const steps = [args.step ?? []].flat();
const blocked = [args.block ?? []].flat();
const wait = args.wait === undefined ? undefined : Number(args.wait);
const parallel = Number(args.parallel ?? 4);
const SHEET_ROW_HEIGHT = 420;
const shots = [];

mkdirSync(out, { recursive: true });

const shoot = async ({ editorTheme, theme, width }) => {
  const { browser, page, settle } = await openPage({ editorTheme, theme, width });
  const label = `${width}px, page ${theme}, editor ${editorTheme}`;

  try {
    for (const pattern of blocked) {
      await page.route(pattern, (route) => route.abort());
    }

    await navigate(page, `${BASE_URL}${args.path ?? "/"}`);
    await (wait === undefined ? settle() : page.waitForTimeout(wait));

    for (const step of steps) {
      try {
        await runStep(page, step);
      } catch (error) {
        throw new Error(`${label}: ${step} failed; no screenshot taken.\n${error.message}`, {
          cause: error,
        });
      }

      await settle({ quiet: 300 });
    }

    const focus = await describeFocus(page);
    const file = `${name}-${width}-${theme}-editor-${editorTheme}.png`;

    await page.screenshot({ path: path.join(out, file) });
    shots.push({ file, key: `${editorTheme} ${theme} ${width}`, label, width });
    console.log(`${file}  focus: ${focus}`);
  } finally {
    await browser.close();
  }
};

const queue = editorThemes.flatMap((editorTheme) =>
  themes.flatMap((theme) => widths.map((width) => ({ editorTheme, theme, width })))
);
const order = queue.map(({ editorTheme, theme, width }) => `${editorTheme} ${theme} ${width}`);

// WARNING: on a failure, let the other workers finish their shot so every browser is closed.
let failure;

const worker = async () => {
  for (let next = queue.shift(); next; next = queue.shift()) {
    try {
      await shoot(next);
    } catch (error) {
      failure ??= error;
      queue.length = 0;
    }
  }
};

await Promise.all(Array.from({ length: parallel }, worker));

if (failure) {
  console.error(failure.message);
  process.exit(1);
}

shots.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

const cells = shots
  .map(
    ({ file, label }) =>
      `<figure style="margin:0"><img src="${file}" style="height:${SHEET_ROW_HEIGHT}px"><figcaption>${label}</figcaption></figure>`
  )
  .join("");

const sheetWidth = Math.min(
  2400,
  shots.reduce(
    (total, { width }) =>
      total + (width * SHEET_ROW_HEIGHT) / (width < PHONE_BELOW ? 844 : 900) + 16,
    32
  )
);

const sheet = path.join(out, `${name}-matrix.html`);

writeFileSync(
  sheet,
  `<body style="margin:16px;font:13px sans-serif;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">${cells}</body>`
);

await renderSheet(sheet, path.join(out, `${name}-matrix.png`), Math.ceil(sheetWidth));

console.log(`${name}-matrix.png`);
