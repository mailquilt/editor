// The pictures in the example emails. They're drawn here, as SVG, so the
// examples need no image files. Each stands in for a photo or screenshot a
// real sender would use, and reaches its email through a Merge Tag.
//
// They use the site's own colors: ink, greys, and one orange thing in each.

export const INK = "#111113";
export const ORANGE = "#d4380f";
export const WASH = "#f4f4f5";
export const LINE = "#d4d4d8";
export const SOFT = "#e4e4e7";
export const PAPER = "#ffffff";

const svg = (width: number, height: number, body: string[]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body.join("")}</svg>`;

const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  radius = 12
) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`;

const dashed = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 12
) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="none" stroke="#a1a1aa" stroke-width="3" stroke-dasharray="10 8"/>`;

/** An image as a `data:` address, which is what a Merge Tag is filled with here. */
const asAddress = (image: string) =>
  `data:image/svg+xml;base64,${Buffer.from(image).toString("base64")}`;

/** A new workspace: a sidebar, three panels, and room for a fourth. */
const workspace = () =>
  svg(1136, 480, [
    rect(0, 0, 1136, 480, WASH, 24),
    rect(40, 40, 228, 400, PAPER, 16),
    rect(68, 72, 96, 20, INK, 8),
    ...[0, 1, 2, 3].map((line) =>
      rect(
        68,
        132 + line * 44,
        line === 0 ? 160 : 120,
        14,
        line === 0 ? INK : LINE,
        7
      )
    ),
    rect(304, 40, 248, 188, PAPER, 16),
    rect(328, 68, 120, 14, INK, 7),
    rect(328, 100, 176, 12, LINE, 6),
    rect(328, 124, 136, 12, LINE, 6),
    rect(328, 176, 88, 28, INK, 9),
    rect(576, 40, 248, 188, PAPER, 16),
    rect(600, 68, 96, 14, INK, 7),
    rect(600, 100, 184, 12, LINE, 6),
    rect(600, 124, 112, 12, LINE, 6),
    rect(600, 176, 88, 28, ORANGE, 9),
    rect(848, 40, 248, 188, PAPER, 16),
    rect(872, 68, 136, 14, INK, 7),
    rect(872, 100, 160, 12, LINE, 6),
    rect(872, 124, 128, 12, LINE, 6),
    rect(872, 176, 88, 28, INK, 9),
    rect(304, 252, 520, 188, PAPER, 16),
    rect(328, 280, 144, 14, INK, 7),
    ...[0, 1, 2].map((line) =>
      rect(328, 320 + line * 32, 472 - line * 72, 12, LINE, 6)
    ),
    dashed(849.5, 253.5, 245, 185, 16),
    rect(868, 236, 248, 150, WASH, 22),
    rect(876, 244, 232, 134, ORANGE, 16),
    rect(900, 268, 104, 14, PAPER, 7),
    rect(900, 300, 152, 12, "#f6b8a6", 6),
  ]);

/** A tote bag. */
const tote = () =>
  svg(304, 304, [
    rect(0, 0, 304, 304, WASH, 24),
    `<path d="M112 128c0-44 16-68 40-68s40 24 40 68" fill="none" stroke="${LINE}" stroke-width="10" stroke-linecap="round"/>`,
    `<path d="M72 120h160l12 120a14 14 0 0 1-14 16H74a14 14 0 0 1-14-16z" fill="${INK}"/>`,
    rect(128, 172, 48, 36, ORANGE, 8),
  ]);

/** Three enamel pins. */
const pins = () =>
  svg(304, 304, [
    rect(0, 0, 304, 304, WASH, 24),
    rect(64, 72, 84, 84, INK, 20),
    rect(164, 88, 76, 76, PAPER, 38),
    `<circle cx="202" cy="126" r="38" fill="none" stroke="${LINE}" stroke-width="3"/>`,
    rect(108, 172, 84, 64, ORANGE, 18),
  ]);

/** Folders, with one lifted off the pile. */
const folders = () =>
  svg(1136, 420, [
    rect(0, 0, 1136, 420, WASH, 24),
    rect(372, 150, 392, 200, SOFT, 18),
    rect(372, 126, 152, 48, SOFT, 14),
    rect(348, 126, 392, 200, LINE, 18),
    rect(348, 102, 152, 48, LINE, 14),
    rect(396, 70, 152, 48, INK, 14),
    rect(396, 94, 392, 200, INK, 18),
    rect(428, 142, 168, 14, PAPER, 7),
    rect(428, 174, 104, 14, "#71717a", 7),
    rect(692, 238, 64, 28, ORANGE, 9),
  ]);

/** A search box, with what it finds as you type. */
const search = () =>
  svg(536, 300, [
    rect(0, 0, 536, 300, WASH, 20),
    rect(48, 48, 440, 60, PAPER, 16),
    `<circle cx="86" cy="76" r="11" fill="none" stroke="${INK}" stroke-width="5"/>`,
    `<path d="m94 85 10 10" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    rect(120, 69, 120, 14, INK, 7),
    rect(246, 64, 4, 24, ORANGE, 2),
    rect(48, 128, 440, 36, PAPER, 10),
    rect(68, 140, 200, 12, LINE, 6),
    rect(48, 176, 440, 36, PAPER, 10),
    rect(68, 188, 152, 12, LINE, 6),
    rect(48, 224, 440, 36, PAPER, 10),
    rect(68, 236, 176, 12, LINE, 6),
  ]);

/** A table, with one column picked out. */
const table = () =>
  svg(536, 300, [
    rect(0, 0, 536, 300, WASH, 20),
    rect(48, 48, 440, 204, PAPER, 16),
    rect(72, 72, 104, 14, INK, 7),
    rect(216, 72, 80, 14, INK, 7),
    rect(360, 72, 80, 14, ORANGE, 7),
    rect(72, 104, 392, 2, SOFT, 1),
    ...[0, 1, 2].flatMap((row) => [
      rect(72, 128 + row * 40, 88 + row * 12, 12, LINE, 6),
      rect(216, 128 + row * 40, 64, 12, LINE, 6),
      rect(360, 128 + row * 40, 72, 12, LINE, 6),
    ]),
  ]);

export const art = {
  folders: asAddress(folders()),
  pins: asAddress(pins()),
  search: asAddress(search()),
  table: asAddress(table()),
  tote: asAddress(tote()),
  workspace: asAddress(workspace()),
};
