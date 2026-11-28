# 0.4.0 design: every surface, its job, states and copy

The picked design for every surface `0.4.0` adds or changes. Each UI ticket builds to it: the frames are the visual spec, and this page is the copy and the states. Any visible difference from a frame is a bug unless the pull request names it as better.

## Seeing the frames

Open `mockups.html` in a browser. It draws every frame, grouped by surface, with its ID above it. To make a PNG of each frame, from the repo root:

```sh
node docs/design/0.4.0/shoot.mjs "$PWD/apps/docs/package.json" "$PWD/docs/design/0.4.0/mockups.html" /tmp/frames
```

Add a last argument of comma-separated ID prefixes, such as `k0,p1`, to make only those. `SCALE=1` makes them at 1x. The mockups are hand-drawn HTML, not the editor, so their markup and class names aren't a guide to the build; only what they show is.

The photos in `img/` are from Unsplash and are under the [Unsplash License](https://unsplash.com/license), not this repository's MIT License. Each file is named after its Unsplash image:

- `1442512595331-e89e73853f31.jpg`: https://images.unsplash.com/photo-1442512595331-e89e73853f31
- `1447933601403-0c6688de566e.jpg`: https://images.unsplash.com/photo-1447933601403-0c6688de566e
- `1495474472287-4d71bcdd2085.jpg`: https://images.unsplash.com/photo-1495474472287-4d71bcdd2085
- `1497935586351-b67a49e012bf.jpg`: https://images.unsplash.com/photo-1497935586351-b67a49e012bf
- `1509042239860-f550ce710b93.jpg`: https://images.unsplash.com/photo-1509042239860-f550ce710b93
- `1511920170033-f8396924c348.jpg`: https://images.unsplash.com/photo-1511920170033-f8396924c348

The direction is the approved concept (ADR 0021, ADR 0022). This brief adds what the concept didn't draw: each surface's job, every state it has and its copy, written before the mockups. Frame IDs point at `mockups.html`; every frame also has a `-dark` twin in the built-in dark theme, except `h01`, which shows a host's own tokens.

**Interaction states, everywhere.** Hover: `--hover` behind the control (`e10-bar-hover`), with a tooltip after 500 ms that names the action and its key. Press: the control scales to 0.97 for 100 ms. Keyboard focus: a 2px accent ring with a 2px gap (`t02-element-only`, `e02-image-selected-keyboard`, `c10-check-focus`, `7-start`). Disabled: 45% opacity, and a tooltip that says why. Every field and the selected segment of every switch has an edge at 3:1 (`--mq-color-border-strong` today), as the shipped editor's fields do, so WCAG 1.4.11 stays met.

The person in every section is the Host app's user: a marketer or founder designing an email without code, inside someone else's product. Terms are GLOSSARY.md's.

Copy rules for every surface: sentence case; name the thing, not the control ("Add alt text", not "Fix"); say what a reader of the email would see go wrong, not the rule's name; no "Oops", no "Successfully"; a disabled control says why in its tooltip.

---

## 1. Top bar and the three Modes (#314)

**Job.** Tell the person where they are (Edit, Style or Check) and give them undo, redo and the Desktop/Phone switch in every Mode. In the Shell, also the email's name, whether it's saved, and Export.

**Arrives.** Opening the editor, in Edit, with an email or an empty one.

**Needs to know.** Which Mode they're in; whether there are Problems (the count on Check); whether the email is saved (Shell only).

**Does next.** Edits, or switches Mode with a click or the keyboard (Tab to the Modes, then arrow keys; the Modes are one tab list).

**What lives where.** `<mail-quilt>` draws the Modes, undo, redo and Desktop/Phone. The Shell adds, on the left, the name and save status, and on the right, Export and a "More" menu. Without the Shell the left side holds only undo and redo (frame `t02-element-only`).

**States**
| State | What shows | Frame |
|---|---|---|
| Default, saved | Name, "Saved", undo/redo, Modes, Check count, Desktop/Phone, ⋯, Export | `1-edit-button` |
| Saving | "Saving…" in place of "Saved" (only shown after 500 ms, so a fast save never flashes) | `t01-saving` |
| Can't save | "Not saved" in warn color, and the message bar below | `m01-save-failed` |
| Empty email | Undo off; Style and Check off with a tooltip; Export off | `7-start` |
| No Problems | Check has no count | `c02-check-all-clear` |
| Keyboard focus on a Mode | 2px focus ring on the tab, arrow keys move it | `t02-element-only` |
| Export menu open | "HTML file", "JSON file" | `t03-export-menu` |
| ⋯ menu open | Import JSON…, Keyboard shortcuts | `t04-more-menu` |
| Element only, no Shell | No name, no Export | `t02-element-only` |

**Copy.** Modes: "Edit", "Style", "Check". Check count: the number alone, named for screen readers as "Check, 2 Problems". Status: "Saved", "Saving…", "Not saved". Export button: "Export" with a chevron. Export menu: "HTML file" ("The email, ready to send"), "JSON file" ("To open in Mail Quilt again"). ⋯ menu: "Import JSON…", "Keyboard shortcuts". Tooltips when the email is empty: "Add something to the email first".

---

## 2. Rows list (#317)

**Job.** Show the email's structure at a glance and let the person jump to, reorder and add Rows.

**Arrives.** In Edit, wanting to find a part of a long email or reorder it.

**Needs to know.** How many Rows, which is selected, which are hidden on the device being viewed.

**Does next.** Clicks a Row (the Canvas scrolls to it and selects it), drags it, uses Alt+Up/Down, or adds a Row with +.

**States**
| State | Frame |
|---|---|
| Default, a Row selected | `4-edit-row` |
| Hover on a Row: its grip replaces its number | `l01-hover-drag` (Row 3) |
| Dragging a Row: the lifted thumb and the insert line | `l01-hover-drag` |
| Keyboard focus on a Row, with the Alt+↑/↓ tooltip | `l02-keyboard-move` |
| Adding a Row from + : layouts and Saved Rows | `l03-add-row` |
| Adding a Row, the host gives no Saved Rows | `l04-add-row-no-saved` |
| Collapsed | `r1024-edit` |
| Long email, scrolled | `m06-long-email` |
| A Row that isn't on every device: a badge on its picture, a crossed-out phone for "Desktop only" (`4-edit-row`, Row 5) or a phone for "Phones only" (`f03-hidden-mark`) |
| Empty email: no Rows yet | `l05-empty-email` |
| The expanded list's collapse button, the Rows icon at the start of its head | `l06-collapse-at-start` |
| At 768: the collapsed list, as at 1024 | `l07-collapsed-768` |
| Collapsed, the button that expands it | `l08-expand-tooltip` |
| Collapsed, the +'s layouts beside it | `l09-add-from-collapsed` |

The `l06` to `l09` frames were picked for #317 on 2026-11-26, as states the frames above leave out. `l07` replaces `r768-edit`'s Rows button in the top bar: the collapsed list fits at 768, so its control stays where it is at every width. Until the person collapses or expands it, the list is expanded where it fits beside the email with More docked, and collapsed below, as `r1024-edit` draws it. With nothing selected, the +'s layouts say "Adds at the end".

**Copy.** Header: "Rows" and the count. A Row is named for screen readers as "Row 3 of 6: Heading, Text, Button". Badge tooltip: "Desktop only" or "Phones only". Keyboard tooltip: "Row 3 of 6" and "Alt+↑ or Alt+↓ to move". Add popover: "Empty Row" and "Saved Rows", and "Adds below Row 4", or "Adds at the end" with nothing selected. Toggle tooltips: "Collapse the Rows list" and "Expand the Rows list". Empty: "No Rows yet", "Add one here or on the email." On the email: "Start with a Row", "Pick how many Columns it has. You can change it after." and the layouts.

---

## 3. Selection bar and its "More" panel (#315)

**Job.** Hold everything about what's selected in one place: the settings that matter most in the bar itself, the rest one press away under "More".

**Arrives.** Having clicked a Block, a Row or a Column, or with nothing selected.

**Needs to know.** What is selected and where it is (the chip: "Row 3 / Button"); its main settings; that more exist.

**Does next.** Changes a setting, moves, duplicates or deletes, or opens More.

**The bar holds**, per Block type, its two to four most-used settings, then move up, move down, duplicate, delete and More. Everything else, including the fuller settings (section 7), Show on, Phone values and the less common actions, is in More.

**More** is one panel, not a menu. Its sections, top to bottom: the Block's own settings that didn't fit; "Box" (padding, background, border, corners); "Show on"; then the actions: Copy, Cut, Paste below, Move to the next Column, Select the Row. It opens as a docked drawer where the email fits beside it, a floating panel below that, and a sheet on phones (Decisions, A).

**States**
| State | Frame |
|---|---|
| Nothing selected | `e01-nothing-selected` |
| Block selected (Button, Text, Image, Social, Menu, Video) | `1-edit-button`, `2-edit-text`, `e02-image-selected-keyboard`, `e07-social-links`, `k01-menu`, `k04-video` |
| Row selected | `4-edit-row` |
| Column selected | `f02-column` |
| A field focused from the keyboard | `e02-image-selected-keyboard` |
| More open | `b01-more-panel` |
| A setting popover open (padding) | `e09-row-padding` |
| A field with an error | `m03-invalid-link` |
| An action that can't be done: dimmed, its tooltip says why ("Move to the next Column", "It's in the only Column") | `b01-more-panel` |
| Hover on a bar control, with its tooltip | `e10-bar-hover` |
| Narrow (768): the bar keeps the chip, the key settings and More | `r768-edit` |
| Divider and Spacer selected | `g01-divider`, `g02-spacer` |
| Nothing selected: the email's preheader, language and width in the bar, its background and font under More until Style takes them | `g03-email-in-bar`, `g04-email-more` |
| More for a Button and a Row, before Box and Show on (#323, #324) | `g06-button-more`, `g07-row-more` |
| Text selected: its size, color and alignment in the bar, the format bar at the text | `g08-text-format-at-text` |
| Row padding the same on every side: one field, with Same on every side on | `g09-padding-same-on-every-side` |

The `g` frames were picked for #315 on 2026-11-26, as states the frames above leave out. For a Text Block, `g08` replaces the formatting `2-edit-text` draws in the bar, as #315 and the spec keep the format bar next to the text. With nothing selected, `g03` replaces `e01`'s hint and Add, as the email's settings go in the bar and adding comes with #316. `g09` draws `e09`'s switch turned on: it's on wherever every side is the same, unless the person turned it off or set a side on its own, and turning it on gives every side Top's value. In both, the switch sits under the popover's title, above the fields, so it stays where it was pressed as they change; picked on 2026-11-26 over the first `e09`, which drew it below them.

**Copy.** Chip: "Row 3 / Button" (the path is a menu: "Row 3", "Column 1", and "Email", which selects nothing). More panel title: the Block's name ("Button"). Section titles: "Box", "Show on", "Actions". Dimmed action tooltip: "It's in the only Column". Nothing selected: the chip "Email", then "Preheader", "Language" and "Width".

**On a Button, Corners in Box set the Button's own shape,** over Email style's button corners, since a Button has no box of its own worth rounding. #323 confirms this before code.

---

## 4. Adding a Block from the Canvas (#316)

**Job.** Add a Block where the person is looking, not from a list somewhere else.

**Arrives.** Hovering between two Blocks, in an empty Column, or pressing `/`.

**Does next.** Picks a Block type; it's added there and selected.

**States**
| State | Frame |
|---|---|
| Hover between Blocks: the + on the line | `a01-insert-hover` |
| Picker open at that place, with search | `a02-insert-picker` |
| Search with no match | `a03-insert-no-match` |
| Empty Column's add control | `e05-new-empty-row` |
| The Add panel from `/` or "Add": Blocks, Empty Rows, Saved Rows; dragging | `3-add-drag` |
| Add at the end of the email's bar | `a04-add-in-email-bar` |
| The Add panel open, before the Rows list | `a05-add-panel-open` |
| A drop that can't go there | `m05-refused-drop` |

`a04` and `a05` were picked for #316 on 2026-11-26, as states the frames above leave out: Add at the end of the email's bar, after More, since `g03` gave that bar to the email's settings, and the Add panel open with the side panel gone, before the Rows list (#317) takes its place. Until #332, the panel has no Saved Rows.

**Copy.** + tooltip: "Add a Block here". Picker search: "Search Blocks". Picker footer: "Adds below the Text, in Row 3". No match: "No Block called “tabel”" and "Try Text, Image or Button."

---

## 5. Style (#318, #328)

**Job.** Set the look every Block shares, and see it change on the email as it's set.

**Arrives.** From Edit, wanting the whole email to match a brand, or to fix one thing everywhere.

**Needs to know.** The current value of each setting; which are the built-in defaults; which Blocks keep their own value.

**Does next.** Picks a color, a font or a size; clears a value; goes back to Edit.

**States**
| State | Frame |
|---|---|
| Default, hovering a setting highlights what it changes | `5-style` |
| A Block that sets its own value is selected | `s02-style-block-override` |
| Color picker open, with "Use the default" and the email's own colors | `s03-color-picker` |
| A value not set: "Default" and the built-in value in grey | `s03-color-picker` (Links: "Same as text") |
| Font picker open: the host's web fonts and system fonts, a web font loading, keyboard focus | `s04-font-picker` |
| A web font that failed to load, and one loading | `s05-font-failed` |
| Phone sheet | `p03-style` |
| Nothing set: "Default" and the built-in value on every unset field; Page and Body always have one | `s10-style-nothing-set` |
| A size pressed: its field, and "Use the default (32px)" | `s11-size-field` |
| Button corners: Square, Rounded or Pill, named under each; "Use the default (3px)" once one is picked | `s12-corners` |
| The Headings font's default, "Same as body", first in its list | `s13-headings-font` |
| A selected Block with more than one value of its own: one callout for each | `s14-own-values` |
| Hovering a setting: the Blocks it changes, and those that keep their own, marked "Keeps its own" | `s15-hover-keeps-own` |
| Where the email and the panel fit side by side, the panel docks; narrower, it floats over the Canvas's edge, as More does | `s16-style-1024`, `s17-style-768` |

The `s1` frames were picked for #318 on 2026-11-26, as states the frames above leave out. Width, preheader and language stay in Edit's email bar (`g03`), so Style has no Layout or Inbox section; the email's background and font move from that bar's More to Style, as Page and Body. In Style the Canvas is for looking: a Block can be selected by pointer, or stays selected from Edit, to see the values it keeps as its own, but nothing is typed, added, moved or deleted there. Corners are 0px, 8px and 100px. Until #328, the font lists hold only system fonts.

**Copy.** Title "Email style", lead "Every Block uses these unless it sets its own." Unset value: "Default" beside the built-in value. Color picker: "Hex", "In this email", "Use the default (#2563EB)" (the built-in Button color). Font picker groups: "Your fonts" (the host's) and "System fonts"; each web font shows "Falls back to Georgia". Search: "Search fonts". Loading: "Loading Inter…". Failed: "Fraunces couldn't be loaded, so you see Georgia, its fallback. Readers may see Georgia too."

---

## 6. Check (#320, #321, #322)

**Job.** Show the email as readers will get it and list what would go wrong for them, each with a way to fix it, before export.

**Arrives.** Before exporting or sending, often drawn by the count on Check.

**Needs to know.** What readers see in an inbox, on desktop and phone; what's wrong and why it matters; that Problems never block an export.

**Does next.** Fixes a Problem (the fix button opens Edit, selects the part and focuses the field), reads the plain text or HTML, sends a test, exports.

**Tabs.** "Inbox", "Plain text", "HTML", in the bar above the preview, with "Show sample values" beside them (only on Inbox and Plain text).

**States**
| State | Frame |
|---|---|
| Problems | `6-check` |
| Many Problems, all ten kinds | `c04-check-many` |
| Keyboard focus on a fix button, hover on Send a test | `c10-check-focus` |
| No Problems | `c02-check-all-clear` |
| Checking, preview loading; Send a test off until the check ends | `c03-check-loading` |
| No sender or subject from the host: the preheader alone, no avatar | `c05-no-sender` |
| Plain text tab | `c06-plain-text` |
| HTML tab; after Copy | `c07-html-copied` |
| Send a test: idle (every Check frame), sending, sent, failed | `c08a-test-sending`, `c08b-test-sent`, `c08c-test-failed` |
| A fix button pressed: Edit, the part selected, the field focused, the Problem shown beside it | `c09-after-fix` |
| A Merge Tag not in the host's list | `m02-unknown-merge-tag` |
| Phone: the same tabs and inbox header, the Problems in a sheet with Send a test | `p04-check` |
| Phone: a test that failed | `p18-test-failed` |

**Copy.** Panel title "Before you export", then "2 things to fix.", or "10 checks passed." over "Ready to export". Passed lines, in this order: "Every Image has alt text", "Every Button and link goes somewhere", "Every Image has an image", "Preheader is set", "Every Merge Tag will be filled in", "41 KB, under Gmail's 102 KB cut-off", "Language is set", "Text is easy to read", "Every link says where it goes", "There's an unsubscribe link" (only when the host marks its unsubscribe Merge Tag). Problems (title, then why, then the fix button):
- "Image has no image" / "Readers see an empty space in Row 2." / "Add an image"
- "Image has no alt text" / "If images are blocked, or for screen readers, Row 4 says nothing." / "Add alt text"
- "“Add to bag” has no link" / "Readers who click it go nowhere." / "Add link"
- "frst_name isn't one of your Merge Tags" / "Readers would see {{frst_name}} where their name should be." / "Fix the Merge Tag"
- "No preheader" / "Inboxes show the email's first words instead: “Shop Subscriptions Journal”." / "Add a preheader"
- "142 KB, over Gmail's 102 KB cut-off" / "Gmail hides the end of the email, unsubscribe link included, behind “View entire message”." / no fix button
- "No language" / "Screen readers may read it in the wrong voice." / "Set the language"
- "Text is hard to read" / "#B0A193 on #FBF7F1 is 2.4 to 1. Text this size needs 4.5 to 1." / "Change the color"
- "“Click here” doesn't say where it goes" / "Screen reader users often jump from link to link and hear only this." / "Change the text"
- "No unsubscribe link" / "Your sending service, or the law where your readers live, may require one." / "Add the link"

Send a test: button "Send a test" in the panel's head; sending "Sending…"; sent "Test sent." (announced); failed: the host's message (the frame shows "Your plan sends 10 tests a day. You've sent 10 today."), or "The test wasn't sent. Try again." when it has none. Plain text: "What email apps that show only text get. Made from the email; it can't be edited." and "Copy text". HTML: "41 KB · read only", "Copy HTML", then "Copied". Sample values switch: "Show sample values", hidden on the HTML tab. Passed lines: "Text is easy to read", "Every link says where it goes".

---

## 7. Fuller settings, Show on and Phone values (#323, #324)

**Job.** Let a person make a callout, a card or a two-column section properly, and give phones a simpler version, without a second email.

**Arrives.** In the More panel of a Block, or with a Column selected, or viewing the Phone view.

**Needs to know.** Which values are their own; which ones apply only on phones; that Outlook on Windows draws corners square; what's hidden on the device they're viewing.

**Does next.** Sets padding, a background, a border, corners; picks Show on; sets or clears a Phone value.

**States**
| State | Frame |
|---|---|
| Box settings in More, with the Outlook note under Corners | `b01-more-panel` |
| Column selected | `f02-column` |
| A Row not on this device, folded (the default) | `f03-hidden-mark` |
| A Block not on this device, folded | `f05-hidden-block` |
| Faded, with a tag | `f03b-hidden-faded` |
| Hidden: not drawn, the Rows list still marks it | `f03c-hidden-hide` |
| Choosing how they show: the ⋯ menu's "Not on this device" | `t05-view-menu`, `p09-top-menu` |
| Phone view: a Phone value set, marked, and its clear button | `f04-phone-value` |

**Copy.** "Box": "Padding", "Background", "Border", "Corners". Outlook note: "Outlook on Windows shows square corners." "Show on": "All devices", "Desktop only", "Phones only". Canvas mark for what's not on this device: "Row 5 · Phones only" or "Button · Phones only". The ⋯ menu's "Not on this device" sets how it shows, for this person, remembered in the browser: "Fold" ("A thin strip you can still select", the default), "Fade" ("Full size, faded, with a tag") or "Hide" ("Not drawn. The Rows list still marks it."). It's a view setting, not a host property. Phone value mark: the field tinted, a phone icon before the value and an ✕ to clear it. Its popover: "Font size on phones", "28px on phones, 36px on desktop.", "Use the desktop value (36px)". A field without Phone values, in the Phone view, has the tooltip "Changes on every device" (not drawn).

---

## 8. Decorative image (#325)

**Job.** Let a person say an Image adds nothing to what the email says, so screen readers skip it and Check stops asking.

**States.** Off (alt text field); on (alt field replaced, link off with its reason). Frame `d01-decorative`.

**Copy.** Switch: "Decorative". When on: "Screen readers skip it.", and the alt field goes. Link button off, tooltip: "A decorative image can't have a link".

---

## 9. Menu Block (#326)

**Job.** A row of the website's main links, for a header or footer.

**States**
| State | Frame |
|---|---|
| Selected, bar with Links, alignment, color, size, spacing | `k01-menu` |
| Links list open: add, reorder, remove, a link with an error | `k02-menu-links` |
| New Menu: no links yet | `k03-menu-empty` |

**Copy.** Bar: "Links" and the count, alignment, "Text" color, font size, the space between links. Links list: "Links, in the order they show"; each link is a label and a link, with move up, move down and remove; "Add link". Error: "That isn't a web address. Try one like northbound.co/journal." New Menu: the bar's "Add link" button, and on the Canvas "Add the links this menu shows".

---

## 10. Video Block (#327)

**Job.** Show a thumbnail that links to the video, because email can't play video.

**States**
| State | Frame |
|---|---|
| Selected, filled | `k04-video` |
| New: no video yet | `k05-video-empty` |
| Play button setting open: Below the picture, On the picture, None | `k07-video-play-menu` |
| On the picture: adding the button | `k08-video-adding-button` |
| On the picture: done | `k06-video-baked` |
| None | `k09-video-none` |
| The host gives no `uploadImage`: On the picture is off and says why | `k10-video-no-uploads` |
| The thumbnail's site doesn't allow drawing on it | `k11-video-cant-draw` |
| A thumbnail that fails to load uses the Image Block's failed state | `e04-image-uploading-failed` |

**Copy.** Bar: the video link field, "Thumbnail", "Alt". Empty: the link field focused with "Paste a link to the video", "Add a thumbnail" off until there's a link, "Describe the thumbnail"; on the Canvas "Add a video" and "Paste its link in the bar above, then add a thumbnail. Readers click the thumbnail to watch it, since email can't play video." Play bar: "Watch the video", edited in place on the Canvas as a Button's label is.

**The play button** is a setting, "Play button", with three choices:
- "Below the picture" (the default): "A “Watch the video” line under it. Works in every email app."
- "On the picture": "A play button drawn into a copy of the thumbnail, uploaded for you." The editor draws a centred play button onto a copy of the thumbnail in the browser and uploads it through the host's `uploadImage`, while "Adding the play button…" shows. The Block keeps the original thumbnail, so choosing another option, or a new thumbnail, redraws or restores it. Without `uploadImage`: "Needs image uploads, which this app doesn't offer." If the thumbnail's site doesn't allow reading its pixels: "The play button couldn't be added", "vimeocdn.com doesn't let the editor draw on its pictures. Upload the thumbnail instead, or keep the line below it.", with "Upload a thumbnail". An uploaded thumbnail is always in the browser already, and YouTube's thumbnails allow it (checked: `access-control-allow-origin: *` on `i.ytimg.com` and `img.youtube.com`).
- "None": "Just the picture. Some readers won't know it's a video."

A button laid over the picture with CSS isn't used: Can I email lists `position: absolute` as unsupported in Outlook.com and Yahoo Mail, and an overlay on a background image waits for background images, after 0.4.0.

**A YouTube link fills in the thumbnail** from YouTube's fixed thumbnail address for that video, which a person can replace. Other sites need a thumbnail added. Whether YouTube's terms allow its thumbnails in email is to check in #327 before code.

---

## 11. Phones (#329)

**Job.** Fix a typo or a link away from the desk.

**States**
| State | Frame |
|---|---|
| Block selected, docked bar | `8-phone` |
| Typing, format bar above the keyboard | `p06-typing` |
| More as a sheet | `p07-more-sheet` |
| Nothing selected | `p08-nothing-selected` |
| ⋯ menu as a sheet: the name and status (Shell), Desktop/Phone view, Redo, Rows, Export and Import (Shell) | `p09-top-menu` |
| Check: tabs, plain text, the Problems peeking with Send a test | `p11-check-text` |
| A font picker as a sheet | `p12-font-sheet` |
| Menu links as a sheet | `p13-menu-links` |
| Add, Style, Check sheets | `p02-add`, `p03-style`, `p04-check` |
| 320px | `p05-320` |
| Start screen | `p10-start` |
| Rows list as a sheet, from ⋯ | `p14-rows-sheet` |
| Row selected | `p15-row-selected` |
| Image's More: Decorative, alt text, a Phone value on width, Show on | `p16-image-more` |
| Errors: can't save, a link that isn't one | `p17-errors` |
| Empty email | `p19-empty-email` |
| Video selected | `p20-video` |

**Reused on phones, not drawn again:** the Merge Tag picker opens above the keyboard where the format bar is (`p06-typing`); the color picker opens as a sheet like the font picker (`p12-font-sheet`); the Check tabs read as on desktop (`p11-check-text`); Send a test sending reads as on desktop (`c08a-test-sending`); a hidden Row shows as the same strip as `f03-hidden-mark`; the HTML tab shows the same code view, scrolling sideways.

**Phone values on a phone.** The Canvas on a phone shows the Phone view by default, and the ⋯ sheet switches it. As on desktop, the view decides which value a field with Phone values changes, and the sheet says so: "Font size, padding and Image width you change in the Phone view apply on phones only."

**Copy.** Nothing selected: "Tap a Block to change it" and "Add". Sheets close with "Done", not an ✕ alone; a sheet inside a sheet has a back arrow.

---

## 12. Start screen (#331)

**Job.** Give a person with an empty email a good first step, without getting in the way.

**States.** Default with keyboard focus on "Product launch" (`7-start`); phone (`p10-start`). Undo, Style, Check and Export are off until the email has something in it. Without `starterEmails`, or once the email has anything, there's no start screen.

**Copy.** "Start an email", "Begin from a starter email, or a blank one. You can change everything after." Cards: the host's name and description; "Blank", "An empty email".

---

## 13. Saved Rows (#332)

Shown where Rows are added: the Rows list's + (`l03-add-row`), the Add panel (`3-add-drag`) and the phone Add sheet (`p02-add`). Without `savedRows` the section isn't there (`l04-add-row-no-saved`). Copy: "Saved Rows" and the count; each Row's name from the host.

---

## Decisions

Picked by the maintainer on 2026-11-24.

**A. Where "More" opens: a docked drawer wherever the email fits beside it, a floating panel below that, a sheet on phones.** Drawn at 1440 (`b01-more-panel`, `b02-more-drawer`), 1024 (`b03-more-1024`, `b04-drawer-1024`) and 768 (`b05-more-768`, `b06-drawer-768`). The floating panel covers half the Block being changed at 1024; the drawer cuts the email off at 768. The drawer is closed until More opens it, closes with Escape or ✕, and while open shows whatever is selected. Section 3's "More" follows this.

**B. The Video's play button: all three, as the "Play button" setting** in section 10: below the picture (default), on the picture (drawn in and uploaded), or none.

**C. What's not on this device: the person chooses, Fold (default), Fade or Hide,** in the ⋯ menu, as section 7 says.

---

## 14. Phone follow-ups

**Picked by the maintainer on 2026-11-28: Q1 c, Q2 b, Q3 b, Q4 b, Q5 a; Q6 builds to `p17-errors`.** The picked frames are the visual spec; the others stay for the record. After #329 shipped, the build differed from the picked phone frames in a few places, and some phone states had never been drawn. Each state below has its directions as separate `q` frames, drawn at 390px (and 320px where width matters), light and dark.

### Q1. The email's settings, with nothing selected

**Job.** Let the person set the email's Width, Preheader and Language on a phone, where the email's bar has no room for them. These are the email's fields outside Style (`EMAIL_SETTINGS_FIELDS` without background and font), in that order.

| Direction | Frames |
|---|---|
| a. As built: the bar reads "Tap a Block to change it", then ⋯ and Add; ⋯ opens a sheet titled "Email" | `q01a-email-bar`, `q01a-email-sheet` |
| b. The top bar's ⋯ sheet (`p09`) gets "Email settings" with a chevron, which opens a sheet with a back arrow; the docked bar is `p08`'s hint and Add | `q01b-top-menu`, `q01b-email-sheet` |
| c. The docked bar starts with an "Email" chip, as the desktop bar does with nothing selected; it opens `q01a-email-sheet` | `q01c-email-chip` |

**Copy.** "Email" (or "Email settings" in b), "Done". "Width", "Preheader" with "The short text inboxes show after the subject.", "Language" with "A language code, such as en or pt-BR, or one Merge Tag."

### Q2. The chip's menu

**Job.** Select what's around the selected Block: its Column, its Row, or the Email.

| Direction | Frames |
|---|---|
| a. As built: an action sheet with no title or Done, "Row 3", "Column 1", "Email" | `q02a-chip-menu-actions` |
| b. A sheet titled "Select" (the menu's screen reader name today), with Done; the Block itself first and marked, then outward: Column, Row, Email | `q02b-chip-menu-select` |

**Copy.** "Select", "The Button, or what it’s in", "Done".

### Q3. Style

**Job.** Set the look every Block shares, while seeing the email change.

`p03-style` leaves out, from what the Style panel has: the Headings and Body fonts as two settings (it shows one "Fonts" row), the four sizes (Heading 1, Heading 2, Heading 3, Body text), the names under the corner shapes and their title "Button corners", "Use the default", the section titles "Colors" and "Text", and the callouts for a selected Block's own values.

| Direction | Frames |
|---|---|
| a. `p03` with a "Text sizes" row; "Fonts" and "Text sizes" open sheets with a back arrow | `q03a-style-rows`, `q03a-style-fonts`, `q03a-style-sizes` |
| b. The panel's own three sections as tabs: "Colors", "Text", "Button corners", in a sheet of one height that leaves the top of the email in sight | `q03b-style-tabs-colors`, `q03b-style-tabs-text`, `q03b-style-tabs-corners` |

### Q4. The format bar while typing

**Job.** Format the words being typed, above the keyboard. `p06`'s align icon is a frame mistake: alignment is a Text Block setting in its Selection bar (`g08`), not a format, and the build rightly leaves it out.

| Direction | Frames |
|---|---|
| a. `p06`'s set without the align icon (Bold, Italic, Link, Merge Tag, Bulleted list), and ⋯ opening a "Text formatting" sheet with Underline, Numbered list and Line break. Opening the sheet hides the keyboard | `q04a-format-bar`, `q04a-format-more` |
| b. All eight in the bar, grouped: Bold, Italic, Underline; Bulleted list, Numbered list; Link, Line break, Merge Tag. They fit at 390 (40px each) and at 320 (32px each), so nothing scrolls | `q04b-format-all`, `q04b-format-all-320` |

### Q5. A Block's bar when its controls don't fit

**Job.** Keep the settings a person changes most within one tap, and the rest one tap away in More, without a bar that scrolls.

| Direction | Frames |
|---|---|
| a. Chip, the main field, one color, ⋯ | `q05a-button`, `q05a-text`, `q05a-button-320`, `q05a-button-more` |
| b. Chip, the main field, ⋯ | `q05b-button`, `q05b-text`, `q05b-button-320`, `q05b-button-more` |
| c. The bar takes the Block's controls in order until it's full, then ⋯; it never scrolls. A Button at 390 is a's; a Text Block keeps its alignment at 390 and loses it at 320 | `q05c-text`, `q05c-text-320` |

In each, More starts with the bar's own actions as four buttons ("Move up", "Move down", "Duplicate", "Delete"), then the settings the bar left out, then Box, Show on and the rest of Actions.

### Q6. A link that isn't one

Not a new direction: build it to `p17-errors`. Its sheet is titled "Link", with "Apply" in Done's place, in the accent and dimmed while the link is refused; the field has the error edge and a link icon; under it, "That isn’t a web address. Try one like northbound.co/guji, an email address, or a Merge Tag.", with no icon; then a full-width "Remove link".
