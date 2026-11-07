import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM = `You draft a short first-contact letter from a small affordable-housing nonprofit to a property owner or public agency, about one parcel.

Rules:
- Use ONLY the facts in the request. Never invent names, prices, statutes, deadlines or parcel facts.
- Anything the nonprofit must fill in goes in [square brackets], e.g. [Your name], [Organization], [phone].
- Address the owner as "Property owner" unless an agency name is given. Never guess a person's name.
- Plain, warm, respectful. 150–220 words. No subject line, no markdown, no bullet lists.
- Mention the law by name once, in plain words, and say the nonprofit is exploring, not making an offer.
- If ownership is only a lead (e.g. a place of worship mapped there), ask whether the institution owns the land rather than assuming it.
- End with a request for a short conversation and the sign-off placeholders.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return new Response("no-key", { status: 503 });
  }
  const body = (await req.json()) as { facts: string };
  if (!body?.facts || body.facts.length > 6000) return new Response("bad request", { status: 400 });

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    // Refusal fallback: if the model declines, the API re-runs on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Draft the letter from these facts:\n\n${body.facts}` }],
  });

  const encoder = new TextEncoder();
  const out = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\n[Draft unavailable for this parcel.]"));
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[Draft failed: ${e instanceof Anthropic.APIError ? e.status : "network"}]`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
