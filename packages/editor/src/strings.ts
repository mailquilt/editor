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

  // The Canvas.
  "canvas.block":
    "{type} Block, Row {row}, Column {column}, position {position} of {count}",
  "canvas.blockTools": "Block tools",
  "canvas.dragBlock": "Drag Block",
  "canvas.moveBlockUp": "Move Block up",
  "canvas.moveBlockDown": "Move Block down",
  "canvas.moveBlockLeft": "Move Block left",
  "canvas.moveBlockRight": "Move Block right",
  "canvas.duplicateBlock": "Duplicate Block",
  "canvas.deleteBlock": "Delete Block",
  "canvas.row": "Row {row}",
  "canvas.rowTag": "Row",
  "canvas.dragRow": "Drag Row",
  "canvas.selectRow": "Select Row",
  "canvas.moveRowUp": "Move Row up",
  "canvas.moveRowDown": "Move Row down",
  "canvas.duplicateRow": "Duplicate Row",
  "canvas.deleteRow": "Delete Row",
  "canvas.hiddenOnPhones": "Hidden on phones",
  "canvas.dropHere": "Drop a Block here",
  "canvas.addToColumn": "Add a Block to Row {row}, Column {column}",
  "canvas.addHere": "Add {type} Block here",
  "canvas.emailTools": "Email tools",
  "canvas.undo": "Undo",
  "canvas.redo": "Redo",
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

  // The side panel.
  "side.panel": "Side panel",
  "side.content": "Content",
  "side.rows": "Rows",
  "side.settings": "Settings",
  "side.back": "Back",
  "side.block": "Block",
  "side.row": "Row",
  "side.email": "Email",
  "side.rowTitle": "Row {row}",
  "side.blockPlace": "Row {row}, Column {column}",
  "side.layoutOf": "{layout} layout",
  "side.customLayout": "Custom layout",
  "side.layout": "Layout",
  "side.blocks": "Blocks",
  "side.blocksHelp":
    "Drag one onto the email, or choose one to add it after the selected Block, into the selected Row, or at the end.",
  "side.addContent": "Add content",
  "side.addBlock": "Add {type} Block",
  "side.layouts": "Layouts",
  "side.layoutsHelp":
    "Drag one between Rows, or choose one to add it after the selected Row, or at the end of the email.",
  "side.addRow": "Add a Row",
  "side.addLayout": "Add {layout} Row",
  "side.uploadImage": "Upload image",

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
  "shell.importJson": "Import JSON",
  "shell.exportJson": "Export JSON",
  "shell.exportHtml": "Export HTML",
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
