import type { ApplyResult, BlocksDocument } from "@mailquilt/core";

import type { Announcements } from "./announcements.js";
import type { FileDropTarget } from "./dragging.js";
import type { HostAppProperties } from "./host-app.js";
import { blocksIn, locate } from "./positions.js";
import type { DropPosition } from "./positions.js";
import { UI_LANG } from "./theme.js";

/**
 * Uploads through the Host app's `uploadImage`, each for one Image Block, from
 * the Image settings or a drop, and why a Block's last one failed. A Block
 * shows "Uploading…" while its upload runs, and takes the URL in one Command
 * when it's done. An upload is aborted only when its Block is gone, so an abort
 * never leaves an empty Block.
 */

/** The types every email client shows, which the file picker offers. */
export const UPLOADABLE_TYPES = ["image/png", "image/jpeg", "image/gif"];

const WRONG_TYPE = "Use a PNG, JPEG or GIF image.";
const FAILED = "The image couldn't be uploaded.";

interface UploadsHost {
  /** Adds empty Image Blocks where a drop landed, and returns their IDs. */
  addImageBlocks: (count: number, position: DropPosition) => string[];
  /** Selects a Block that's taken a dropped file. */
  select: (blockId: string) => void;
  uploadImage: () => HostAppProperties["uploadImage"];
  /** Sets an Image Block's URL, which the Image URL's check can refuse. */
  setImage: (blockId: string, url: string) => ApplyResult | undefined;
  /** The email as it is now. */
  email: () => BlocksDocument | undefined;
  announcements: Pick<Announcements, "say">;
}

export type ImageUploads = ReturnType<typeof createImageUploads>;

const isUploadable = (file: File) => UPLOADABLE_TYPES.includes(file.type);

export const createImageUploads = ({
  addImageBlocks,
  announcements,
  email: current,
  select,
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

  /** Says why, with the file's name for a Block the drop has just added. */
  const fail = (blockId: string, message: string, fileName?: string) => {
    failures.set(blockId, { message, src: srcOf(blockId) });
    announcements.say(fileName ? `${fileName}: ${message}` : message);
  };

  const abort = (blockId: string) => {
    running.get(blockId)?.abort();
    running.delete(blockId);
  };

  /**
   * Uploads a file as the Image Block's image, in place of any upload it
   * already has running. A file of another type is refused first, and leaves a
   * running upload as it is. With `named`, a failure is announced with the
   * file's name, as there may be several.
   */
  const upload = async (blockId: string, file: File, named = false) => {
    const uploadImage = hostUploadImage();
    if (!uploadImage) {
      return;
    }
    const fileName = named ? file.name : undefined;
    if (!isUploadable(file)) {
      fail(blockId, WRONG_TYPE, fileName);
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
    const result = typeof url === "string" ? setImage(blockId, url) : undefined;
    if (result?.ok || result?.code === "unchanged") {
      announcements.say("Image uploaded.");
    } else {
      fail(blockId, message, fileName);
    }
  };

  return {
    /** Aborts every upload, and forgets every failure, for a new email. */
    clear: () => {
      for (const blockId of running.keys()) {
        abort(blockId);
      }
      failures.clear();
    },

    /**
     * Files dropped on an Image Block, which takes the first image, or where
     * they land on the canvas. Each other image adds an Image Block there, in order,
     * which uploads on its own. A file of another type adds none, and is
     * refused by its name. The last Block to take a file is selected.
     */
    drop: (files: File[], target: FileDropTarget) => {
      const email = current();
      let rest = files;
      let position: DropPosition;
      let selected: string | undefined;
      if ("blockId" in target) {
        const at = email && locate(email, target.blockId);
        // With no image, the Block says why the first file is refused.
        const first = files.find(isUploadable) ?? files[0];
        if (!(at && first)) {
          return;
        }
        upload(target.blockId, first);
        selected = target.blockId;
        rest = files.filter((file) => file !== first);
        position = { columnId: at.columnId, index: at.index + 1 };
      } else {
        position = target;
      }
      const images = rest.filter(isUploadable);
      const blockIds = addImageBlocks(images.length, position);
      for (const [index, blockId] of blockIds.entries()) {
        upload(blockId, images[index] as File, true);
      }
      selected = blockIds.at(-1) ?? selected;
      if (selected !== undefined) {
        select(selected);
      }
      const refused = rest.filter((file) => !isUploadable(file));
      if (refused.length > 0) {
        const names = new Intl.ListFormat(UI_LANG).format(
          refused.map(({ name }) => name)
        );
        announcements.say(`${names}: ${WRONG_TYPE}`);
      }
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

    upload,
  };
};
