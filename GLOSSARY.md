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

**Side panel**:
The panel docked on the right of the Canvas, with Content, Rows and Settings tabs, which shows the selected Block's or Row's settings instead of its tabs.
_Avoid_: Sidebar, inspector

**Theme token**:
A CSS custom property starting with `--mq-` that sets one of the editor's own colors, spaces, corners or fonts, and that a host can override on the element. It never changes the email.

**Place**:
A part of the editor's own interface that focus, keys, a press or a drag finds by name, such as a Block's toolbar, the link field or the Side panel.
_Avoid_: Region, area

**Key scope**:
Where in the editor a key is answered: the innermost Place with keys of its own, or a settings field holding typed text that isn't applied yet.
_Avoid_: Place

### Product

**Playground**:
A public page in the docs site where anyone can try the editor. It is a Shell.
_Avoid_: Demo, hosted editor

**Shell**:
A ready-made editor page: the editor plus a header, Import and Export, and messages.
_Avoid_: Template, Kit

**Starter email**:
A ready-made email that a host offers its users to begin from, instead of an empty one.
_Avoid_: Template
