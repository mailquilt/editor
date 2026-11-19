---
"@mailquilt/renderer": patch
---

A word of 20 or more characters gets break points however it's formatted, so one with a bold part, such as `projects/mail-` and a bold `quilt/welcome`, no longer widens the email. A Merge Tag partly formatted stays whole, and a word gets no break point after its last character, such as the full stop after a URL. A URL written as text ends before Japanese, Chinese or Thai written straight after it, and before their full-width punctuation, so `詳細はhttps://example.jp/をご覧ください` links `https://example.jp/`. A URL with such letters typed in its path links only up to them, so paste it percent-encoded, as browsers copy it, or link it yourself.
