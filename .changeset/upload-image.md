---
"@mailquilt/editor": minor
"@mailquilt/react": minor
---

Image upload. Give `<mail-quilt>` an `uploadImage` function, which uploads a file to your own storage and returns `{ url }`, and the Image settings get an Upload image button beside the Image URL. `<mail-quilt-shell>` takes the same property, and `MailQuilt` and `MailQuiltShell` take it as a prop. The picker offers PNG, JPEG and GIF, and refuses other files before your function is called. While the upload runs, the Image Block shows "Uploading…", and the URL your function returns is checked as a typed Image URL is. A rejection's `Error` message is shown by the Image URL field and read out. Image files can also be dropped: one dropped on an Image Block sets its image, and files dropped elsewhere on the email each add an Image Block where they land, with the same drop line as a Block from the Content tab. The upload is aborted through `signal` when its Image Block is deleted, undone or replaced by a new `value`. The new `HostAppProperties` type lists the properties. [Upload images](https://editor.mailquilt.com/docs/upload-images) shows a pre-signed upload.
