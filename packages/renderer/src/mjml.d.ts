// Neither package ships types. This is the part of their API `renderer` uses.
type Compile = (
  mjml: string,
  options: { validationLevel: "strict" }
) => Promise<{ html: string }>;

declare module "mjml" {
  const mjml2html: Compile;
  export default mjml2html;
}

declare module "mjml-browser" {
  const mjml2html: Compile;
  export default mjml2html;
}
