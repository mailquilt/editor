"use client";

import type {
  BlocksDocument,
  MailQuilt as MailQuiltElement,
  MailQuiltShell as MailQuiltShellElement,
  ShellAction,
} from "@mailquilt/editor";
import {
  createElement,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useState,
} from "react";
import type { HTMLAttributes, ReactElement, Ref } from "react";

export type {
  BlocksDocument,
  MailQuilt as MailQuiltElement,
  MailQuiltShell as MailQuiltShellElement,
  ShellAction,
} from "@mailquilt/editor";

interface EditorProps<Host> {
  onChange?: (document: BlocksDocument) => void;
  /** Why the editor refused a document, as `mq-error` says it. */
  onError?: (reason: string) => void;
  /** The element, once the editor has loaded in the browser. */
  ref?: Ref<Host>;
  value?: BlocksDocument;
}

/** What else the element takes, such as `className`, `style`, `id` and `aria-*`. */
type ElementAttributes = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "dangerouslySetInnerHTML" | "onChange" | "onError"
>;

export type MailQuiltProps = EditorProps<MailQuiltElement> & ElementAttributes;

export interface MailQuiltShellProps
  extends EditorProps<MailQuiltShellElement>, ElementAttributes {
  /** The Shell's buttons to show. All of them when left out, none when empty. */
  actions?: readonly ShellAction[];
  /** The text in the Shell's header. "Email" when left out. */
  heading?: string;
  /** Where the Shell keeps the email in the browser. Without it, nothing is stored. */
  saveKey?: string;
}

/** Only called from an effect, so a server never runs the editor. */
const loadEditor = () => import("@mailquilt/editor");

/**
 * Outside the hook, as React Compiler's lint rule, react/immutability, reads
 * setting a property of the element, which is held in state, as changing state.
 */
const setDocument = (
  element: MailQuiltElement | MailQuiltShellElement,
  value: BlocksDocument | undefined
) => {
  element.value = value;
};

/**
 * Connects `<mail-quilt>` or `<mail-quilt-shell>` to the props they share, once
 * the editor has loaded. Returns the ref for the rendered element.
 */
const useEditorElement = <
  Host extends MailQuiltElement | MailQuiltShellElement,
>({
  onChange,
  onError,
  ref,
  value,
}: EditorProps<Host>) => {
  const [element, setElement] = useState<Host | null>(null);
  const [loaded, setLoaded] = useState(false);
  const editor = loaded ? element : null;

  useEffect(() => {
    // oxlint-disable-next-line promise/catch-or-return -- A bundle that won't load is an unhandled rejection, as with any other import.
    loadEditor().then(() => setLoaded(true));
  }, []);

  useLayoutEffect(() => {
    if (!(editor && onChange)) {
      return;
    }
    const listener = ({ detail }: HTMLElementEventMap["mq-change"]) =>
      onChange(detail.document);
    editor.addEventListener("mq-change", listener);
    return () => editor.removeEventListener("mq-change", listener);
  }, [editor, onChange]);

  // Before `value` is set, or a refused first document goes unheard.
  useLayoutEffect(() => {
    if (!(editor && onError)) {
      return;
    }
    const listener = ({ detail }: HTMLElementEventMap["mq-error"]) =>
      onError(detail.reason);
    editor.addEventListener("mq-error", listener);
    return () => editor.removeEventListener("mq-error", listener);
  }, [editor, onError]);

  // In the commit, because an effect can run after the next key. The editor
  // would then see an older document, load it and lose that key and undo history.
  useLayoutEffect(() => {
    if (editor) {
      setDocument(editor, value);
    }
  }, [editor, value]);

  // Last, so a callback ref gets an element that already has its email, and with
  // nothing until then, because a ref is otherwise never called with `null` first.
  useImperativeHandle<Host | null, Host | null>(
    editor ? ref : undefined,
    () => editor,
    [editor]
  );

  return setElement;
};

export const MailQuilt = ({
  onChange,
  onError,
  ref,
  value,
  ...attributes
}: MailQuiltProps): ReactElement =>
  createElement("mail-quilt", {
    ...attributes,
    ref: useEditorElement({ onChange, onError, ref, value }),
  });

/**
 * A ready-made editor page: the editor with a header, Import and Export, and
 * messages. Its attributes are on the server's HTML, so the Shell has them
 * when it starts in the browser.
 */
export const MailQuiltShell = ({
  actions,
  heading,
  onChange,
  onError,
  ref,
  saveKey,
  value,
  ...rest
}: MailQuiltShellProps): ReactElement => {
  // React's types only know the attributes of built-in elements.
  const attributes: Record<string, unknown> = {
    ...rest,
    actions: actions?.join(" "),
    heading,
    "save-key": saveKey,
  };
  return createElement("mail-quilt-shell", {
    ...attributes,
    ref: useEditorElement({ onChange, onError, ref, value }),
  });
};
