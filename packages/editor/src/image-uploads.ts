import type { ApplyResult, BlocksDocument } from "@mailquilt/core";

import type { Announcements } from "./announcements.js";
import type { HostAppProperties } from "./host-app.js";
import { blocksIn, locate } from "./positions.js";

/**
 * Uploads through the Host app's `uploadImage`, each for one Image Block, and
 * why a Block's last one failed. A Block shows "Uploading…" while its upload
 * runs, and takes the URL in one Command when it's done. An upload is aborted
 * only when its Block is gone, so an abort never leaves an empty Block.
 */

/** The types every email client shows, which the file picker offers. */
export const UPLOADABLE_TYPES = ["image/png", "image/jpeg", "image/gif"];

const WRONG_TYPE = "Use a PNG, JPEG or GIF image.";
const FAILED = "The image couldn't be uploaded.";

interface UploadsHost {
  uploadImage: () => HostAppProperties["uploadImage"];
  /** Sets an Image Block's URL, which the Image URL's check can refuse. */
  setImage: (blockId: string, url: string) => ApplyResult | undefined;
  /** The email as it is now. */
  email: () => BlocksDocument | undefined;
  announcements: Pick<Announcements, "say">;
}

export type ImageUploads = ReturnType<typeof createImageUploads>;

export const createImageUploads = ({
  announcements,
  email: current,
  setImage,
  uploadImage: hostUploadImage,
}: UploadsHost) => {
  /** Each upload that's running, by its Block. */
  const running = new Map<string, AbortController>();
  /** Why a Block's last upload failed, and its URL then, while that stays. */
  const failures = new Map<string, { message: string; src: unknown }>();

  /** The Image Block's URL, if it has one. */
  const srcOf = (blockId: string) => {
    const email = current();
    const block = email && locate(email, blockId)?.block;
    return block?.type === "image" ? block.props.src : undefined;
  };

  const fail = (blockId: string, message: string) => {
    failures.set(blockId, { message, src: srcOf(blockId) });
    announcements.say(message);
  };

  const abort = (blockId: string) => {
    running.get(blockId)?.abort();
    running.delete(blockId);
  };

  return {
    /** Aborts every upload, and forgets every failure, for a new email. */
    clear: () => {
      for (const blockId of running.keys()) {
        abort(blockId);
      }
      failures.clear();
    },

    /** Why the Block's last upload failed, until its next one or a new URL. */
    errorOf: (blockId: string) => {
      const failure = failures.get(blockId);
      return failure && failure.src === srcOf(blockId)
        ? failure.message
        : undefined;
    },

    isUploading: (blockId: string) => running.has(blockId),

    /** After each change, aborts the uploads whose Blocks are gone. */
    onChange: () => {
      // It runs after every change, and the email is copied to look.
      if (running.size === 0) {
        return;
      }
      const email = current();
      const blockIds = new Set(
        email ? blocksIn(email).map(({ id }) => id) : []
      );
      for (const blockId of running.keys()) {
        if (!blockIds.has(blockId)) {
          abort(blockId);
        }
      }
    },

    /**
     * Uploads a file as the Image Block's image, in place of any upload it
     * already has running. A file of another type is refused first, and
     * leaves a running upload as it is.
     */
    upload: async (blockId: string, file: File) => {
      const uploadImage = hostUploadImage();
      if (!uploadImage) {
        return;
      }
      if (!UPLOADABLE_TYPES.includes(file.type)) {
        fail(blockId, WRONG_TYPE);
        return;
      }
      abort(blockId);
      failures.delete(blockId);
      const controller = new AbortController();
      running.set(blockId, controller);
      // The canvas shows it too, where a screen reader isn't.
      announcements.say("Uploading image.");
      let url: unknown;
      let message = FAILED;
      try {
        // A JavaScript Host app can resolve with anything.
        const result: { url?: unknown } | undefined = await uploadImage(file, {
          signal: controller.signal,
        });
        url = result?.url;
      } catch (error) {
        if (error instanceof Error && error.message) {
          ({ message } = error);
        }
      }
      // Aborted, or replaced by another upload.
      if (running.get(blockId) !== controller) {
        return;
      }
      running.delete(blockId);
      const result =
        typeof url === "string" ? setImage(blockId, url) : undefined;
      if (result?.ok || result?.code === "unchanged") {
        announcements.say("Image uploaded.");
      } else {
        fail(blockId, message);
      }
    },
  };
};
