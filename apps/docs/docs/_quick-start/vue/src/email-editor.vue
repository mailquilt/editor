<script setup lang="ts">
import "@mailquilt/editor";
import type { BlocksDocument } from "@mailquilt/editor";
import { shallowRef, useTemplateRef } from "vue";

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

const editor = useTemplateRef("editor");
const email = shallowRef(savedEmail());
const html = shallowRef("");
const loadError = shallowRef("");

const save = (next: BlocksDocument) => {
  email.value = next;
  localStorage.setItem("email", JSON.stringify(next));
};

const exportHtml = async () => {
  html.value = (await editor.value?.exportHtml()) ?? "";
};
</script>

<template>
  <main>
    <mail-quilt
      ref="editor"
      :value.prop="email"
      @mq-change="save($event.detail.document)"
      @mq-error="loadError = $event.detail.reason"
    />
    <button type="button" @click="exportHtml">Export HTML</button>
    <output id="exported-html">{{ html }}</output>
    <output id="load-error">{{ loadError }}</output>
  </main>
</template>
