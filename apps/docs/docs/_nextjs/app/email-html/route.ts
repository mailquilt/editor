import { renderEmail } from "@mailquilt/renderer";

/** Takes a saved email as JSON and answers with its HTML, ready to send. */
export const POST = async (request: Request) => {
  // In your app, this is the email you saved from the editor's onChange.
  const email = await request.json();
  try {
    const html = await renderEmail(email);
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    // The renderer refused the email. The message says why.
    return Response.json(
      { reason: error instanceof Error ? error.message : String(error) },
      { status: 422 }
    );
  }
};
