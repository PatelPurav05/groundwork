import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { researchStore, validApn } from "@/lib/server/researchStore";

/**
 * On-demand research for one lot's open questions (the checks no public layer answers):
 * Claude searches the web, then a second call turns its notes into cited findings.
 * Streams NDJSON: {type:"status",text} … then {type:"result",findings} or {type:"error",message}.
 */

const MODEL = "claude-opus-5-5";

export interface ResearchQuestion {
  id: string;
  label: string;
}
interface Body {
  /** Re-run even if saved research exists ("Research again"). */
  force?: boolean;
  apn: string;
  title: string;
  city: string;
  law: string;
  facts: string;
  questions: ResearchQuestion[];
}

const Finding = z.object({
  id: z.string(),
  answer: z.enum(["yes", "no", "unclear"]),
  summary: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
  confidence: z.enum(["low", "medium", "high"]),
});
const Findings = z.object({ findings: z.array(Finding) });
export type ResearchFinding = z.infer<typeof Finding>;

const RESEARCH_SYSTEM = `You research one land parcel for a small affordable-housing nonprofit screening sites in California. You are given the parcel, the housing law being considered, and a list of open questions that no public map layer could answer.

Use web search and web fetch to find public evidence for each question: city and county pages, staff reports, ordinances, historic registers, state agency records, news coverage, an institution's own website.

Hard rules:
- Never name, describe, or look up private individuals (homeowners, tenants, residents). Ownership research may only identify institutions: a congregation, a school or college, a public agency, a company. If the owner appears to be a private person, say only that ("appears privately owned") and stop.
- Do not search for or report anyone's contact details, finances, or personal history.
- Absence of evidence is not evidence. If you can't find a clear public source, the answer is unclear.
- Prefer primary sources (government sites, the institution itself, official registers) over aggregators.
- Spend at most a few searches per question; skip questions that can't be answered from public sources (for example, a single-family home's tenancy history) and say why.

Finish with short notes per question id: what you found, the answer (yes / no / unclear, where "yes" means the condition in the question is TRUE as phrased), and the URLs that support it.`;

const STRUCTURE_SYSTEM = `Convert research notes into findings. One finding per question id given. "yes" means the question's condition is true as phrased; "no" means it is false; "unclear" when the notes don't establish it with a cited source. Every non-unclear answer must cite at least one URL that appears in the notes; never invent URLs. Summaries: one or two plain sentences, no private individuals' names.`;

/** Saved research for one lot, for everyone who opens it. */
export async function GET(req: Request) {
  const apn = new URL(req.url).searchParams.get("apn");
  if (!validApn(apn)) return Response.json({ error: "bad apn" }, { status: 400 });
  try {
    return Response.json({ research: await researchStore().get(apn) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ research: {} });
  }
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "no-key" }, { status: 503 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!validApn(body?.apn) || !Array.isArray(body.questions) || !body.questions.length || body.questions.length > 12 || (body.facts?.length ?? 0) > 6000) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const questions = body.questions.map((q) => ({ id: String(q.id).slice(0, 60), label: String(q.label).slice(0, 200) }));
  const law = String(body.law).slice(0, 80);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        // Answer from saved research when it covers every question, unless asked to run again.
        if (!body.force) {
          const saved = (await researchStore().get(body.apn).catch(() => ({})))[law as never] as { findings: ResearchFinding[]; at: string } | undefined;
          if (saved && questions.every((q) => saved.findings.some((f) => f.id === q.id))) {
            send({ type: "result", findings: saved.findings, at: saved.at, saved: true });
            return;
          }
        }
        const client = new Anthropic();
        const prompt = `Parcel: ${body.title}, ${body.city}, California\n${body.facts}\n\nLaw being considered: ${body.law}\n\nOpen questions (id: question):\n${questions.map((q) => `- ${q.id}: ${q.label}?`).join("\n")}`;

        // Phase 1: research with server-side web tools. Resume paused server-tool turns.
        const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
        let notes = "";
        const urls = new Map<string, string>();
        for (let turn = 0; turn < 4; turn++) {
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 12000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "medium" },
            system: RESEARCH_SYSTEM,
            tools: [
              { type: "web_search_20260209", name: "web_search", max_uses: 8 },
              { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
            ],
            messages,
          });
          s.on("contentBlock", (b) => {
            if (b.type === "server_tool_use") {
              const input = b.input as { query?: string; url?: string };
              if (input.query) send({ type: "status", text: `Searching “${input.query}”` });
              else if (input.url) send({ type: "status", text: `Reading ${new URL(input.url).hostname}` });
            }
            if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
              for (const r of b.content) if (r.type === "web_search_result") urls.set(r.url, r.title);
            }
          });
          const msg = await s.finalMessage();
          for (const b of msg.content) if (b.type === "text") notes += b.text + "\n";
          if (msg.stop_reason === "refusal") throw new Error("refused");
          if (msg.stop_reason !== "pause_turn") break;
          messages.push({ role: "assistant", content: msg.content });
        }

        // Phase 2: structure the notes into findings (structured output; no web tools here).
        send({ type: "status", text: "Checking each answer against its sources" });
        const parsed = await client.messages.parse({
          model: MODEL,
          max_tokens: 6000,
          output_config: { effort: "low", format: zodOutputFormat(Findings) },
          system: STRUCTURE_SYSTEM,
          messages: [
            {
              role: "user",
              content: `Question ids: ${questions.map((q) => `${q.id} (${q.label})`).join("; ")}\n\nResearch notes:\n${notes.slice(0, 30000)}\n\nURLs seen in search results:\n${[...urls].map(([u, t]) => `${t} — ${u}`).slice(0, 60).join("\n")}`,
            },
          ],
        });
        const out = parsed.parsed_output?.findings ?? [];
        // Keep only findings for asked ids; drop any source URL the model didn't actually see.
        const seen = new Set([...urls.keys(), ...(notes.match(/https?:\/\/[^\s)\]>"']+/g) ?? [])]);
        const findings = questions.map((q) => {
          const f = out.find((x) => x.id === q.id);
          if (!f) return { id: q.id, answer: "unclear" as const, summary: "No public source found.", sources: [], confidence: "low" as const };
          const sources = f.sources.filter((s) => seen.has(s.url)).slice(0, 4);
          return sources.length || f.answer === "unclear" ? { ...f, sources } : { ...f, answer: "unclear" as const, sources, summary: `${f.summary} (No source could be confirmed.)` };
        });
        const at = new Date().toISOString();
        try {
          await researchStore().put({ apn: body.apn, law, at, questions, findings });
        } catch (e) {
          console.error("[research] couldn't save:", e);
        }
        send({ type: "result", findings, at });
      } catch (e) {
        send({ type: "error", message: e instanceof Anthropic.APIError ? `Claude API error ${e.status}` : e instanceof Error && e.message === "refused" ? "Claude declined this request." : "Research failed." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
