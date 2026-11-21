/**
 * A file dropped where the editor doesn't take it, such as on the Preview's
 * email or the Shell's header, would open in the tab, instead of the page and
 * the email. Dragged text still moves.
 */
export const refuseFiles = (event: DragEvent) => {
  if (event.dataTransfer?.types.includes("Files")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
  }
};
