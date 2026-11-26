/**
 * Every word the editor shows or announces, in English, by its ID. A Host app
 * replaces any of them through `strings`, and what it leaves out stays as
 * here. A word in braces, such as `{row}`, is a placeholder the editor fills
 * in, and a replacement can move it or leave it out. A Merge Tag such as
 * `{{cta_url}}` has two braces, and is never filled in.
 *
 * Kept free of anything that defines the elements, so a server can import it
 * from `@mailquilt/editor/strings`.
 */
// oxlint-disable-next-line sort-keys -- Grouped by where each text shows, which is how a host finds one.
export const STRINGS = {
  /** The language of these words, for screen readers and lists such as "A, B or C". */
  language: "en",

  // Kinds of Block, as a person calls them.
  "block.button": "Button",
  "block.divider": "Divider",
  "block.heading": "Heading",
  "block.image": "Image",
  "block.social": "Social",
  "block.spacer": "Spacer",
  "block.text": "Text",

  // Key names in tooltips and in what a screen reader is told to press.
  "key.alt": "Alt",
  "key.ctrl": "Ctrl",
  "key.shift": "Shift",
  "key.backspace": "Backspace",
  "key.delete": "Delete",
  "key.end": "End",
  "key.enter": "Enter",
  "key.escape": "Escape",
  "key.home": "Home",
  "key.tab": "Tab",
  "key.arrowDown": "ArrowDown",
  "key.arrowLeft": "ArrowLeft",
  "key.arrowRight": "ArrowRight",
  "key.arrowUp": "ArrowUp",
  /** A control and the keys that do the same, in its tooltip. */
  withKeys: "{label} ({keys})",

  // The top bar, above every Mode.
  "topBar.undo": "Undo",
  "topBar.redo": "Redo",
  "topBar.modes": "Modes",
  "topBar.edit": "Edit",
  "topBar.style": "Style",
  "topBar.check": "Check",
  /** A Mode's tooltip, which says how to reach the others. */
  "topBar.modeKeys": "{mode} (← → to move between Modes)",
  /** Why Style, Check and the Shell's Export are off. */
  "topBar.emptyEmail": "Add something to the email first",
  "topBar.view": "View",
  "topBar.desktop": "Desktop",
  "topBar.phone": "Phone",

  // The Canvas.
  "canvas.block":
    "{type} Block, Row {row}, Column {column}, position {position} of {count}",
  "canvas.dragBlock": "Drag Block",
  "canvas.moveBlockUp": "Move Block up",
  "canvas.moveBlockDown": "Move Block down",
  "canvas.duplicateBlock": "Duplicate Block",
  "canvas.deleteBlock": "Delete Block",
  "canvas.row": "Row {row}",
  "canvas.rowTag": "Row",
  "canvas.moveRowUp": "Move Row up",
  "canvas.moveRowDown": "Move Row down",
  "canvas.duplicateRow": "Duplicate Row",
  "canvas.deleteRow": "Delete Row",
  "canvas.hiddenOnPhones": "Hidden on phones",
  "canvas.dropHere": "Add a Block, or drop one here",
  /** An empty Column's button, which shows `canvas.dropHere`, named with where it is. */
  "canvas.addToColumn":
    "Add a Block, or drop one here, in Row {row}, Column {column}",
  "canvas.emailTools": "Email tools",
  "canvas.preview": "Preview",
  "canvas.textOf": "{type} Block",
  "canvas.blockKeys":
    "Press {editText} to edit the text, and {backToBlock} to come back. In the text, press {formatBar} to reach its formatting. Press {selectBlock} to select another Block, and {moveBlock} to move this one.",
  "canvas.blockKeysNoText":
    "Press {selectBlock} to select another Block, and {moveBlock} to move this one.",
  "canvas.narrowTitle": "Editing needs more room",
  "canvas.narrowText":
    "Make the editor at least {width}px wide, such as by widening the window, to change this email. You can still preview it here.",
  "canvas.narrowPreview": "Preview email",

  // What Blocks show on the Canvas before they have content.
  "image.uploading": "Uploading…",
  "image.noUrl": "No image URL yet",
  "image.failed": "Couldn't load {url}",
  "social.noLinks": "No social links yet",
  "social.noUrls": "No social link has a URL yet",
  "social.iconWithoutUrl": "{network}, no URL yet",

  // The format bar and its link field.
  "format.bar": "Text formatting",
  "format.bold": "Bold",
  "format.italic": "Italic",
  "format.underline": "Underline",
  "format.bulletList": "Bulleted list",
  "format.numberedList": "Numbered list",
  "format.link": "Link",
  "format.editLink": "Edit link",
  "format.lineBreak": "Line break",
  "format.mergeTag": "Merge Tag",
  "format.mergeTagKeys": "Merge Tag (type {{)",
  "format.linkUrl": "Link URL",
  "format.applyLink": "Apply",
  "format.removeLink": "Remove link",
  "format.cancelLink": "Cancel",

  // The Merge Tag picker.
  "mergeTags.picker": "Merge Tags",
  /** With no-break spaces, so the braces never end or start a line. */
  "mergeTags.hint": "Type\u00A0{{\u00A0to add a Merge Tag.",

  // The Selection bar.
  /** The Selection bar, named for what it's the settings of. */
  "bar.of": "{name} settings",
  "bar.email": "Email",
  "bar.row": "Row",
  /** Before the selected Block's type, on the bar's chip: "Row 3 /". */
  "bar.path": "{row} /",
  /** The chip's menu, of what's around what's selected. */
  "bar.around": "Select",
  "bar.more": "More settings and actions",
  "bar.close": "Close",
  /** A color button's name: what it shows, such as "Fill", and its value. */
  "bar.valueOf": "{label}: {value}",
  "bar.fill": "Fill",
  "bar.textColor": "Text",
  "bar.color": "Color",
  "bar.addLink": "Add a link",
  "bar.alt": "Alt",
  "bar.upload": "Upload",
  "bar.replace": "Replace",
  "bar.uploadImage": "Upload image",
  "bar.imageUrl": "Paste an image URL",
  "bar.pasteImageUrl": "Or paste an image URL",
  "bar.widthFill": "Width: fill Column",
  "bar.widthOf": "Width: {width}px",
  "bar.width": "Width",
  "bar.thickness": "Thickness",
  "bar.height": "Height",
  "bar.links": "Links",
  "bar.columns": "Columns",
  "bar.layout": "{layout} layout",
  "bar.padding": "Padding",
  "bar.everySide": "Every side",
  "bar.sameOnEverySide": "Same on every side",
  "bar.stackOnPhones": "Stack on phones",
  "bar.preheader": "Preheader",
  "bar.language": "Language",

  "more.blockPlace": "Row {row}, Column {column}",
  "more.columns": "{count} Columns",
  "more.oneColumn": "1 Column",
  "more.actions": "Actions",
  "more.copy": "Copy",
  "more.cut": "Cut",
  "more.paste": "Paste below",
  "more.moveLeft": "Move to the Column before",
  "more.moveRight": "Move to the next Column",
  "more.onlyColumn": "It's in the only Column",
  "more.firstColumn": "It's in the first Column",
  "more.lastColumn": "It's in the last Column",
  "more.firstRow": "It's the first Row",
  "more.lastRow": "It's the last Row",
  "more.selectRow": "Select Row {row}",

  // Adding Blocks and Rows: the Add panel, and the picker on the Canvas.
  "add.add": "Add",
  "add.panel": "Add",
  "add.searchAll": "Search Blocks and Rows",
  "add.searchBlocks": "Search Blocks",
  "add.blocks": "Blocks",
  "add.emptyRows": "Empty Rows",
  "add.addBlock": "Add {type} Block",
  "add.addLayout": "Add {layout} Row",
  "add.here": "Add a Block here",
  /** Under the picker, where what's picked goes: "Adds below the Text, in Row 3". */
  "add.below": "Adds below the {type}, in Row {row}",
  "add.noBlock": "No Block called “{query}”",
  "add.nothing": "Nothing called “{query}”",
  "add.try": "Try Text, Image or Button.",

  // The Style Mode: the email's Email style, beside the Canvas.
  "style.title": "Email style",
  "style.lead": "Every Block uses these unless it sets its own.",
  "style.colors": "Colors",
  "style.page": "Page",
  "style.email": "Email",
  "style.text": "Text",
  "style.buttons": "Buttons",
  "style.links": "Links",
  "style.type": "Text",
  "style.headings": "Headings",
  "style.body": "Body",
  "style.heading1": "Heading 1",
  "style.heading2": "Heading 2",
  "style.heading3": "Heading 3",
  "style.bodyText": "Body text",
  "style.corners": "Button corners",
  "style.square": "Square",
  "style.rounded": "Rounded",
  "style.pill": "Pill",
  /** Beside a setting that isn't set, before the built-in value. */
  "style.default": "Default",
  "style.sameAsPage": "Same as page",
  "style.sameAsText": "Same as text",
  "style.sameAsBody": "Same as body",
  /** Under "Same as body" in the Headings font list. */
  "style.bodyFont": "{font}, the body font",
  "style.useDefault": "Use the default ({value})",
  "style.pixels": "{value}px",
  /** A size's field: "Heading 1 size". */
  "style.size": "{label} size",
  "style.defaultIs": "Default is {value}",
  /** A size's field, for screen readers: "Heading 1 size (px)". */
  "style.sizeField": "{size} ({unit})",
  "style.hex": "Hex",
  "style.inThisEmail": "In this email",
  /** The square that picks how saturated and bright a color is. */
  "style.shade": "{label} shade",
  "style.shadeValue": "Saturation {saturation}%, brightness {brightness}%",
  "style.hue": "Hue",
  "style.searchFonts": "Search fonts",
  "style.systemFonts": "System fonts",
  "style.noFont": "No font called “{query}”",
  /** On the email, over the first Block a hovered setting changes: "Heading 1 · 32px". */
  "style.reaches": "{label} · {value}",
  /** On the email, over a Block that keeps its own value as a setting changes. */
  "style.keepsOwn": "Keeps its own · {value}",
  // A selected Block's own values, each with a way to match the rest or share it.
  "style.own.makeIt": "Make it {shared}",
  "style.own.headingSize": "This Heading is {own}",
  "style.own.headingSizeWhy": "Every other Heading {level} is {shared}.",
  "style.own.headingSizeShare": "Make every Heading {level} {own}",
  "style.own.headingColor": "This Heading’s text is {own}",
  "style.own.textSize": "This Text is {own}",
  "style.own.textSizeWhy": "Other body text is {shared}.",
  "style.own.textSizeShare": "Make all body text {own}",
  "style.own.textColor": "This Text’s color is {own}",
  "style.own.colorWhy": "Other text is {shared}.",
  "style.own.colorShare": "Make all text {own}",
  "style.own.button": "This Button is {own}",
  "style.own.buttonWhy": "Other Buttons are {shared}.",
  "style.own.buttonShare": "Make every Button {own}",

  // The Rows list, beside the Canvas, and the email with no Rows.
  "rows.list": "Rows",
  /** A Row in the list: "Row 3 of 6: Heading, Text, Button". */
  "rows.item": "Row {position} of {count}: {blocks}",
  "rows.itemDesktopOnly": "Row {position} of {count}: {blocks}. Desktop only",
  "rows.noBlocks": "no Blocks yet",
  /** The mark on a Row in the list that isn't on phones. */
  "rows.desktopOnly": "Desktop only",
  /** A Row's tooltip from the keyboard, with the keys that move it. */
  "rows.moveKeys": "Row {position} of {count} ({up} or {down} to move)",
  "rows.collapse": "Collapse the Rows list",
  "rows.expand": "Expand the Rows list",
  "rows.add": "Add a Row",
  "rows.emptyRow": "Empty Row",
  "rows.addsBelow": "Adds below Row {row}",
  "rows.addsAtEnd": "Adds at the end",
  "rows.none": "No Rows yet",
  "rows.noneHint": "Add one here or on the email.",
  "canvas.startTitle": "Start with a Row",
  "canvas.startText": "Pick how many Columns it has. You can change it after.",

  // Settings fields.
  "settings.none": "None",
  "settings.picker": "{label} picker",
  "settings.unit": "({unit})",
  "settings.add": "Add",
  /** A list item's field, such as a Social link's URL, named with its item. */
  "settings.listItem": "{name} {label}",
  "settings.moveUp": "Move {name} up",
  "settings.moveDown": "Move {name} down",
  "settings.remove": "Remove {name}",
  "unit.px": "px",

  "field.alignment": "Alignment",
  "field.altText": "Alt text",
  "field.altText.description":
    "What a screen reader says, and what shows if images are off.",
  "field.backgroundColor": "Background color",
  "field.buttonLabel": "Label",
  "field.color": "Color",
  "field.font": "Font",
  "field.fontSize": "Font size",
  "field.height": "Height",
  "field.hideOnPhone": "Hide on phones",
  "field.hideOnPhone.description":
    "On screens under 480px wide. A few phone apps still show it.",
  "field.iconSize": "Icon size",
  "field.iconStyle": "Icon style",
  "field.iconStyle.description":
    "White is for a dark background. Some email apps' dark modes make a dark background light, which hides white icons. Color icons show on light and dark backgrounds.",
  "field.imageUrl": "Image URL",
  "field.imageUrl.description": "A URL, or a Merge Tag such as {{logo_url}}.",
  "field.imageWidth.description": "Leave empty to fill the Column.",
  "field.language": "Language",
  "field.language.description":
    "A language code, such as en or pt-BR, or one Merge Tag.",
  "field.level": "Level",
  "field.link": "Link",
  "field.link.description": "A URL, or a Merge Tag such as {{cta_url}}.",
  "field.link.needsAltText":
    "Add alt text first, as a screen reader says it for the link.",
  "field.paddingBottom": "Bottom padding",
  "field.paddingLeft": "Left padding",
  "field.paddingRight": "Right padding",
  "field.paddingTop": "Top padding",
  "field.preheader": "Preheader",
  "field.preheader.description":
    "The short text inboxes show after the subject.",
  "field.socialLinks": "Links",
  "field.socialLinks.allAdded": "Every network is added.",
  "field.socialLinks.choose": "Choose a network",
  "field.socialLinks.description":
    "Each URL can be a Merge Tag, such as {{facebook_url}}. A link without a URL shows faded, and isn't sent.",
  "field.socialUrl": "URL",
  "field.stackOnPhone": "Stack Columns on phones",
  "field.stackOnPhone.description":
    "On screens under 480px wide. Off keeps the Columns side by side.",
  "field.textColor": "Text color",
  "field.thickness": "Thickness",
  "field.width": "Width",

  "invalid.alignment": "Choose an alignment from the list.",
  "invalid.altText":
    "A linked Image needs alt text. To leave this empty, remove the link first.",
  "invalid.buttonLabel": "Enter the text the Button shows.",
  "invalid.color":
    "Use a color such as #ff0000, rgb(255, 0, 0) or rgba(255, 0, 0, 0.5).",
  "invalid.font": "Choose a font from the list.",
  "invalid.iconSize": "Choose a size from the list.",
  "invalid.iconStyle": "Choose a style from the list.",
  "invalid.imageUrl":
    "Use a URL that starts with https: or http:, such as https://example.com/logo.png, or a Merge Tag such as {{logo_url}}.",
  "invalid.language":
    "Use a language code such as en or pt-BR, or one Merge Tag such as {{language}}.",
  "invalid.level": "Choose a level from the list.",
  "invalid.link":
    "Use a URL that starts with https:, http:, mailto: or tel:, such as https://example.com, or a Merge Tag such as {{cta_url}}.",
  "invalid.pixelsAtLeast": "Use a whole number of pixels, {min} or more.",
  "invalid.pixelsBetween": "Use a whole number from {min} to {max}.",
  "invalid.preheader": "Use plain text.",
  "invalid.socialLinks": "Each network can be linked only once.",
  "invalid.solidColor": "Use a solid color such as #ff0000, or rgb(255, 0, 0).",
  "invalid.toggle": "Turn it on or off.",

  "align.left": "Left",
  "align.center": "Center",
  "align.right": "Right",
  "level.1": "Heading 1",
  "level.2": "Heading 2",
  "level.3": "Heading 3",
  "iconStyle.color": "Color",
  "iconStyle.white": "White",
  "iconSize.32": "32px",
  "iconSize.40": "40px",
  "iconSize.48": "48px",
  "font.arial": "Arial",
  "font.courierNew": "Courier New",
  "font.georgia": "Georgia",
  "font.tahoma": "Tahoma",
  "font.timesNewRoman": "Times New Roman",
  "font.verdana": "Verdana",
  "network.bluesky": "Bluesky",
  "network.facebook": "Facebook",
  "network.instagram": "Instagram",
  "network.linkedin": "LinkedIn",
  "network.pinterest": "Pinterest",
  "network.threads": "Threads",
  "network.tiktok": "TikTok",
  "network.website": "Website",
  "network.x": "X",
  "network.youtube": "YouTube",

  // What a screen reader is told about changes it can't see.
  "said.blockMoved":
    "Moved to Row {row}, Column {column}, position {position} of {count}.",
  "said.rowMoved": "Row moved to position {position} of {count}.",
  "said.blockAdded":
    "{type} Block added, Row {row}, Column {column}, position {position} of {count}.",
  "said.blockDeleted": "Block deleted.",
  "said.rowDeleted": "Row deleted.",
  "said.blockCopied":
    "Block copied, Row {row}, Column {column}, position {position} of {count}.",
  "said.rowCopied": "Row copied, position {position} of {count}.",
  "said.blockCut":
    "Block cut, Row {row}, Column {column}, position {position} of {count}.",
  "said.rowCut": "Row cut, position {position} of {count}.",
  "said.blockDuplicated":
    "Block duplicated, Row {row}, Column {column}, position {position} of {count}.",
  "said.rowDuplicated": "Row duplicated, position {position} of {count}.",
  "said.blockPasted":
    "Block pasted, Row {row}, Column {column}, position {position} of {count}.",
  "said.rowPasted": "Row pasted, position {position} of {count}.",
  "said.undoMovedBlock":
    "Undo moved a Block to Row {row}, Column {column}, position {position} of {count}.",
  "said.redoMovedBlock":
    "Redo moved a Block to Row {row}, Column {column}, position {position} of {count}.",
  "said.undoMovedRow": "Undo moved a Row to position {position} of {count}.",
  "said.redoMovedRow": "Redo moved a Row to position {position} of {count}.",
  "said.blockCantMoveUp": "The Block can't move up.",
  "said.blockCantMoveDown": "The Block can't move down.",
  "said.blockCantMoveLeft": "The Block can't move left.",
  "said.blockCantMoveRight": "The Block can't move right.",
  "said.rowCantMoveUp": "The Row can't move up.",
  "said.rowCantMoveDown": "The Row can't move down.",
  "said.itemAdded": "{name} added, position {position} of {count}.",
  "said.itemMoved": "{name} moved to position {position} of {count}.",
  "said.itemRemoved": "{name} removed.",

  // Pasting.
  "paste.notCopied": "Can't paste. What's copied isn't a Block or a Row.",
  "paste.newerVersion":
    "Can't paste. It was copied from a newer version of the editor.",
  "paste.invalid": "Can't paste. Something in what's copied isn't valid.",
  "paste.noUploads": "Can't paste. This editor can't upload images.",
  "paste.notAllowed":
    "Can't paste. The browser didn't let the editor read the clipboard. Paste with the keyboard or the browser's Edit menu instead.",

  // Uploading images.
  "upload.wrongType": "Use a PNG, JPEG or GIF image.",
  "upload.failed": "The image couldn't be uploaded.",
  "upload.ofFiles": "{files}: {message}",
  "upload.started": "Uploading image.",
  "upload.done": "Image uploaded.",

  // The Preview.
  "preview.title": "Preview",
  "preview.close": "Close",
  "preview.width": "Width",
  "preview.desktop": "Desktop",
  "preview.phone": "Phone",
  "preview.frame": "Email preview",
  "preview.loading": "Loading preview…",
  "preview.failed": "The preview couldn't be loaded: {reason}",

  // The Shell.
  "shell.email": "Email",
  "shell.saved": "Saved",
  "shell.notSaved": "Not saved",
  "shell.export": "Export",
  "shell.exportHtml": "HTML file",
  "shell.exportHtmlHelp": "The email, ready to send",
  "shell.exportJson": "JSON file",
  "shell.exportJsonHelp": "To open in Mail Quilt again",
  "shell.more": "More",
  "shell.importJson": "Import JSON…",
  /** The button in the message that the browser can't save. */
  "shell.exportJsonNow": "Export JSON",
  "shell.cantSave":
    "This browser can't save your email here. Export it as JSON to keep it.",
  "shell.cantSaveNoExport": "This browser can't save your email here.",
  "shell.cantOpen": "This email couldn't be opened: {reason}",
  "shell.cantOpenSaved": "Your saved email couldn't be opened: {reason}",
  "shell.cantImport": "That file couldn't be imported: {reason}",
  "shell.notJson": "Not valid JSON",
  "shell.cantRead": "The file couldn't be read",
  "shell.nothingToExport": "There's no email to export.",
  "shell.cantExport": "The HTML couldn't be exported: {reason}",
} as const;

/** The ID of one of the editor's texts. */
export type StringId = keyof typeof STRINGS;

/**
 * Texts that replace the editor's English, by ID, as `STRINGS` lists them. Any
 * left out keep their English.
 */
export type MailQuiltStrings = Readonly<Partial<Record<StringId, string>>>;
