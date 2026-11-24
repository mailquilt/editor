<script lang="ts">
  import "@mailquilt/editor";
  import type { BlocksDocument, MailQuilt } from "@mailquilt/editor";

  import { starterEmail } from "./starter-email";

  /** The email saved in this browser, or the starter email if there's none. */
  const savedEmail = (): BlocksDocument => {
    try {
      const saved = localStorage.getItem("email");
      return saved ? JSON.parse(saved) : starterEmail;
    } catch {
      // Storage is blocked, or what's saved isn't JSON.
      return starterEmail;
    }
  };

  let editor: MailQuilt;
  let email = $state.raw(savedEmail());
  let html = $state("");
  let loadError = $state("");

  const save = (next: BlocksDocument) => {
    email = next;
    localStorage.setItem("email", JSON.stringify(next));
  };

  const exportHtml = async () => {
    html = await editor.exportHtml();
  };
</script>

<main>
  <mail-quilt
    bind:this={editor}
    value={email}
    onmq-change={(event) => save(event.detail.document)}
    onmq-error={(event) => (loadError = event.detail.reason)}
  ></mail-quilt>
  <button onclick={exportHtml} type="button">Export HTML</button>
  <output id="exported-html">{html}</output>
  <output id="load-error">{loadError}</output>
</main>
