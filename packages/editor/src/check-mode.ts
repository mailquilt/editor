import type { BlocksDocument } from "@mailquilt/core";
import { MERGE_TAG } from "@mailquilt/core/internal";
import { checkEmail } from "@mailquilt/renderer";
import type { Problem, ProblemCode } from "@mailquilt/renderer";
import { css, html, nothing, unsafeCSS } from "lit";
import { guard } from "lit/directives/guard.js";
import { live } from "lit/directives/live.js";

import { place } from "./editor-places.js";
import { shadowRootsUpFrom } from "./geometry.js";
import type { HostAppProperties } from "./host-app.js";
import { htmlLines } from "./html-lines.js";
import type { HtmlPart } from "./html-lines.js";
import { ICONS } from "./icons.js";
import { claim, keyFor } from "./key-map.js";
import { locate } from "./positions.js";
import { refuseFiles } from "./refuse-files.js";
import type { StringId } from "./strings.js";
import { styleProperties } from "./style-properties.js";
import type { Text, TextValues } from "./text.js";
import { PHONE_WIDTH } from "./top-bar.js";

// The Check Mode: the email as it's exported, in an inbox at desktop and phone
// width, as plain text or as HTML, beside its Problems, each with what's wrong,
// why it matters and a fix button. Problems only warn, so nothing here stops an
// export.

/** How long Check waits to say the email is loading, so a quick render says nothing. */
const LOADING_SAID_AFTER_MS = 150;

/** The Problems panel's width, as the picked frames draw it. */
export const CHECK_PANEL_WIDTH_PX = 352;

/** Space around the inbox, between the Workspace's edge and the panel. */
export const CHECK_STAGE_PADDING_PX = 24;

/** Around the email in the desktop inbox, which shows the page behind it. */
const INBOX_MARGIN_PX = 20;

/** The phone's screen, on which a phone-wide email is drawn smaller. */
const PHONE_SCREEN_PX = 286;

/** The phone's frame around its screen. */
const PHONE_FRAME_PX = PHONE_SCREEN_PX + 14;

/** The phone's frame, as tall as its screen and its edge. */
const PHONE_FRAME_HEIGHT_PX = 626 + 14;

/** Between the desktop inbox and the phone, side by side. */
const PREVIEWS_GAP_PX = 36;

/** The least the two side by side are drawn at before the phone goes below. */
const LEAST_SIDE_BY_SIDE = 0.8;

/** The HTML tab's widest, which leaves its lines room to read. */
const CODE_WIDTH_PX = 840;

/** How long a copy button says it copied. */
const COPIED_SHOWN_MS = 2000;

/** What Check shows the email as, each in a tab of its own. */
const VIEWS = [
  { label: "check.viewInbox", view: "inbox" },
  { label: "check.viewText", view: "text" },
  { label: "check.viewHtml", view: "html" },
] as const satisfies readonly { label: StringId; view: string }[];

type CheckViewName = (typeof VIEWS)[number]["view"];

const viewTabId = (view: CheckViewName) => `check-view-${view}`;

const VIEW_PANEL_ID = "check-view-panel";

/**
 * How much smaller the inbox and phone are drawn in `room` px, for an email
 * `width` wide: side by side while they're at least 80% of their size, as on
 * a laptop, and otherwise the phone below, with the inbox as wide as there's
 * room for. Never larger.
 */
export const checkZoom = (room: number, width: number) => {
  const inbox = width + 2 * INBOX_MARGIN_PX;
  const both = inbox + PHONE_FRAME_PX;
  if (room <= 0) {
    return 1;
  }
  const sideBySide = (room - PREVIEWS_GAP_PX) / both;
  return Math.min(
    1,
    sideBySide >= LEAST_SIDE_BY_SIDE ? sideBySide : room / inbox
  );
};

export const checkStyles = css`
  /*
   * The inbox is a mail client's, drawn the same in either theme, as an email
   * client doesn't take the editor's.
   */
  .check {
    --_mq-inbox-paper: #ffffff;
    --_mq-inbox-ink: #18181b;
    --_mq-inbox-muted: #63636b;
    --_mq-inbox-line: #e4e4e7;
    --_mq-inbox-link: #2440e0;
    --_mq-inbox-danger: #b42318;
    --_mq-inbox-zoom: 1;
    /* How tall the inbox is drawn: as the window shows, under the top bar,
     * the switch and the captions, with a gap below. */
    --_mq-inbox-height: max(
      480px,
      min(100dvh, var(--_mq-visible-height, 100dvh)) -
        var(--_mq-top-bar-height) - 140px
    );
    background: var(--mq-color-workspace);
    display: flex;
    flex: 1 0 auto;
    min-height: 0;
  }

  .check-stage {
    align-items: center;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--mq-space-5);
    min-width: 0;
    padding: var(--mq-space-3) ${unsafeCSS(CHECK_STAGE_PADDING_PX)}px
      ${unsafeCSS(CHECK_STAGE_PADDING_PX)}px;
  }

  .check-samples {
    align-items: center;
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow-small);
    display: flex;
    font-weight: 500;
    gap: var(--mq-space-2);
    min-height: 34px;
    padding: 0 var(--mq-space-3);
  }

  /* The tabs, and the sample values switch beside them. */
  .check-bar {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: var(--mq-space-2);
    justify-content: center;
  }

  .check-views > .segment {
    flex: none;
    height: 28px;
    padding: 0 14px;
  }

  /* The plain text or the HTML, as tall as the inbox. */
  .check-code {
    background: var(--mq-color-surface);
    border: 1px solid var(--mq-color-border);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow-small);
    display: flex;
    flex-direction: column;
    height: var(--_mq-inbox-height);
    max-width: 100%;
    overflow: hidden;
    width: var(--_mq-inbox-width);
  }

  .check-code.html {
    width: ${unsafeCSS(CODE_WIDTH_PX)}px;
  }

  .check-code-head {
    align-items: center;
    border-bottom: 1px solid var(--mq-color-border);
    display: flex;
    flex: none;
    gap: var(--mq-space-3);
    justify-content: space-between;
    padding: var(--mq-space-2) var(--mq-space-2) var(--mq-space-2)
      var(--mq-space-4);
  }

  .check-code-head p {
    color: var(--mq-color-text-muted);
    margin: 0;
  }

  .check-code-head .text-button {
    align-items: center;
    display: inline-flex;
    flex: none;
    gap: 6px;
  }

  .check-code-head .text-button .icon {
    height: 14px;
    width: 14px;
  }

  /* Copied, in green on the button's own surface, hovered or not. */
  .check-code-head .copied,
  .check-code-head .copied:hover {
    background: var(--mq-color-surface);
    color: var(--mq-color-success);
  }

  .check-code-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .check-code-body:focus-visible {
    outline: 2px solid var(--mq-color-accent);
    outline-offset: -2px;
  }

  .check-code-body pre {
    font-family: var(--_mq-font-family-code);
    font-size: var(--_mq-font-size-code);
    line-height: 1.7;
    margin: 0;
    padding: var(--mq-space-4);
  }

  /* Plain text wraps, as an email app that shows only text wraps it. */
  .code-text {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  /* HTML doesn't, so each tag keeps its line, and it scrolls sideways. */
  .code-lines {
    flex: 1;
    white-space: pre;
  }

  /* The line numbers stay as the lines scroll sideways. */
  .code-gutter {
    background: var(--mq-color-surface-muted);
    border-inline-end: 1px solid var(--mq-color-border);
    color: var(--mq-color-text-muted);
    flex: none;
    inset-inline-start: 0;
    min-height: 100%;
    position: sticky;
    text-align: end;
    user-select: none;
  }

  .code-name {
    color: var(--mq-color-accent-strong);
  }

  .code-value {
    color: var(--mq-color-success);
  }

  .code-comment {
    color: var(--mq-color-text-muted);
  }

  .check-previews {
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: var(--mq-space-5) ${unsafeCSS(PREVIEWS_GAP_PX)}px;
    justify-content: center;
  }

  /*
   * The inbox and the phone are drawn smaller where the Workspace is too
   * narrow for them, as pictures, and their captions keep their size. Each is
   * scaled in a slot of the size it's drawn at, as CSS zoom would need
   * Firefox 126 and the editor supports 121.
   */
  .inbox-slot {
    height: var(--_mq-inbox-height);
    width: calc(var(--_mq-inbox-width) * var(--_mq-inbox-zoom));
  }

  .phone-slot {
    height: calc(${unsafeCSS(PHONE_FRAME_HEIGHT_PX)}px * var(--_mq-inbox-zoom));
    width: calc(${unsafeCSS(PHONE_FRAME_PX)}px * var(--_mq-inbox-zoom));
  }

  .inbox,
  .phone-frame {
    transform: scale(var(--_mq-inbox-zoom));
    transform-origin: 0 0;
  }

  .check-preview {
    margin: 0;
  }

  .check-preview > figcaption {
    align-items: center;
    color: var(--mq-color-text-muted);
    display: flex;
    font-size: var(--mq-font-size-small);
    gap: var(--mq-space-2);
    margin-block-end: var(--mq-space-2);
  }

  .check-preview > figcaption .icon {
    height: 14px;
    width: 14px;
  }

  .inbox {
    background: var(--_mq-inbox-paper);
    border-radius: var(--mq-radius);
    box-shadow: var(--mq-shadow-small);
    color: var(--_mq-inbox-ink);
    display: flex;
    flex-direction: column;
    height: calc(var(--_mq-inbox-height) / var(--_mq-inbox-zoom));
    overflow: hidden;
    width: var(--_mq-inbox-width);
  }

  .inbox-header {
    align-items: center;
    border-bottom: 1px solid var(--_mq-inbox-line);
    display: grid;
    gap: var(--mq-space-3);
    grid-template-columns: auto 1fr auto;
    padding: var(--mq-space-3) var(--mq-space-4);
  }

  /* With no sender, no avatar either, and the preheader at the start. */
  .inbox-header.plain {
    grid-template-columns: 1fr auto;
    padding-block: var(--mq-space-3);
  }

  .inbox-avatar {
    align-items: center;
    background: var(--_mq-inbox-ink);
    border-radius: 50%;
    color: var(--_mq-inbox-paper);
    display: grid;
    font-weight: 700;
    height: 36px;
    justify-items: center;
    width: 36px;
  }

  .inbox-lines {
    min-width: 0;
  }

  .inbox-lines > p {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inbox-sender {
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
  }

  .inbox-snippet {
    color: var(--_mq-inbox-muted);
  }

  .inbox-subject {
    color: var(--_mq-inbox-ink);
  }

  .inbox-time {
    color: var(--_mq-inbox-muted);
    font-size: var(--mq-font-size-small);
  }

  .phone-frame {
    background: var(--mq-color-surface);
    border-radius: 40px;
    box-shadow:
      inset 0 0 0 1.5px var(--mq-color-border),
      var(--mq-shadow-small);
    padding: 7px;
    /* Its own size, which the slot it's scaled in is not. */
    width: max-content;
  }

  .phone-screen {
    background: var(--_mq-inbox-paper);
    border-radius: 33px;
    display: flex;
    flex-direction: column;
    height: 626px;
    overflow: hidden;
    width: ${unsafeCSS(PHONE_SCREEN_PX)}px;
  }

  .phone-bar {
    align-items: flex-end;
    color: var(--_mq-inbox-link);
    display: flex;
    flex: none;
    font-size: var(--mq-font-size-small);
    font-weight: 600;
    height: 44px;
    padding: 0 var(--mq-space-4) var(--mq-space-2);
  }

  .phone-back {
    align-items: center;
    display: inline-flex;
    gap: 2px;
  }

  .phone-bar .icon {
    height: 12px;
    width: 12px;
  }

  /* A phone's width, drawn to the screen's, which clips what it leaves. */
  .phone-screen > .inbox-email {
    flex: none;
    height: ${unsafeCSS((582 * PHONE_WIDTH) / PHONE_SCREEN_PX)}px;
    transform: scale(${unsafeCSS(PHONE_SCREEN_PX / PHONE_WIDTH)});
    transform-origin: 0 0;
    width: ${unsafeCSS(PHONE_WIDTH)}px;
  }

  .inbox-email {
    background: var(--_mq-inbox-paper);
    border: 0;
    display: block;
    flex: 1;
    min-height: 0;
  }

  /* Where the email will be, so it takes the same room when it arrives. */
  .inbox-waiting {
    align-items: center;
    color: var(--_mq-inbox-muted);
    display: flex;
    flex: 1;
    justify-content: center;
    padding: var(--mq-space-4);
    text-align: center;
  }

  .inbox-waiting.failed {
    color: var(--_mq-inbox-danger);
  }

  .check-dock {
    background: var(--mq-color-surface);
    border-inline-start: 1px solid var(--mq-color-border);
    flex: 0 0 ${unsafeCSS(CHECK_PANEL_WIDTH_PX)}px;
    min-width: 0;
  }

  .check-panel {
    max-height: calc(
      min(100dvh, var(--_mq-visible-height, 100dvh)) - var(--_mq-top-bar-height)
    );
    overflow-y: auto;
    position: sticky;
    top: var(--_mq-top-bar-height);
  }

  .check-head {
    border-bottom: 1px solid var(--mq-color-border);
    padding: var(--mq-space-4) var(--mq-space-4) var(--mq-space-3);
  }

  .check-head h2 {
    font: inherit;
    font-size: var(--_mq-font-size-bar-title);
    font-weight: 600;
    margin: 0;
  }

  .check-head p {
    color: var(--mq-color-text-muted);
    margin: 3px 0 0;
  }

  .check-section {
    border-bottom: 1px solid var(--mq-color-border);
    padding: var(--mq-space-4) var(--mq-space-4) var(--mq-space-2);
  }

  .check-section:last-child {
    border-bottom: 0;
  }

  .check-section h3 {
    display: flex;
    font: inherit;
    font-weight: 600;
    justify-content: space-between;
    margin: 0 0 var(--mq-space-2);
  }

  .check-section h3 > span {
    color: var(--mq-color-text-muted);
    font-weight: 500;
  }

  .check-section ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .problem {
    border-top: 1px solid var(--mq-color-border);
    display: grid;
    gap: var(--mq-space-2);
    grid-template-columns: 16px 1fr;
    padding: var(--mq-space-3) 0;
  }

  .problem:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .problem > .icon {
    color: var(--mq-color-warning);
    margin-top: 1px;
  }

  .problem-title {
    font-weight: 600;
    margin: 0;
  }

  .problem-why {
    color: var(--mq-color-text-muted);
    margin: 2px 0 var(--mq-space-2);
  }

  .problem-fix {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: var(--mq-space-2);
  }

  .problem-where {
    color: var(--mq-color-text-muted);
    font-size: var(--mq-font-size-small);
  }

  .passed {
    display: grid;
    gap: var(--mq-space-2);
  }

  .check-section .passed {
    padding-bottom: var(--mq-space-2);
  }

  .passed > li {
    align-items: center;
    color: var(--mq-color-text-muted);
    display: flex;
    gap: var(--mq-space-2);
  }

  .passed .icon {
    color: var(--mq-color-success);
    flex: none;
  }

  .check-ready {
    border-bottom: 1px solid var(--mq-color-border);
    padding: var(--mq-space-5) var(--mq-space-4) var(--mq-space-4);
    text-align: center;
  }

  .check-ready-mark {
    align-items: center;
    background: color-mix(in srgb, var(--mq-color-success) 14%, transparent);
    border-radius: 50%;
    color: var(--mq-color-success);
    display: inline-grid;
    height: 40px;
    justify-items: center;
    width: 40px;
  }

  .check-ready h3 {
    font: inherit;
    font-size: var(--_mq-font-size-panel-title);
    font-weight: 600;
    margin: var(--mq-space-3) 0 var(--mq-space-1);
  }

  .check-ready p {
    color: var(--mq-color-text-muted);
    margin: 0;
  }

  /* The Problem a fix button opened Edit for, under the field to fix. */
  .fix-note {
    background: var(--mq-color-surface);
    border-radius: var(--mq-radius-small);
    box-shadow: var(--mq-shadow);
    inset: 0 auto auto 0;
    margin: 0;
    max-width: 260px;
    padding: var(--mq-space-2) var(--mq-space-3);
    pointer-events: none;
    position: fixed;
    z-index: var(--_mq-layer-tooltip);
  }

  .fix-note b {
    display: block;
    font-weight: 600;
  }

  .fix-note span {
    color: var(--mq-color-text-muted);
  }
`;

/** What's checked, by the Problems that fail it, and what it says once it passes. */
const CHECKS: readonly {
  codes: readonly ProblemCode[];
  passed: StringId;
  /** Only run with what the Host app gives. */
  needs?: "mergeTags" | "unsubscribe";
}[] = [
  { codes: ["image-without-alt"], passed: "passed.imageAlt" },
  { codes: ["button-without-link"], passed: "passed.links" },
  { codes: ["image-without-src"], passed: "passed.imageSrc" },
  { codes: ["empty-preheader"], passed: "passed.preheader" },
  {
    codes: ["unknown-merge-tag"],
    needs: "mergeTags",
    passed: "passed.mergeTags",
  },
  { codes: ["html-too-large"], passed: "passed.size" },
  { codes: ["no-language"], passed: "passed.language" },
  {
    codes: ["low-text-contrast", "low-link-contrast", "low-button-contrast"],
    passed: "passed.contrast",
  },
  { codes: ["vague-link-text"], passed: "passed.linkText" },
  {
    codes: ["no-unsubscribe-link"],
    needs: "unsubscribe",
    passed: "passed.unsubscribe",
  },
];

/** Each Problem's words: what's wrong, why it matters, and its fix button. */
const WORDS: Readonly<
  Record<ProblemCode, { title: StringId; why: StringId; fix?: StringId }>
> = {
  "button-without-link": {
    fix: "problem.buttonLinkFix",
    title: "problem.buttonLink",
    why: "problem.buttonLinkWhy",
  },
  "empty-preheader": {
    fix: "problem.preheaderFix",
    title: "problem.preheader",
    why: "problem.preheaderWhy",
  },
  "html-too-large": { title: "problem.size", why: "problem.sizeWhy" },
  "image-without-alt": {
    fix: "problem.imageAltFix",
    title: "problem.imageAlt",
    why: "problem.imageAltWhy",
  },
  "image-without-src": {
    fix: "problem.imageSrcFix",
    title: "problem.imageSrc",
    why: "problem.imageSrcWhy",
  },
  "low-button-contrast": {
    fix: "problem.contrastFix",
    title: "problem.buttonContrast",
    why: "problem.contrastWhy",
  },
  "low-link-contrast": {
    fix: "problem.contrastFix",
    title: "problem.linkContrast",
    why: "problem.contrastWhy",
  },
  "low-text-contrast": {
    fix: "problem.contrastFix",
    title: "problem.textContrast",
    why: "problem.contrastWhy",
  },
  "no-language": {
    fix: "problem.languageFix",
    title: "problem.language",
    why: "problem.languageWhy",
  },
  "no-unsubscribe-link": {
    fix: "problem.unsubscribeFix",
    title: "problem.unsubscribe",
    why: "problem.unsubscribeWhy",
  },
  "unknown-merge-tag": {
    fix: "problem.mergeTagFix",
    title: "problem.mergeTag",
    why: "problem.mergeTagWhy",
  },
  "vague-link-text": {
    fix: "problem.linkTextFix",
    title: "problem.linkText",
    why: "problem.linkTextWhy",
  },
};

type MergeTags = HostAppProperties["mergeTags"];

/** The email as it's exported, and its Problems. */
interface Checked {
  html: string;
  /** The HTML's size in KB. */
  size: number;
  /** Its first words, as an inbox shows them without a preheader. */
  words: string;
  /** With each Merge Tag's sample, once it's been shown so. */
  sampled?: { html: string; words: string };
  /** The HTML laid out to read, once the HTML tab has shown it. */
  lines?: HtmlPart[][];
  problems: readonly Problem[];
  /** Whether the Host app gave Merge Tags, and marked one to unsubscribe. */
  ran: { mergeTags: boolean; unsubscribe: boolean };
}

/** One run of the check, for the email as it was then. */
interface Run {
  /** The plain text, which needs no MJML, so it's there from the start. */
  text: string;
  /** With each Merge Tag's sample, once it's been shown so. */
  sampledText?: string;
  /** Unset while it renders. */
  result?: Checked | { failure: string };
  /** Set once it's time to say the email is loading. */
  saysLoading?: boolean;
}

/** Bytes in KB, as Gmail counts them. */
const kilobytes = (bytes: number) => Math.round(bytes / 1024);

const MERGE_TAGS = new RegExp(MERGE_TAG.source, "gu");

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * Each Merge Tag in `text` with its `sample`, as one reader would get it. A tag
 * with no sample stays as it's written.
 */
const withSamples = (text: string, tags: MergeTags, inHtml = false) => {
  const samples = new Map(
    (tags ?? []).flatMap(({ name, sample }) =>
      sample === undefined ? [] : [[name, sample] as const]
    )
  );
  return text.replaceAll(MERGE_TAGS, (tag) => {
    const written = tag.slice(2, -2).trim();
    // The export writes a tag's name as any text, so `a&b` is `a&amp;b`.
    const name = inHtml
      ? (new DOMParser().parseFromString(written, "text/html").body
          .textContent ?? written)
      : written;
    const sample = samples.get(name);
    if (sample === undefined) {
      return tag;
    }
    return inHtml ? escapeHtml(sample) : sample;
  });
};

/** The first words a reader sees in the email, as an inbox shows them with no preheader. */
const firstWords = (emailHtml: string, count: number) => {
  const { body } = new DOMParser().parseFromString(emailHtml, "text/html");
  const words = (body.textContent ?? "")
    .replaceAll(/[͏​-‍⁠﻿]/gu, "")
    .split(/\s+/u)
    .filter(Boolean);
  return words.slice(0, count).join(" ");
};

interface CheckHost {
  /** The email as it is now. */
  email: () => BlocksDocument | undefined;
  exportHtml: () => Promise<string>;
  exportText: () => string;
  mergeTags: () => MergeTags;
  /** Whether Check is shown, so a result that arrives after is still heard. */
  isShown: () => boolean;
  requestUpdate: () => void;
  say: (words: string) => void;
  text: Text;
}

const hasSamples = (tags: MergeTags) =>
  tags?.some(({ sample }) => sample !== undefined) ?? false;

/** What a check found, as a sentence, said as it arrives and over the panel. */
const summaryOf = ({ problems, ran }: Checked, text: Text) => {
  if (problems.length === 0) {
    return text("check.allPassed", { count: checksRun(ran).length });
  }
  return problems.length === 1
    ? text("check.toFixOne")
    : text("check.toFixMany", { count: problems.length });
};

const checksRun = (ran: Checked["ran"]) =>
  CHECKS.filter(({ needs }) => needs === undefined || ran[needs]);

/**
 * Check's state: the run for the email as it is now, if any, which a change to
 * the email forgets, and whether sample values are shown, which stays.
 */
export const createCheck = ({
  email,
  exportHtml,
  exportText,
  isShown,
  mergeTags,
  requestUpdate,
  say,
  text,
}: CheckHost) => {
  let current: Run | undefined;
  let showSamples = true;
  let view: CheckViewName = "inbox";
  /** The view whose copy button says it copied, for a moment. */
  let copied: CheckViewName | undefined;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const start = async (document: BlocksDocument) => {
    const run: Run = { text: exportText() };
    current = run;
    setTimeout(() => {
      if (current === run && !run.result) {
        run.saysLoading = true;
        requestUpdate();
      }
    }, LOADING_SAID_AFTER_MS);
    const tags = mergeTags();
    try {
      const exported = await exportHtml();
      const problems = await checkEmail(document, {
        html: exported,
        mergeTags: tags,
      });
      run.result = {
        html: exported,
        problems,
        size: kilobytes(new TextEncoder().encode(exported).length),
        words: firstWords(exported, 16),
        ran: {
          mergeTags: tags !== undefined,
          unsubscribe: tags?.some((tag) => tag.unsubscribe) ?? false,
        },
      };
    } catch (error) {
      console.error("<mail-quilt> couldn't check the email", error);
      run.result = {
        failure: error instanceof Error ? error.message : String(error),
      };
    }
    // The email changed while it rendered, so this run is for an older one.
    if (current !== run) {
      return;
    }
    if (isShown()) {
      say(
        "html" in run.result
          ? summaryOf(run.result, text)
          : text("check.cantCheck")
      );
    }
    requestUpdate();
  };

  return {
    /** The number of Problems the email has, once it's checked as it is now. */
    get count() {
      const result = current?.result;
      return result && "problems" in result
        ? result.problems.length
        : undefined;
    },

    /** Checks the email as it is now, unless it has been checked already. */
    ensure: () => {
      const document = email();
      if (!current && document) {
        void start(document);
      }
    },

    /** The email, or what it's checked with, changed. */
    forget: () => {
      current = undefined;
    },

    /** Leaving Check: a check that failed is tried again on the next visit. */
    leave: () => {
      if (current?.result && "failure" in current.result) {
        current = undefined;
      }
    },

    get run() {
      return current;
    },

    get showSamples() {
      return showSamples;
    },

    get view() {
      return view;
    },

    get copied() {
      return copied;
    },

    selectView: (next: CheckViewName) => {
      if (next !== view) {
        view = next;
        copied = undefined;
        requestUpdate();
      }
    },

    /** Copies what the view shows, and says so on its button and aloud. */
    copy: (shown: CheckViewName, value: string) => {
      if (!copyToClipboard(value)) {
        return;
      }
      copied = shown;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copied = undefined;
        requestUpdate();
      }, COPIED_SHOWN_MS);
      say(text(shown === "html" ? "check.copiedHtml" : "check.copiedText"));
      requestUpdate();
    },

    toggleSamples: (on: boolean) => {
      showSamples = on;
      requestUpdate();
    },
  };
};

export type Check = ReturnType<typeof createCheck>;

/**
 * Puts `value` on the clipboard as text, through the browser's own copy, as
 * More's Copy does: the one way a page fires it with its own data in every
 * browser without asking for a permission, and outside HTTPS too. The editor's
 * own copy has nothing to do on a Check button, so it leaves the event alone.
 * Whether it copied is whether the event came with somewhere to put it, as
 * WebKit's `execCommand` returns false once the event is prevented.
 */
const copyToClipboard = (value: string) => {
  let copied = false;
  const onCopy = (event: ClipboardEvent) => {
    if (event.clipboardData) {
      event.clipboardData.setData("text/plain", value);
      event.preventDefault();
      copied = true;
    }
  };
  window.addEventListener("copy", onCopy, { capture: true });
  try {
    // oxlint-disable-next-line typescript/no-deprecated -- As More's Copy, the one way without a permission.
    document.execCommand("copy");
  } finally {
    window.removeEventListener("copy", onCopy, { capture: true });
  }
  return copied;
};

/**
 * A key pressed in the email is pressed in the inbox, as the key map has it, so
 * Alt+← doesn't go back a page. The email's own document would also let the
 * browser open a dropped file. The editor never hears what happens in it.
 */
const claimKey = (event: KeyboardEvent) => {
  const binding = keyFor("inbox", event);
  if (binding) {
    claim(event, binding);
  }
};

const guardEmail = (event: Event) => {
  const email = (event.currentTarget as HTMLIFrameElement).contentDocument;
  email?.addEventListener("dragover", refuseFiles);
  email?.addEventListener("drop", refuseFiles);
  email?.addEventListener("keydown", claimKey);
};

/**
 * The `sandbox` gives the email no scripts, forms, popups or top-level
 * navigation. Its origin is the host page's, only so the editor can refuse a
 * file dropped on it, and keep Alt+← from going back a page. Never add
 * `allow-scripts` with it: together they let the email remove its own sandbox.
 */
const renderEmailFrame = (emailHtml: string, title: string) => html`
  <iframe
    class="inbox-email"
    data-place=${place("inbox")}
    sandbox="allow-same-origin"
    srcdoc=${emailHtml}
    title=${title}
    @load=${guardEmail}
  ></iframe>
`;

/**
 * The email, or what's in its place until it's there. A failure is said once,
 * from the desktop inbox, which `alerts`.
 */
const renderInboxEmail = (
  run: Run | undefined,
  shown: string | undefined,
  { alerts, title }: { alerts: boolean; title: string },
  text: Text
) => {
  const result = run?.result;
  if (result && "failure" in result) {
    return html`<p
      class="inbox-waiting failed"
      role=${alerts ? "alert" : nothing}
    >
      ${text("check.failed", { reason: result.failure })}
    </p>`;
  }
  if (shown !== undefined) {
    return renderEmailFrame(shown, title);
  }
  return html`<p class="inbox-waiting">
    ${run?.saysLoading ? text("check.loading") : ""}
  </p>`;
};

interface CheckEvents {
  onFix: (problem: Problem, note: FixNote) => void;
  onSamples: (on: boolean) => void;
}

export interface CheckView {
  check: Check;
  email: BlocksDocument;
  events: CheckEvents;
  mergeTags: MergeTags;
  sender: string | undefined;
  subject: string | undefined;
  text: Text;
  /** How much smaller the inbox is drawn, where the Workspace is too narrow. */
  zoom: number;
}

/**
 * The inbox's line for the email: the sender, then the subject and preheader,
 * or the preheader alone, as the Host app gives them. Without a preheader, an
 * inbox shows the email's first words.
 */
const renderInboxHeader = (
  { email, mergeTags, sender, subject, text }: CheckView,
  shownWords: string | undefined,
  samples: boolean
) => {
  const sample = (value: string) =>
    samples ? withSamples(value, mergeTags) : value;
  const preheader = email.settings.preheader?.trim()
    ? sample(email.settings.preheader)
    : shownWords;
  const time = new Intl.DateTimeFormat(text("language"), {
    timeStyle: "short",
  }).format(new Date());
  const from = sender?.trim();
  return html`
    <div class=${from ? "inbox-header" : "inbox-header plain"}>
      ${
        from
          ? html`<span aria-hidden="true" class="inbox-avatar">
              ${[...sample(from)][0]?.toUpperCase()}
            </span>`
          : nothing
      }
      <div class="inbox-lines">
        ${from ? html`<p class="inbox-sender">${sample(from)}</p>` : nothing}
        <p class="inbox-snippet">
          ${
            subject?.trim()
              ? html`<span class="inbox-subject">${sample(subject)}</span>
                  ${preheader ? " — " : ""}`
              : nothing
          }${preheader}
        </p>
      </div>
      <span class="inbox-time">${time}</span>
    </div>
  `;
};

/** Where a Problem is, as its words say it. */
const whereOf = (problem: Problem, email: BlocksDocument, text: Text) => {
  if (problem.blockId !== undefined) {
    const position = locate(email, problem.blockId);
    if (position) {
      const values = {
        column: position.columnIndex + 1,
        row: position.rowIndex + 1,
      };
      return {
        values,
        words:
          position.row.columns.length > 1
            ? text("check.inColumn", values)
            : text("check.inRow", values),
      };
    }
  }
  return { values: {}, words: text("check.inEmail") };
};

/** What fills in a Problem's words. */
const valuesOf = (
  problem: Problem,
  { email, text }: CheckView,
  checked: Checked,
  row: TextValues
): TextValues => {
  const block =
    problem.blockId === undefined
      ? undefined
      : locate(email, problem.blockId)?.block;
  const label = block?.type === "button" ? block.props.label.trim() : undefined;
  const { contrast } = problem;
  return {
    ...row,
    label,
    name: problem.mergeTag,
    tag: problem.mergeTag === undefined ? undefined : `{{${problem.mergeTag}}}`,
    text: problem.linkText,
    size: checked.size,
    words:
      problem.code === "empty-preheader"
        ? checked.words.split(" ").slice(0, 3).join(" ")
        : undefined,
    ...(contrast && {
      background: contrast.background.toUpperCase(),
      color: contrast.color.toUpperCase(),
      // Down, so a ratio just short of what's needed never reads as enough.
      ratio: (Math.floor(contrast.ratio * 10) / 10).toLocaleString(
        text("language")
      ),
      required: contrast.required.toLocaleString(text("language")),
    }),
  };
};

/** A Problem's title and why, for the note beside the field its fix focuses. */
const problemWords = (problem: Problem, view: CheckView, checked: Checked) => {
  const { text, email } = view;
  const words = WORDS[problem.code];
  const where = whereOf(problem, email, text);
  const values = valuesOf(problem, view, checked, where.values);
  return {
    fix: words.fix && text(words.fix),
    title: text(words.title, values),
    where: where.words,
    why: text(words.why, values),
  };
};

const renderProblem = (
  problem: Problem,
  index: number,
  view: CheckView,
  checked: Checked
) => {
  const { fix, title, where, why } = problemWords(problem, view, checked);
  const id = `check-problem-${index}`;
  return html`
    <li class="problem">
      ${ICONS.alert}
      <div>
        <p class="problem-title" id=${id}>${title}</p>
        <p class="problem-why">${why}</p>
        <div class="problem-fix">
          ${
            fix
              ? html`<button
                  aria-describedby=${`${id} ${id}-where`}
                  class="text-button"
                  type="button"
                  @click=${() => view.events.onFix(problem, { title, why })}
                >
                  ${fix}
                </button>`
              : nothing
          }
          <span class="problem-where" id=${`${id}-where`}>${where}</span>
        </div>
      </div>
    </li>
  `;
};

const renderPanel = (view: CheckView) => {
  const { check, text } = view;
  const result = check.run?.result;
  let summary = text("check.checking");
  let body: unknown = nothing;
  if (result && "failure" in result) {
    summary = text("check.cantCheck");
  } else if (result) {
    const { problems } = result;
    summary = summaryOf(result, text);
    const { size } = result;
    const failed = new Set(problems.map(({ code }) => code));
    const passed = checksRun(result.ran).filter(({ codes }) =>
      codes.every((code) => !failed.has(code))
    );
    body = html`
      ${
        problems.length === 0
          ? html`<div class="check-ready">
              <span aria-hidden="true" class="check-ready-mark">
                ${ICONS.check}
              </span>
              <h3>${text("check.ready")}</h3>
              <p>${text("check.readyText")}</p>
            </div>`
          : html`<section class="check-section">
              <h3>${text("check.toFix")}<span>${problems.length}</span></h3>
              <ul>
                ${problems.map((problem, index) =>
                  renderProblem(problem, index, view, result)
                )}
              </ul>
            </section>`
      }
      ${
        passed.length > 0
          ? html`<section class="check-section">
              <h3>${text("check.passed")}<span>${passed.length}</span></h3>
              <ul class="passed">
                ${passed.map(
                  ({ passed: line }) =>
                    html`<li>${ICONS.check}${text(line, { size })}</li>`
                )}
              </ul>
            </section>`
          : nothing
      }
    `;
  }
  return html`
    <div class="check-dock">
      <div
        aria-labelledby="check-title"
        class="check-panel thin-scrollbar"
        data-place=${place("checkPanel")}
        role="region"
      >
        <div class="check-head">
          <h2 id="check-title">${text("check.title")}</h2>
          <p>${summary}</p>
        </div>
        ${body}
      </div>
    </div>
  `;
};

/**
 * The tabs, one Tab stop with arrow keys between them, each chosen as focus
 * reaches it, as the Modes are.
 */
const renderViews = ({ check, text }: CheckView) => html`
  <div
    aria-label=${text("check.views")}
    class="segments check-views"
    data-place=${place("checkViews")}
    role="tablist"
  >
    ${VIEWS.map(
      ({ label, view }) => html`
        <button
          aria-controls=${VIEW_PANEL_ID}
          aria-selected=${view === check.view ? "true" : "false"}
          class="segment"
          id=${viewTabId(view)}
          role="tab"
          tabindex=${view === check.view ? "0" : "-1"}
          type="button"
          @click=${() => check.selectView(view)}
          @focus=${() => check.selectView(view)}
        >
          ${text(label)}
        </button>
      `
    )}
  </div>
`;

const renderSamples = ({ check, events, text }: CheckView) => html`
  <label class="check-samples">
    ${text("check.samples")}
    <input
      role="switch"
      type="checkbox"
      .checked=${live(check.showSamples)}
      @change=${({ currentTarget }: Event) =>
        events.onSamples((currentTarget as HTMLInputElement).checked)}
    />
  </label>
`;

const renderInbox = (
  view: CheckView,
  shown: Checked["sampled"],
  samples: boolean
) => {
  const { check, email, text } = view;
  const { width } = email.settings;
  return html`
    <div
      aria-labelledby=${viewTabId("inbox")}
      class="check-previews"
      id=${VIEW_PANEL_ID}
      role="tabpanel"
    >
      <figure class="check-preview">
        <figcaption>
          ${ICONS.monitor}${text("check.desktop", { width })}
        </figcaption>
        <div class="inbox-slot">
          <div class="inbox">
            ${renderInboxHeader(view, shown?.words, samples)}
            ${renderInboxEmail(
              check.run,
              shown?.html,
              { alerts: true, title: text("check.desktopFrame") },
              text
            )}
          </div>
        </div>
      </figure>
      <figure class="check-preview">
        <figcaption>
          ${ICONS.phone}${text("check.phone", { width: PHONE_WIDTH })}
        </figcaption>
        <div class="phone-slot">
          <div class="phone-frame">
            <div class="phone-screen">
              <span aria-hidden="true" class="phone-bar">
                <span class="phone-back">
                  ${ICONS.chevronLeft}${text("check.inbox")}
                </span>
              </span>
              ${renderInboxEmail(
                check.run,
                shown?.html,
                { alerts: false, title: text("check.phoneFrame") },
                text
              )}
            </div>
          </div>
        </div>
      </figure>
    </div>
  `;
};

/**
 * The plain text or the HTML, read-only, under a line that says what it is and
 * a button that copies it. The text or code scrolls in its own box, which takes
 * focus so the keyboard scrolls it too.
 */
const renderCode = (
  { check, text }: CheckView,
  shown: Exclude<CheckViewName, "inbox">,
  {
    body,
    copy,
    note,
  }: { body: unknown; copy: string | undefined; note: string }
) => {
  const copied = check.copied === shown;
  return html`
    <div class=${`check-code ${shown}`}>
      <div class="check-code-head">
        <p>${note}</p>
        ${
          copy === undefined
            ? nothing
            : html`<button
                class=${copied ? "text-button copied" : "text-button"}
                type="button"
                @click=${() => check.copy(shown, copy)}
              >
                ${copied ? ICONS.check : ICONS.duplicate}${
                  copied
                    ? text("check.copied")
                    : text(
                        shown === "html" ? "check.copyHtml" : "check.copyText"
                      )
                }
              </button>`
        }
      </div>
      <div
        aria-labelledby=${viewTabId(shown)}
        class="check-code-body thin-scrollbar"
        id=${VIEW_PANEL_ID}
        role="tabpanel"
        tabindex="0"
      >
        ${body}
      </div>
    </div>
  `;
};

/** The export's lines, numbered, with their tag names and values colored. */
const renderHtmlLines = (lines: HtmlPart[][]) =>
  html`<pre aria-hidden="true" class="code-gutter">
${lines.map((_, index) => index + 1).join("\n")}</pre>
    <pre class="code-lines"><code>${lines.map(
      (parts, index) =>
        html`${index === 0 ? "" : "\n"}${parts.map(({ kind, text }) =>
          kind === "text"
            ? text
            : html`<span class=${`code-${kind}`}>${text}</span>`
        )}`
    )}</code></pre>`;

/** The plain text, or the HTML once it's rendered, with what's in its place until then. */
const renderShownCode = (
  view: CheckView,
  checked: Checked | undefined,
  plainText: string | undefined
) => {
  const { check, text } = view;
  if (check.view === "text") {
    return renderCode(view, "text", {
      body: html`<pre class="code-text">${plainText}</pre>`,
      copy: plainText,
      note: text("check.textNote"),
    });
  }
  if (checked) {
    return renderCode(view, "html", {
      body: guard([checked], () =>
        renderHtmlLines((checked.lines ??= htmlLines(checked.html)))
      ),
      copy: checked.html,
      note: text("check.htmlNote", { size: checked.size }),
    });
  }
  return html`<div
    aria-labelledby=${viewTabId("html")}
    class="check-code html"
    id=${VIEW_PANEL_ID}
    role="tabpanel"
  >
    ${renderInboxEmail(
      check.run,
      undefined,
      // Said once already, as the check ended.
      { alerts: false, title: "" },
      text
    )}
  </div>`;
};

/** Check: the email in its tabs, the sample values switch, and the Problems. */
export const renderCheck = (view: CheckView) => {
  const { check, email, mergeTags, zoom } = view;
  const samples = check.showSamples && hasSamples(mergeTags);
  const { run } = check;
  const result = run?.result;
  const checked = result && "html" in result ? result : undefined;
  if (checked && samples) {
    // Once a check, as the sample values can't change without a new one.
    checked.sampled ??= (() => {
      const sampled = withSamples(checked.html, mergeTags, true);
      return { html: sampled, words: firstWords(sampled, 16) };
    })();
  }
  if (run && samples) {
    run.sampledText ??= withSamples(run.text, mergeTags);
  }
  const shown = samples ? checked?.sampled : checked;
  const { width } = email.settings;
  const body =
    check.view === "inbox"
      ? renderInbox(view, shown, samples)
      : renderShownCode(view, checked, samples ? run?.sampledText : run?.text);
  return html`
    <div
      class="check"
      style=${styleProperties({
        "--_mq-inbox-width": `${width + 2 * INBOX_MARGIN_PX}px`,
        "--_mq-inbox-zoom": String(zoom),
      })}
    >
      <div class="check-stage">
        <div class="check-bar">
          ${renderViews(view)}
          ${hasSamples(mergeTags) && check.view !== "html" ? renderSamples(view) : nothing}
        </div>
        ${body}
      </div>
      ${renderPanel(view)}
    </div>
  `;
};

/** What a fix button opened Edit for, shown under the field it focused. */
export interface FixNote {
  title: string;
  why: string;
}

/**
 * The note under the field a fix button focused. It's placed once focus is
 * there, follows the field as the page scrolls, and goes as focus leaves the
 * field or a press lands anywhere.
 */
export const createFixNote = ({
  root,
  requestUpdate,
}: {
  root: () => ShadowRoot | null;
  requestUpdate: () => void;
}) => {
  let note: FixNote | undefined;
  let stop: (() => void) | undefined;

  const shownNote = () =>
    root()?.querySelector<HTMLElement>(`[data-place="${place("fixNote")}"]`);

  const close = () => {
    if (!note) {
      return;
    }
    note = undefined;
    stop?.();
    stop = undefined;
    requestUpdate();
  };

  /** Under `anchor`, where it is now. */
  const moveUnder = (anchor: Element) => {
    const shown = shownNote();
    if (!shown) {
      return;
    }
    const box = anchor.getBoundingClientRect();
    shown.hidden = false;
    shown.style.translate = `${Math.round(box.left)}px ${Math.round(box.bottom + 6)}px`;
  };

  return {
    close,

    /** Shows `next` under the field focus goes to in the next update. */
    open(next: FixNote) {
      close();
      note = next;
      requestUpdate();
    },

    render: () =>
      note
        ? html`<p class="ui fix-note" data-place=${place("fixNote")} hidden>
            <b>${note.title}</b><span>${note.why}</span>
          </p>`
        : nothing,

    /** After an update: under the focused field, once focus has reached it. */
    sync() {
      const element = note && !stop ? root()?.activeElement : undefined;
      if (!(element instanceof HTMLElement)) {
        return;
      }
      const anchor = element.closest("label") ?? element;
      moveUnder(anchor);
      const view = element.ownerDocument.defaultView ?? window;
      // A scroll isn't composed, so one in a Shell's shadow root never
      // reaches the window.
      const shadow = element.getRootNode();
      const scrolled: EventTarget[] = [
        view,
        ...(shadow instanceof ShadowRoot ? shadowRootsUpFrom(shadow) : []),
      ];
      const onScroll = () => moveUnder(anchor);
      element.addEventListener("focusout", close, { once: true });
      for (const target of scrolled) {
        target.addEventListener("scroll", onScroll, { capture: true });
      }
      view.addEventListener("pointerdown", close, {
        capture: true,
        once: true,
      });
      stop = () => {
        element.removeEventListener("focusout", close);
        for (const target of scrolled) {
          target.removeEventListener("scroll", onScroll, { capture: true });
        }
        view.removeEventListener("pointerdown", close, { capture: true });
      };
    },
  };
};
