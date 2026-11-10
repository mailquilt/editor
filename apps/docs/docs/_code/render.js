import { renderEmail } from "@mailquilt/renderer";

/** `email` is the JSON your app saved from the editor's `mq-change` event. */
export const htmlFor = async (email) => {
  try {
    return await renderEmail(email);
  } catch (error) {
    // The email isn't one the renderer accepts. The message says why.
    throw new Error(`This email can't be sent: ${error.message}`, {
      cause: error,
    });
  }
};
