// No page imports this. svelte-check type-checks it, so a Svelte app's types
// for both elements are read here, as the attributes its markup takes. A type
// that fell back to `any` would leave an expected error out, which fails the
// build.
import type { BlocksDocument } from "@mailquilt/editor";
import type { SvelteHTMLElements } from "svelte/elements";

const keep = (email: BlocksDocument) => email;
const show = (reason: string) => reason;

export const editor: SvelteHTMLElements["mail-quilt"] = {
  mergeTags: [{ label: "First name", name: "first_name" }],
  "onmq-change": (event) => keep(event.detail.document),
  "onmq-error": (event) => show(event.detail.reason),
  theme: "dark",
  uploadImage: (file) => Promise.resolve({ url: file.name }),
};

export const shell: SvelteHTMLElements["mail-quilt-shell"] = {
  actions: "export-html",
  heading: "Newsletter",
  "onmq-change": (event) => keep(event.detail.document),
  "onmq-error": (event) => show(event.detail.reason),
  saveKey: "my-app:email",
  theme: "auto",
};

// @ts-expect-error The theme is light, dark or auto.
export const unknownTheme: SvelteHTMLElements["mail-quilt"] = { theme: "blue" };

// @ts-expect-error An email isn't a number.
export const notAnEmail: SvelteHTMLElements["mail-quilt"] = { value: 42 };

export const notANumber: SvelteHTMLElements["mail-quilt-shell"] = {
  "onmq-change": (event) => {
    // @ts-expect-error The email is an object, not a number.
    const count: number = event.detail.document;
    return count;
  },
};

export const unnamedTag: SvelteHTMLElements["mail-quilt-shell"] = {
  // @ts-expect-error A tag needs the name that goes between its braces.
  mergeTags: [{ label: "First name" }],
};
