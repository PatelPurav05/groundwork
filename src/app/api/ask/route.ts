import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const runtime = "nodejs";

/** Turns "church land near a bus line, 10+ homes" into the same transparent filters the UI exposes. */
const Query = z.object({
  lens: z.enum(["faith", "public", "commercial", "starter", "backyard", "none"]),
  nearTransit: z.boolean(),
  openLand: z.boolean(),
  minHomes: z.number().int().nullable(),
  explanation: z.string(),
});

const SYSTEM = `You map a housing nonprofit's plain-language request onto a fixed set of search lenses and filters. Do not answer the question; only classify it.

Lenses:
- faith: land owned by churches, congregations, religious institutions or nonprofit colleges (SB 4)
- public: surplus public land offered for sale by a city, school district or agency (Surplus Land Act)
- commercial: strip malls, parking lots, underused retail or office land (AB 2011)
- starter: small subdivisions of up to 10 starter homes on multifamily or vacant single-family lots (SB 684 / SB 1123)
- backyard: splitting a single-family lot into up to 4 homes (SB 9)
- none: the request matches none of these

Filters: nearTransit (near frequent transit / bus / train), openLand (vacant or mostly empty), minHomes (an explicit minimum number of homes, else null).
explanation: one short sentence, in plain words, of how you read the request.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "no-key" }, { status: 503 });
  }
  const { q } = (await req.json()) as { q: string };
  if (!q || q.length > 500) return Response.json({ error: "bad request" }, { status: 400 });
  const client = new Anthropic();
  try {
    const res = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 1000,
      output_config: { effort: "low", format: zodOutputFormat(Query) },
      system: SYSTEM,
      messages: [{ role: "user", content: q }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return Response.json({ error: "unparsed" }, { status: 422 });
    return Response.json(res.parsed_output);
  } catch (e) {
    return Response.json({ error: e instanceof Anthropic.APIError ? `api ${e.status}` : "network" }, { status: 502 });
  }
}
