/**
 * A file dropped anywhere in the editor, the Preview, the narrow notice and the
 * Shell too, would open in the tab, in place of the page and the email.
 * Dragged text still moves.
 */
export const refuseFiles = (event: DragEvent) => {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
  }
};
