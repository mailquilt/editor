"use client";

import type {
  BlocksDocument,
  MailQuilt as MailQuiltElement,
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
} from "@mailquilt/editor";

export interface MailQuiltProps {
  onChange?: (document: BlocksDocument) => void;
  onError?: (error: { reason: string }) => void;
  /** The `<mail-quilt>` element, once the editor has loaded in the browser. */
  ref?: Ref<MailQuiltElement>;
  value?: BlocksDocument;
}

/** Only called from an effect, so a server never runs the editor. */
const loadEditor = () => import("@mailquilt/editor");

export const MailQuilt = ({
  onChange,
  onError,
  ref,
  value,
}: MailQuiltProps) => {
  const [element, setElement] = useState<MailQuiltElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const editor = loaded ? element : null;

  useEffect(() => {
    // oxlint-disable-next-line promise/catch-or-return -- A bundle that won't load is an unhandled rejection, as with any other import.
    loadEditor().then(() => setLoaded(true));
  }, []);

  useImperativeHandle<MailQuiltElement | null, MailQuiltElement | null>(
    ref,
    () => editor,
    [editor]
  );

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

  return createElement("mail-quilt", { ref: setElement });
};
