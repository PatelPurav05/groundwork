/**
 * Measures the drawn width of text runs that need something placed after them
 * (Clayzo starts every run on a new line, so an inline second colour has to be
 * placed by hand). Renders one probe frame with the real faces, reads the ink
 * extents with ffmpeg, and writes metrics.json.
 *
 *   npx tsx clayzo/readme/measure.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { C, buildDoc, run, text, writeDoc, type RunSpec } from "./kit";
import { MEASURE } from "./strings";

const here = dirname(fileURLToPath(import.meta.url));
const ROW = 80;
const Wd = 1400;
const Hd = ROW * MEASURE.length;
const nodes: Record<string, ReturnType<typeof text>> = {};
MEASURE.forEach((m, i) => {
  nodes[`m${i}`] = text(`m${i}`, 4, { x: 10, y: i * ROW + 4, w: 1380, runs: [run({ ...(m as RunSpec), color: C.ink })] });
});
const doc = buildDoc({ id: "measure", name: "measure", width: Wd, height: Hd, duration: 4, nodes, roots: Object.keys(nodes) });
const outDir = join(here, "out");
writeDoc(outDir, doc);
const tmp = mkdtempSync(join(tmpdir(), "gw-measure-"));
const png = join(tmp, "m.png");
execFileSync("clayzo", ["render-frame", join(outDir, "measure.json"), png, "--tick", "0"], { stdio: "ignore" });
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", png, "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 28 });
const metrics: Record<string, number> = {};
MEASURE.forEach((m, i) => {
  let maxX = 0;
  for (let y = i * ROW; y < (i + 1) * ROW; y++)
    for (let x = Wd - 1; x > maxX; x--)
      if (raw[y * Wd + x] < 200) {
        maxX = x;
        break;
      }
  metrics[`${m.font}|${m.size}|${m.weight}|${m.text}`] = maxX - 10 + 1;
});
writeFileSync(join(here, "metrics.json"), JSON.stringify(metrics, null, 1) + "\n");
execFileSync("rm", ["-f", join(outDir, "measure.json")]);
console.log(metrics);
