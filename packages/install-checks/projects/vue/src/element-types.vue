<!--
  No page shows this. vue-tsc type-checks it, so a Vue app's types for both
  elements are read here as its own templates read them. A type that fell back
  to `any` would leave an expected error out, which fails the build.
-->
<script setup lang="ts">
import type { BlocksDocument } from "@mailquilt/editor";

const keep = (email: BlocksDocument) => email;
const show = (reason: string) => reason;
const count = (value: number) => value;
const uploadImage = (file: File) => Promise.resolve({ url: file.name });
</script>

<template>
  <mail-quilt
    :merge-tags="[{ label: 'First name', name: 'first_name' }]"
    :upload-image="uploadImage"
    @mq-change="keep($event.detail.document)"
    @mq-error="show($event.detail.reason)"
  />
  <mail-quilt-shell
    actions="export-html"
    heading="Newsletter"
    save-key="my-app:email"
    @mq-change="keep($event.detail.document)"
    @mq-error="show($event.detail.reason)"
  />

  <!-- @vue-expect-error An email isn't a number. -->
  <mail-quilt :value.prop="42" />
  <!-- @vue-expect-error The email is an object, not a number. -->
  <mail-quilt @mq-change="count($event.detail.document)" />
  <!-- @vue-expect-error A reason is text. -->
  <mail-quilt-shell @mq-error="count($event.detail.reason)" />
  <!-- @vue-expect-error A tag needs the name that goes between its braces. -->
  <mail-quilt-shell :merge-tags="[{ label: 'First name' }]" />
</template>
