---
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Every word the editor and the Shell show or read out to a screen reader can be replaced through the new `strings` property, by ID, such as to translate the editor. `STRINGS`, from `@mailquilt/editor` and from `@mailquilt/editor/strings`, which defines no elements, lists every ID with its English, which stays for any you leave out. What varies, such as a Row's number, is a placeholder such as `{row}`. `language` sets the language the editor marks its words with. The Shell and both React components pass `strings` on, and the `MailQuiltStrings` and `StringId` types describe it. A refused paste now says why in the editor's own words, such as "Can't paste. It was copied from a newer version of the editor.", rather than in core's English reason.
