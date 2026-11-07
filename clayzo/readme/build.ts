/**
 * Builds the README animations.
 *
 *   npx tsx clayzo/readme/build.ts [hero|sieve|architecture ...]
 *
 * Writes clayzo/readme/out/<id>.json. Font assets resolve to ../fonts/ beside it.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeDoc } from "./kit";
import { hero } from "./hero";
import { sieve, sieveCounts } from "./sieve";
import { architecture } from "./architecture";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const pieces: Record<string, () => Parameters<typeof writeDoc>[1]> = { hero, sieve, architecture };
const want = process.argv.slice(2);
for (const [id, build] of Object.entries(pieces)) {
  if (want.length && !want.includes(id)) continue;
  const doc = build();
  writeDoc(out, doc);
  console.log(`${id}: revision ${doc.revision}`);
}
console.log(`sieve lots: ${sieveCounts()}`);
