---
"@mailquilt/core": minor
"@mailquilt/editor": minor
---

Merge Tags in every setting that holds text or a URL. With `mergeTags`, typing `{{` in a settings field such as a Button's label or link, an Image's alt text, or the email's preheader, or in the link field in text, opens the same list as in text, under the field. A tag goes in as the text `{{name}}`. Enter puts in the tag without applying the field, and the first Escape closes the list before the next one takes back what was typed or closes the link field. Each of these fields says under it that `{{` adds a Merge Tag. The email's language can now be one Merge Tag as its whole value, such as `{{language}}`, as well as a code. A URL that starts with a tag followed by a scheme, such as `{{#if vip}}https://…{{/if}}`, is still refused.
