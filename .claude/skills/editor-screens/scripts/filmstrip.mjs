// oxlint-disable no-await-in-loop -- steps run in order.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  BASE_URL,
  navigate,
  openPage,
  readArgs,
  renderSheet,
  runStep,
} from "./browser.mjs";

const USAGE = `Usage: node filmstrip.mjs --out <dir> [--path /] [--name load] [--width 1280]
  [--theme light] [--editor light|dark] [--latency 120] [--duration 3500]
  [--step <as in screens.mjs>]...

Records every frame painted while the page loads. With steps, the page loads
first and the recording covers the last step, such as opening the Preview.`;

const args = readArgs(process.argv.slice(2));

if (!args.out) {
  console.error(USAGE);
  process.exit(1);
}

const out = path.resolve(args.out);
const name = args.name ?? "load";
const width = Number(args.width ?? 1280);
const steps = [args.step ?? []].flat();
const frames = [];
let start = Date.now();

mkdirSync(out, { recursive: true });

const { browser, context, page } = await openPage({
  editorTheme: args.editor ?? "light",
  theme: args.theme ?? "light",
  width,
});

try {
  const cdp = await context.newCDPSession(page);

  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    downloadThroughput: -1,
    latency: Number(args.latency ?? 120),
    offline: false,
    uploadThroughput: -1,
  });

  cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
    frames.push({ at: Date.now() - start, data });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });

  const record = async () => {
    await cdp.send("Page.startScreencast", {
      everyNthFrame: 1,
      format: "png",
      maxWidth: width,
    });
    start = Date.now();
  };

  if (steps.length === 0) {
    await record();
    await navigate(page, `${BASE_URL}${args.path ?? "/"}`);
  } else {
    await navigate(page, `${BASE_URL}${args.path ?? "/"}`);
    await page.waitForTimeout(1500);

    for (const step of steps.slice(0, -1)) {
      await runStep(page, step);
      await page.waitForTimeout(400);
    }

    await record();
    await runStep(page, steps.at(-1));
  }

  await page.waitForTimeout(Number(args.duration ?? 3500));
  await cdp.send("Page.stopScreencast");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}

if (process.exitCode === 1) {
  process.exit(1);
}

const files = frames.map(({ at, data }, index) => {
  const file = `${name}-${String(index).padStart(3, "0")}-${at}ms.png`;

  writeFileSync(path.join(out, file), Buffer.from(data, "base64"));

  return { at, file };
});

const cells = files
  .map(
    ({ at, file }) =>
      `<figure style="margin:0"><img src="${file}" style="width:300px;border:1px solid #ccc"><figcaption>${at} ms</figcaption></figure>`
  )
  .join("");

const sheet = path.join(out, `${name}-filmstrip.html`);

writeFileSync(
  sheet,
  `<body style="margin:16px;font:12px sans-serif;display:grid;grid-template-columns:repeat(5,300px);align-content:start;gap:12px">${cells}</body>`
);

await renderSheet(sheet, path.join(out, `${name}-filmstrip.png`), 1620);

console.log(`${files.length} frames, ${name}-filmstrip.png`);
