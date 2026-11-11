// The package ships no types. This is the part of its API `renderer` uses.
declare module "mjml-browser" {
  const mjml2html: (
    mjml: string,
    options: { fonts?: Record<string, string>; validationLevel: "strict" }
  ) => Promise<{ html: string }>;
  export default mjml2html;
}
