/**
 * What the Host app gives the editor, which it can't do itself, such as storing
 * images. Each is a property of `<mail-quilt>`, which `<mail-quilt-shell>` and
 * the React components pass on.
 */
export interface HostAppProperties {
  /**
   * Uploads an image to the Host app's own storage and returns its URL, which
   * the Image Block takes. Rejecting with an `Error` shows its message to the
   * person. The upload is aborted through `signal` when its Image Block is
   * gone. Without it, there's no upload.
   */
  uploadImage?:
    | ((
        file: File,
        options: { signal: AbortSignal }
      ) => Promise<{ url: string }>)
    | undefined;
}

/**
 * Each of them, so the Shell passes on every one. A property the interface adds
 * and this leaves out is a type error.
 */
export const HOST_APP_PROPERTIES = Object.keys({
  uploadImage: true,
} satisfies {
  [Name in keyof HostAppProperties]-?: true;
}) as readonly (keyof HostAppProperties)[];
