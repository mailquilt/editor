"use client";

import type {
  BlocksDocument,
  MailQuilt as MailQuiltElement,
  MailQuiltShell as MailQuiltShellElement,
  ShellVariant,
} from "@mailquilt/editor";
import {
  createElement,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useState,
} from "react";
import type { Ref } from "react";

export type {
  BlocksDocument,
  MailQuilt as MailQuiltElement,
  MailQuiltShell as MailQuiltShellElement,
  ShellVariant,
} from "@mailquilt/editor";

interface EditorProps<Element> {
  onChange?: (document: BlocksDocument) => void;
  onError?: (error: { reason: string }) => void;
  /** The element, once the editor has loaded in the browser. */
  ref?: Ref<Element>;
  value?: BlocksDocument;
}

export type MailQuiltProps = EditorProps<MailQuiltElement>;

export interface MailQuiltShellProps extends EditorProps<MailQuiltShellElement> {
  /** The text in the Shell's header. "Email" when left out. */
  heading?: string;
  /** Where the Shell keeps the email in the browser. Without it, nothing is stored. */
  saveKey?: string;
  /** "simple" when left out. */
  variant?: ShellVariant;
}

/** Only called from an effect, so a server never runs the editor. */
const loadEditor = () => import("@mailquilt/editor");

/**
 * Connects `<mail-quilt>` or `<mail-quilt-shell>` to the props they share, once
 * the editor has loaded. Returns the ref for the rendered element.
 */
const useEditorElement = <
  Element extends MailQuiltElement | MailQuiltShellElement,
>({
  onChange,
  onError,
  ref,
  value,
}: EditorProps<Element>) => {
  const [element, setElement] = useState<Element | null>(null);
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
      onError(detail);
    editor.addEventListener("mq-error", listener);
    return () => editor.removeEventListener("mq-error", listener);
  }, [editor, onError]);

  // In the commit, because an effect can run after the next key. The editor
  // would then see an older document, load it and lose that key and undo history.
  useLayoutEffect(() => {
    if (editor) {
      // oxlint-disable-next-line react/immutability -- Held in state, but it's an element, and this is how it takes a document.
      editor.value = value;
    }
  }, [editor, value]);

  // Last, so a callback ref gets an element that already has its email, and with
  // nothing until then, because a ref is otherwise never called with `null` first.
  useImperativeHandle<Element | null, Element | null>(
    editor ? ref : undefined,
    () => editor,
    [editor]
  );

  return setElement;
};

export const MailQuilt = (props: MailQuiltProps) =>
  createElement("mail-quilt", { ref: useEditorElement(props) });

/**
 * A ready-made editor page: the editor with a header, Import and Export, and
 * messages. Its attributes are on the server's HTML, so the Shell has them
 * when it starts in the browser.
 */
export const MailQuiltShell = ({
  heading,
  saveKey,
  variant,
  ...props
}: MailQuiltShellProps) => {
  // React's types only know the attributes of built-in elements.
  const attributes: Record<string, unknown> = {
    heading,
    "save-key": saveKey,
    variant,
  };
  return createElement("mail-quilt-shell", {
    ...attributes,
    ref: useEditorElement(props),
  });
};
