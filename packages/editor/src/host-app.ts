import type { SavedRow } from "./saved-rows.js";
import type { StarterEmail } from "./starter-emails.js";
import type { MailQuiltStrings } from "./strings.js";
import type { HostFont } from "./web-fonts.js";

/**
 * What the Host app gives the editor, which it can't do itself, such as storing
 * images. Each is a property of `<mail-quilt>`, which `<mail-quilt-shell>` and
 * the React components pass on.
 */
export interface HostAppProperties {
  /**
   * The Host app's web fonts, which Style's font lists offer as "Your fonts",
   * above the system fonts. `name` is the font's family name, as its
   * stylesheet declares it. `url` is that stylesheet, such as Google Fonts',
   * and must be `https:`. `fallback` is the fonts a reader sees in an email
   * client that doesn't load web fonts, such as `Georgia, serif`. A font
   * picked is stored in the email with its URL, so it exports the same
   * anywhere, and the export loads only the fonts the email uses. A font whose
   * name, URL or fallback the editor can't use, or whose name an earlier one
   * has, is left out, and said on the console. Without the list, the lists
   * hold only system fonts.
   */
  fonts?: readonly HostFont[] | undefined;
  /**
   * The Host app's Merge Tags, which typing `{{` in text, or the format bar's
   * Merge Tag button, offers to pick from. `name` is what goes between the
   * braces, and `label`, if given, is what the picker and the Canvas show.
   * `sample` is what Check shows in its place with "Show sample values" on.
   * `unsubscribe` marks the tag that's the unsubscribe link, which Check then
   * looks for. Without the list, there's no picker, a typed tag still becomes
   * one unit, and Check doesn't look at Merge Tags.
   */
  mergeTags?:
    | readonly {
        name: string;
        label?: string;
        sample?: string;
        unsubscribe?: boolean;
      }[]
    | undefined;
  /**
   * Who the email is from, as Check's inbox shows it, such as the Host app's
   * name for the sender. Without it, the inbox shows no sender.
   */
  sender?: string | undefined;
  /**
   * Sends a test of the email through the Host app's own sending service, to
   * whoever it chooses, with Check's "Send a test" button. It's given the
   * email as `exportHtml()` and `exportText()` give it, and `subject`. Check
   * says it's sent once it resolves. Rejecting with an `Error` shows its
   * message to the person. Without it, there's no button.
   */
  sendTest?:
    | ((email: {
        html: string;
        text: string;
        subject: string | undefined;
      }) => Promise<unknown>)
    | undefined;
  /**
   * Ready-made Rows, such as the Host app's footer, which adding a Row offers
   * beside the empty layouts. `name` is what it's called there. `row` is a Row
   * as an email's `rows` holds one, and `version` the email's `version`. Each
   * is checked as a paste is, and added as a copy, with new IDs, in one undo
   * step. A Saved Row the editor can't take, or with no name, is left out, and
   * said on the console.
   */
  savedRows?: readonly SavedRow[] | undefined;
  /**
   * The URL of a folder of the Host app's own holding the Social Block's
   * icons, copied from `@mailquilt/renderer`'s `icons`. The Canvas, the Preview
   * and `exportHtml()` load them from there. Without it, they load from
   * jsDelivr, at the renderer's exact version.
   */
  socialIconsUrl?: string | undefined;
  /**
   * Ready-made emails to begin from, which a start screen offers, after
   * "Blank", while the email has no Rows and the person hasn't started it.
   * `name` and `description` are what its card says. `email` is checked as
   * `value` is, and picking it makes the email a copy of it, with new IDs, in
   * one undo step. A Starter email the editor can't open, with no name, or
   * with a description that isn't text, is left out, and said on the console. Without the list, or once the email has
   * anything in it, there's no start screen.
   */
  starterEmails?: readonly StarterEmail[] | undefined;
  /**
   * The email's subject, as Check's inbox shows it before the preheader.
   * Without it, the inbox shows the preheader alone.
   */
  subject?: string | undefined;
  /**
   * Texts that replace the editor's English, by ID, as `STRINGS` lists them,
   * with their placeholders such as `{row}`. Any left out keep their English.
   * `language` is the language they're in, a language tag such as `fr` or
   * `pt-BR`. One that isn't is left out, so it stays `en`, and said on the
   * console.
   */
  strings?: MailQuiltStrings | undefined;
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
  fonts: true,
  mergeTags: true,
  savedRows: true,
  sender: true,
  sendTest: true,
  socialIconsUrl: true,
  starterEmails: true,
  strings: true,
  subject: true,
  uploadImage: true,
} satisfies {
  [Name in keyof HostAppProperties]-?: true;
}) as readonly (keyof HostAppProperties)[];
