import type { ApplyResult, BlocksDocument } from "@mailquilt/core";
import { MERGE_TAG } from "@mailquilt/core/internal";
import type { BlockProps } from "@mailquilt/core/internal";

import type { Announcements } from "./announcements.js";
import type { HostAppProperties } from "./host-app.js";
import { blocksIn, locate } from "./positions.js";
import type { StringId } from "./strings.js";
import type { Text } from "./text.js";

// What the editor does for a Video Block beyond its settings: a YouTube link
// fills in the thumbnail, and "On the picture" draws a play button onto a copy
// of the thumbnail and uploads it through the Host app's `uploadImage`, as
// #327 decided. The Block keeps the original thumbnail beside the copy.

type VideoProps = BlockProps["video"];

/** The sites a YouTube video's own link can be on. */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);

/** A video's ID: 11 letters, digits, `-` or `_`. */
const VIDEO_ID = /^[\w-]{11}$/u;

/**
 * The ID of the YouTube video a link is to, from a watch link, a short
 * `youtu.be` link, a Short, a live or an embed link, or nothing for any other
 * link.
 */
export const youTubeId = (link: string) => {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return;
  }
  const [first, second] = url.pathname.split("/").filter(Boolean);
  let id: string | null | undefined;
  if (url.hostname === "youtu.be") {
    id = first;
  } else if (first === "watch") {
    id = url.searchParams.get("v");
  } else if (first === "shorts" || first === "embed" || first === "live") {
    id = second;
  }
  return id && VIDEO_ID.test(id) ? id : undefined;
};

/**
 * A video's thumbnail at YouTube's fixed addresses: the large 16:9 one, which
 * some videos don't have, and the one every video has, which is 4:3 with black
 * bars. For a video without the large one, YouTube sends a 120px placeholder.
 */
const youTubeThumbnails = (id: string) => ({
  always: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  large: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
});

/** YouTube's placeholder for a thumbnail a video doesn't have is this wide. */
const PLACEHOLDER_WIDTH = 120;

/** The large thumbnail if the video has one, or else the one every video has. */
const youTubeThumbnail = async (id: string) => {
  const { always, large } = youTubeThumbnails(id);
  const image = new Image();
  image.src = large;
  try {
    await image.decode();
  } catch {
    return always;
  }
  return image.naturalWidth > PLACEHOLDER_WIDTH ? large : always;
};

/**
 * A change to a Video's props, with a new thumbnail forgetting the copy drawn
 * on the old one. While the play button was on the picture, the line shows
 * until one is drawn on the new thumbnail, so the email never shows a video
 * with no sign it's one.
 */
export const thumbnailChanges = (
  props: VideoProps,
  changes: Record<string, unknown>
): Record<string, unknown> => {
  if (!("thumbnail" in changes) || changes.thumbnail === props.thumbnail) {
    return changes;
  }
  return {
    ...changes,
    ...(props.play === "on" ? { play: "below" } : {}),
    playThumbnail: null,
  };
};

/** The share of a picture's shorter side the play button's circle spans. */
const PLAY_SIZE = 0.24;

/**
 * A copy of a picture with a play button in its middle: a dark, see-through
 * circle with a white ring and a white triangle, which reads on light and
 * dark pictures alike. A JPEG stays one, and anything else becomes a PNG.
 */
const drawPlayButton = async (picture: Blob) => {
  const bitmap = await createImageBitmap(picture);
  const { height, width } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No 2D canvas");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const radius = (Math.min(width, height) * PLAY_SIZE) / 2;
  const x = width / 2;
  const y = height / 2;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = "rgb(0 0 0 / 55%)";
  context.fill();
  context.lineWidth = Math.max(radius * 0.08, 1);
  context.strokeStyle = "#ffffff";
  context.stroke();
  // A triangle whose middle is the circle's, so it looks centred.
  context.beginPath();
  context.moveTo(x - radius * 0.3, y - radius * 0.45);
  context.lineTo(x - radius * 0.3, y + radius * 0.45);
  context.lineTo(x + radius * 0.48, y);
  context.closePath();
  context.fillStyle = "#ffffff";
  context.fill();
  const type = picture.type === "image/jpeg" ? "image/jpeg" : "image/png";
  const blob = await canvas.convertToBlob({ quality: 0.9, type });
  return new File([blob], type === "image/jpeg" ? "video.jpg" : "video.png", {
    type,
  });
};

/** Why a play button couldn't be added: one of the editor's texts, or the host's. */
type Why = { id: StringId; site?: string } | { message: string };

/** The site a picture is on, without `www.`, or nothing for a Merge Tag. */
const siteOf = (src: string): string | undefined => {
  let url: URL | undefined;
  try {
    url = new URL(src);
  } catch {
    url = undefined;
  }
  return url?.hostname.replace(/^www\./u, "");
};

/**
 * The thumbnail with a play button drawn on it, read with CORS, or why it
 * couldn't be: its site doesn't allow it, or it isn't a picture the editor
 * can read, such as a Merge Tag, which is never fetched.
 */
const drawnCopy = async (
  thumbnail: string,
  signal: AbortSignal
): Promise<File | Why> => {
  const site = siteOf(thumbnail);
  const cantRead: Why = { id: "play.cantDrawThis" };
  if (!site || MERGE_TAG.test(thumbnail)) {
    return cantRead;
  }
  let response: Response;
  try {
    response = await fetch(thumbnail, {
      credentials: "omit",
      mode: "cors",
      signal,
    });
  } catch {
    // A site that doesn't allow CORS fails as a network error does.
    return { id: "play.cantDraw", site };
  }
  try {
    if (!response.ok) {
      return cantRead;
    }
    return await drawPlayButton(await response.blob());
  } catch {
    return cantRead;
  }
};

/**
 * How long "On the picture" waits before drawing, so the arrow keys going
 * past it, which choose each radio they reach, upload nothing.
 */
const DRAW_AFTER_MS = 600;

interface VideosHost {
  /** The email as it is now. */
  email: () => BlocksDocument | undefined;
  /** Changes a Video's props, which their checks can refuse. */
  apply: (
    blockId: string,
    props: Record<string, unknown>
  ) => ApplyResult | undefined;
  uploadImage: () => HostAppProperties["uploadImage"];
  announcements: Pick<Announcements, "say">;
  requestUpdate: () => void;
  text: Text;
}

export type Videos = ReturnType<typeof createVideos>;

export const createVideos = ({
  announcements,
  apply,
  email: current,
  requestUpdate,
  text,
  uploadImage: hostUploadImage,
}: VideosHost) => {
  /** The Videos whose person chose "On the picture", until it's drawn. */
  const wanted = new Set<string>();
  /** Each drawing that's running, by its Block, with the thumbnail it's of. */
  const running = new Map<
    string,
    { thumbnail: string; controller: AbortController }
  >();
  /** Why a Block's last drawing failed, and the thumbnail it was of. */
  const failures = new Map<string, { thumbnail: string; why: Why }>();
  /** Each choice of "On the picture" that's waiting to draw, by its Block. */
  const waiting = new Map<string, ReturnType<typeof setTimeout>>();

  const stopWaiting = (blockId: string) => {
    clearTimeout(waiting.get(blockId));
    waiting.delete(blockId);
  };

  const propsOf = (blockId: string) => {
    const email = current();
    const block = email && locate(email, blockId)?.block;
    return block?.type === "video" ? block.props : undefined;
  };

  const abort = (blockId: string) => {
    running.get(blockId)?.controller.abort();
    running.delete(blockId);
  };

  const messageOf = (why: Why) =>
    "message" in why
      ? why.message
      : text(why.id, why.site ? { site: why.site } : undefined);

  /**
   * Draws the play button on the Video's thumbnail and uploads the copy, which
   * the Video then shows with the play button on. It reads the thumbnail with
   * CORS, so a site that doesn't allow that is a failure, as is an upload's.
   */
  const draw = async (blockId: string, thumbnail: string) => {
    const uploadImage = hostUploadImage();
    if (!uploadImage) {
      return;
    }
    abort(blockId);
    failures.delete(blockId);
    const controller = new AbortController();
    const { signal } = controller;
    running.set(blockId, { controller, thumbnail });
    requestUpdate();
    announcements.say(text("video.addingPlay"));
    const isCurrent = () => running.get(blockId)?.controller === controller;
    const copy = await drawnCopy(thumbnail, signal);
    let why: Why = { id: "upload.failed" };
    let url: unknown;
    if (copy instanceof File) {
      try {
        // A JavaScript Host app can resolve with anything.
        const result: { url?: unknown } | undefined = await uploadImage(copy, {
          signal,
        });
        url = result?.url;
      } catch (error) {
        if (error instanceof Error && error.message) {
          why = { message: error.message };
        }
      }
    } else {
      why = copy;
    }
    // Aborted, or replaced by another drawing.
    if (!isCurrent()) {
      return;
    }
    running.delete(blockId);
    const result =
      typeof url === "string" && propsOf(blockId)?.thumbnail === thumbnail
        ? apply(blockId, { play: "on", playThumbnail: url })
        : undefined;
    // Either way it's no longer wanted: a failure is shown, and only its
    // Upload a thumbnail asks again.
    wanted.delete(blockId);
    if (result?.ok || result?.code === "unchanged") {
      announcements.say(text("play.added"));
    } else {
      failures.set(blockId, { thumbnail, why });
      announcements.say(`${text("play.failed")}. ${messageOf(why)}`);
    }
    requestUpdate();
  };

  /** Draws the play button on a wanted Video's thumbnail, unless it's drawing or failed on it. */
  const drawIfWanted = (blockId: string) => {
    const props = propsOf(blockId);
    if (!props) {
      wanted.delete(blockId);
      abort(blockId);
      return;
    }
    const { play, playThumbnail, thumbnail } = props;
    if (play === "on" && playThumbnail !== undefined) {
      wanted.delete(blockId);
      return;
    }
    const drawing = running.get(blockId);
    if (drawing && drawing.thumbnail !== thumbnail) {
      abort(blockId);
    }
    if (
      thumbnail === undefined ||
      running.has(blockId) ||
      failures.get(blockId)?.thumbnail === thumbnail
    ) {
      return;
    }
    draw(blockId, thumbnail);
  };

  return {
    /**
     * The person's choice of play button. "On the picture" draws it, unless
     * the Video has a copy drawn on this thumbnail already, and the Video
     * changes once the copy is uploaded. The others change it now, and stop
     * a drawing that's running.
     */
    choosePlay: (blockId: string, play: "below" | "none" | "on") => {
      const props = propsOf(blockId);
      if (!props) {
        return;
      }
      failures.delete(blockId);
      stopWaiting(blockId);
      if (play !== "on") {
        wanted.delete(blockId);
        abort(blockId);
        apply(blockId, { play });
        requestUpdate();
        return;
      }
      if (props.playThumbnail === undefined) {
        wanted.add(blockId);
        waiting.set(
          blockId,
          setTimeout(() => {
            waiting.delete(blockId);
            drawIfWanted(blockId);
          }, DRAW_AFTER_MS)
        );
        requestUpdate();
      } else {
        apply(blockId, { play });
      }
    },

    /**
     * A change from the bar to a Video's props, as its Command takes them: a
     * new thumbnail forgets the copy drawn on the old one, and a play button
     * wanted on the picture is drawn on the new one.
     */
    changes: (blockId: string, changes: Record<string, unknown>) => {
      const props = propsOf(blockId);
      if (!props) {
        return changes;
      }
      const made = thumbnailChanges(props, changes);
      if (made.play === "below") {
        wanted.add(blockId);
      }
      return made;
    },

    /** Aborts every drawing, and forgets every choice and failure, for a new email. */
    clear: () => {
      for (const blockId of running.keys()) {
        abort(blockId);
      }
      for (const blockId of waiting.keys()) {
        stopWaiting(blockId);
      }
      wanted.clear();
      failures.clear();
    },

    /**
     * Why the play button couldn't be added to the Video's thumbnail, until
     * there's another thumbnail or the person chooses again.
     */
    failureOf: (blockId: string) => {
      const failure = failures.get(blockId);
      return failure && failure.thumbnail === propsOf(blockId)?.thumbnail
        ? messageOf(failure.why)
        : undefined;
    },

    /**
     * Fills in the thumbnail of a Video given a YouTube link, with the large
     * thumbnail if the video has one, unless the link or the thumbnail has
     * changed by the time it's found.
     */
    fillThumbnail: async (blockId: string, link: string) => {
      const id = youTubeId(link);
      if (!id || propsOf(blockId)?.thumbnail !== undefined) {
        return;
      }
      const thumbnail = await youTubeThumbnail(id);
      const props = propsOf(blockId);
      if (props?.url === link && props.thumbnail === undefined) {
        apply(blockId, { thumbnail });
      }
    },

    /**
     * Whether a play button is being drawn on the Video's thumbnail and
     * uploaded, or is about to be.
     */
    isAdding: (blockId: string) => running.has(blockId) || waiting.has(blockId),

    /**
     * After each change: draws the play button on a wanted Video's new
     * thumbnail, and stops a drawing whose Video or thumbnail is gone.
     */
    onChange: () => {
      if (wanted.size === 0 && running.size === 0) {
        return;
      }
      const email = current();
      const blockIds = new Set(
        email ? blocksIn(email).map(({ id }) => id) : []
      );
      for (const blockId of new Set([...wanted, ...running.keys()])) {
        if (!blockIds.has(blockId)) {
          wanted.delete(blockId);
          stopWaiting(blockId);
          abort(blockId);
        } else if (!waiting.has(blockId)) {
          drawIfWanted(blockId);
        }
      }
    },

    /**
     * Asks again for the play button on the picture, for the thumbnail about
     * to be uploaded from the failure's Upload a thumbnail.
     */
    wantPlay: (blockId: string) => {
      wanted.add(blockId);
    },
  };
};
