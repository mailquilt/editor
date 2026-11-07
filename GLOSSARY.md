# Mail Quilt

An embeddable email builder. Developers put it in their apps, and their users design emails with it.

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

**Merge Tag**:
A named placeholder in email content, such as `{{first_name}}`, that is replaced with a recipient's value when the email is sent.
_Avoid_: Variable, placeholder

### Editing

**Command**:
A request to change an email, such as moving a Block to another Column. It can be rejected.
_Avoid_: Action

**Operation**:
A recorded change that actually happened to an email. One Command produces one or more Operations.
_Avoid_: Patch, event

### Product

**Playground**:
A public page in the docs site where anyone can try the email editor.
_Avoid_: Demo, hosted editor
