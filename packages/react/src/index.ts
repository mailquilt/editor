"use client";

import type {
  BlocksDocument,
  HostAppProperties,
  MailQuilt as MailQuiltElement,
  MailQuiltShell as MailQuiltShellElement,
  ShellAction,
} from "@mailquilt/editor";
import {
  createElement,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  AriaAttributes,
  DOMAttributes,
  HTMLAttributes,
  ReactElement,
  Ref,
} from "react";

export type {
  BlocksDocument,
  HostAppProperties,
  MailQuilt as MailQuiltElement,
  MailQuiltShell as MailQuiltShellElement,
  ShellAction,
} from "@mailquilt/editor";

/** What both components take, the Host app's properties among them. */
interface EditorProps<Host> extends HostAppProperties {
  onChange?: (document: BlocksDocument) => void;
  /**
   * Why the editor refused a document, as `mq-error` says it, or why the
   * editor's code couldn't load.
   */
  onError?: (reason: string) => void;
  /** The element, once the editor has loaded in the browser. */
  ref?: Ref<Host>;
  value?: BlocksDocument;
}

/**
 * What else the element takes: `aria-*`, React's events, and the attributes
 * that mean something on it. Not those of form fields, such as `defaultValue`,
 * or of editable text, or `dir`, as the editor is left to right on any page.
 */
type ElementAttributes = AriaAttributes &
  Omit<
    DOMAttributes<HTMLElement>,
    "children" | "dangerouslySetInnerHTML" | "onChange" | "onError"
  > &
  Pick<
    HTMLAttributes<HTMLElement>,
    | "className"
    | "hidden"
    | "id"
    | "inert"
    | "lang"
    | "role"
    | "slot"
    | "style"
    | "suppressHydrationWarning"
    | "title"
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
 * Connects `<mail-quilt>` or `<mail-quilt-shell>` to the props they share, once
 * the editor has loaded. Returns the ref for the rendered element.
 */
const useEditorElement = <
  Host extends MailQuiltElement | MailQuiltShellElement,
>({
  hostApp,
  onChange,
  onError,
  ref,
  value,
}: Omit<EditorProps<Host>, keyof HostAppProperties> & {
  hostApp: HostAppProperties;
}) => {
  const [element, setElement] = useState<Host | null>(null);
  const [loaded, setLoaded] = useState(false);
  const editor = loaded ? element : null;
  // The newest, for a load that fails after a later render.
  const reportError = useRef(onError);
  useLayoutEffect(() => {
    reportError.current = onError;
  });

  useEffect(() => {
    let unmounted = false;
    const load = async () => {
      try {
        await loadEditor();
        setLoaded(true);
      } catch (error) {
        // Unmounted, or mounted again by StrictMode, which reports it instead.
        if (unmounted) {
          return;
        }
        // With nowhere to report it, it stays an unhandled rejection.
        if (!reportError.current) {
          throw error;
        }
        const reason = error instanceof Error ? error.message : String(error);
        reportError.current(`The editor couldn't load: ${reason}`);
      }
    };
    load();
    return () => {
      // oxlint-disable-next-line react/immutability -- React's own pattern for ignoring an effect's late result.
      unmounted = true;
    };
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

  // At each commit, as the element ignores what it already has.
  useLayoutEffect(() => {
    if (editor) {
      Object.assign(editor, hostApp);
    }
  });

  // In the commit, because an effect can run after the next key. The editor
  // would then see an older document, load it and lose that key and undo history.
  useLayoutEffect(() => {
    if (editor) {
      // oxlint-disable-next-line react/immutability -- A DOM element in state, not data React renders from.
      editor.value = value;
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
  uploadImage,
  value,
  ...attributes
}: MailQuiltProps): ReactElement =>
  createElement("mail-quilt", {
    ...attributes,
    ref: useEditorElement({
      hostApp: { uploadImage },
      onChange,
      onError,
      ref,
      value,
    }),
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
  uploadImage,
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
    ref: useEditorElement({
      hostApp: { uploadImage },
      onChange,
      onError,
      ref,
      value,
    }),
  });
};
