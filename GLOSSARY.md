# Mail Quilt

A set of packages for building email design into a web app. Developers use the Shell, build their own page around the editor, or build on the document model underneath, and their users design emails with what they built.

## Language

### Email structure

**Row**:
A horizontal group of Columns in an email.
_Avoid_: Section

**Column**:
A vertical slot within a Row that holds Blocks.

**Layout**:
A preset of Column widths for a Row, such as 33/67.

**Block**:
A single piece of email content inside a Column, such as text, an image or a button.
_Avoid_: Element, widget, component

**Block type**:
One kind of Block, such as Text or Image, with settings of its own. Core holds the one list of them.

**Merge Tag**:
A named placeholder in email content, such as `{{first_name}}`, that is replaced with a recipient's value when the email is sent.
_Avoid_: Variable, placeholder

**List**:
A run of bulleted or numbered items in a Text Block.
_Avoid_: Bullets

**Social Block**:
A Block of linked icons, one for each network it links, such as Instagram or a website, in the person's order.
_Avoid_: Social links, social bar

**Stacking**:
A Row's Columns placed one under another on a phone, rather than side by side.
_Avoid_: Wrapping, collapsing

**Phone value**:
A second value of a setting, such as a font size or padding, used when the email is read on a phone. Unset, the phone uses the setting's own value.
_Avoid_: Mobile override, responsive value

**Decorative image**:
An Image marked as adding nothing to what the email says, so a screen reader skips it. It has no alt text and no link.
_Avoid_: Presentational image, empty alt

**Position**:
Where a Block or Row is in an email: its Column and index, or its index among the Rows. A screen reader hears it in words, such as "Row 1, Column 2, position 3 of 4".
_Avoid_: Place, location

### Editing

**Command**:
A request to change an email, such as moving a Block to another Column. It can be refused. ProseMirror's commands, which change a Block's text as it's typed, are text commands.
_Avoid_: Action

**Operation**:
A recorded change that actually happened to an email. One Command produces one or more Operations.
_Avoid_: Patch, event

**Canvas**:
The part of the editor that shows the email as a card at its own width, on a workspace background, where Blocks are selected, dragged and edited.

**Mode**:
One of the editor's three views of an email: Edit, Style and Check. Each has one job.
_Avoid_: Tab, view, step

**Selection bar**:
The bar above the Canvas that holds the settings and actions of the selected Block or Row, or of the email when nothing is selected.
_Avoid_: Toolbar, side panel, inspector

**Rows list**:
The list of an email's Rows, each shown as a small picture, beside the Canvas in Edit.
_Avoid_: Strip, rail, outline, layers

**Email style**:
The colors, fonts, text sizes and button corners that every Block in an email uses unless the Block sets its own.
_Avoid_: Theme, global styles, brand kit

**Check**:
The Mode that shows the exported email in an inbox, at desktop and phone width, and lists its Problems.
_Avoid_: Validation, audit, linter

**Problem**:
Something in an email that Check finds would go wrong for its readers, such as an Image without alt text. It warns, and never stops an export.
_Avoid_: Issue, error, warning

**Merge Tag picker**:
The list of the Host app's Merge Tags that opens when a person types `{{`, from which they pick one.
_Avoid_: Autocomplete, variable menu

**Preview**:
The real exported email, shown in Check inside an inbox at desktop and phone width.
_Avoid_: Mobile view

**Theme token**:
A CSS custom property starting with `--mq-` that sets one of the editor's own colors, spaces, corners or fonts, and that a host can override on the element. It never changes the email.

**Place**:
A part of the editor's own interface that focus, keys, a press or a drag finds by name, such as the Selection bar, the link field or the Rows list.
_Avoid_: Region, area

**Key scope**:
Where in the editor a key is answered: the innermost Place with keys of its own, or a state inside one, such as a Block's text with the Merge Tag picker open. A settings field holding typed text that isn't applied yet is a Place of its own.
_Avoid_: Place

### Product

**Host app**:
The web app that embeds Mail Quilt and supplies what the editor can't, such as storage for images and the list of Merge Tags.
_Avoid_: Client, integrator, consumer

**Playground**:
A public page in the docs site where anyone can try the editor. It is a Shell.
_Avoid_: Demo, hosted editor

**Shell**:
A ready-made editor page: the editor plus a header, Import and Export, and messages.
_Avoid_: Template, Kit

**Saved Row**:
A ready-made Row, with its Blocks, that a host offers its users to add to an email.
_Avoid_: Section, snippet, module, template

**Starter email**:
A ready-made email that a host offers its users to begin from, instead of an empty one.
_Avoid_: Template
