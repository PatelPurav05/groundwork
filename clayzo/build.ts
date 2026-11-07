/**
 * Builds the five lens documents.
 *
 *   npx tsx clayzo/build.ts
 *
 * Writes clayzo/out/<id>.json (the reviewed source of truth), copies each to
 * public/clayzo/lenses/<id>.json for the web player, writes the resting
 * frame as public/clayzo/lenses/<id>.svg, and refreshes the inline SVG
 * fallbacks in src/components/LensArt.tsx between its generated markers.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { restSvg } from "./lenses/shared";
import { faith } from "./lenses/faith";
import { publicLand } from "./lenses/public";
import { commercial } from "./lenses/commercial";
import { starter } from "./lenses/starter";
import { backyard } from "./lenses/backyard";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "clayzo/out");
const pubDir = join(root, "public/clayzo/lenses");
mkdirSync(outDir, { recursive: true });
mkdirSync(pubDir, { recursive: true });

const lenses = { faith, public: publicLand, commercial, starter, backyard } as const;
const svgs: Record<string, string> = {};

for (const [id, build] of Object.entries(lenses)) {
  const doc = build();
  const json = JSON.stringify(doc);
  writeFileSync(join(outDir, `${id}.json`), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(join(pubDir, `${id}.json`), json);
  const svg = restSvg(doc);
  writeFileSync(join(pubDir, `${id}.svg`), svg + "\n");
  svgs[id] = svg;
  console.log(`${id}: revision ${doc.revision}, ${(json.length / 1024).toFixed(1)} KB`);
}

const component = join(root, "src/components/LensArt.tsx");
const START = "// @generated-fallbacks-start";
const STOP = "// @generated-fallbacks-end";
try {
  const src = readFileSync(component, "utf8");
  const a = src.indexOf(START);
  const b = src.indexOf(STOP);
  if (a < 0 || b < a) throw new Error("markers not found");
  const body =
    `${START} (clayzo/build.ts writes this block)\n` +
    `const FALLBACK_SVG: Record<LensId, string> = ${JSON.stringify(svgs, null, 2)};\n`;
  writeFileSync(component, src.slice(0, a) + body + src.slice(b));
  console.log("updated LensArt.tsx fallbacks");
} catch (error) {
  console.warn(`LensArt.tsx fallbacks not updated: ${(error as Error).message}`);
}
