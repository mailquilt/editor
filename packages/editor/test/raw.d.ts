/** A file's text, as Vite's `?raw` import gives it to a test. */
declare module "*?raw" {
  const text: string;
  export default text;
}
