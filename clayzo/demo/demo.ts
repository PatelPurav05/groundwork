/**
 * Groundwork demo video: 30 s, 1920x1080, 30 fps, with its own soundtrack.
 *
 *   npx tsx --tsconfig tsconfig.json clayzo/demo/extract.ts   # real numbers from the rules engine
 *   python3 clayzo/demo/map.py                                # parcel map images
 *   python3 clayzo/demo/music.py                              # the score
 *   npx tsx clayzo/demo/demo.ts                               # this document
 *
 * Every number, address and check on screen comes from the app's own engine over the cached
 * Santa Ana data (facts.json, mapdata.json). Nothing is invented; the home count is labelled
 * assumed, the unknown check stays a question, and the letter is the app's own template.
 *
 * Art direction
 *   Verb: sift. The county as it is (an oil painting) is printed as a two-ink riso, the print
 *   becomes the parcel map, the map is sieved down to the lots worth a call, and one lot opens.
 *   Geometry: knife strokes -> halftone dots -> parcel dots -> one parcel outline -> the mark.
 *   Palette: the painting's sunset, then the brand's two inks only (blue #1D3BA8 = what
 *   exists, coral #FF5A4E = the found thing) on stock #FBFBF8, ink #141B3C for words.
 *   Words: one short line at a time, Bricolage Grotesque; product copy in Inter Tight and
 *   Geist Mono exactly as the app sets it.
 *
 * Beats (s), on a 120 BPM grid (one bar = 2 s)
 *   0.0   painting fades up; "Orange County / needs homes."
 *   4.0   "Nonprofits find / land by luck."
 *   5.4   the painting prints as riso halftone, outward from the church's empty lot
 *   7.0   the halftone screen coarsens into the drop
 *   8.0   DROP: cut to the product. 57,926 Santa Ana parcels wave in
 *   9.5   five laws, in plain words, stamp in on the beat
 *   11.0  Church & college land (SB 4) is picked; the sieve runs
 *   11.5  -57,721 no place of worship mapped   13.0 -0 fire   14.0 -27 flood   15.0 -78 size
 *   16.0  90 lots worth a call, stamped coral
 *   17.0  zoom into 2130 N Grand Ave; its dot becomes its real parcel outline
 *   18.4  checks, each with its source; 20.0 the unknown stays a question
 *   21.4  Claude drafts the first letter (the app's template). Never sent.
 *   24.0  lockup: Groundwork, the tagline, Santa Ana, Orange County
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANIMATION_DOCUMENT_VERSION,
  assertValidAnimationDocument,
  base,
  constant,
  hex,
  keyed,
  marker,
  withComputedRevision,
  type Animatable,
  type Color,
  type CubicBezier,
  type PathContour,
  type SceneNode,
  type TextRun,
  type Vec3,
} from "@clayzo/animation/authoring";
import { C, EASE, IN, OUT, POP, both, ellipse, group, line, path, polyline, rect, rrContour, run, s, solid, text, tr, v3, type Nodes, type RunSpec } from "../readme/kit";
import { SLAB_D, STEM_D, gridMap, houseContours, svgToContours } from "../readme/logo";
import { painting } from "./painting";

const here = dirname(fileURLToPath(import.meta.url));
const OUTDIR = join(here, "out");

// ---------------------------------------------------------------- time
const W = 1920;
const H = 1080;
const TPS = 240;
const FPS = 30;
const FRAME = TPS / FPS; // 8 ticks
/** Seconds to ticks, snapped to the 30 fps frame grid. */
const T = (sec: number) => Math.round(sec * FPS) * FRAME;
const D = T(30);

const B = {
  title2: 4.0,
  printIn: 5.4,
  printDone: 7.0,
  drop: 8.0,
  laws: 9.5,
  sieve: 11.0,
  cut1: 11.5,
  cut2: 13.0,
  cut3: 14.0,
  cut4: 15.0,
  found: 16.0,
  zoom: 17.0,
  zoomEnd: 18.2,
  checks: 18.4,
  unknown: 20.0,
  letter: 21.4,
  outro: 24.0,
};

/** A softer landing for big moves (zoom, slides). */
const GLIDE: CubicBezier = { x1: 0.65, y1: 0, x2: 0.25, y2: 1 };

// ---------------------------------------------------------------- data
const facts = JSON.parse(readFileSync(join(here, "facts.json"), "utf8"));
const faith = facts.lenses.find((l: { id: string }) => l.id === "faith");
const hero = faith.top[0];
const map = JSON.parse(readFileSync(join(OUTDIR, "mapdata.json"), "utf8"));
const fmt = (n: number) => n.toLocaleString("en-US");
const steps = faith.steps as { removed: number; remaining: number; cut: string }[];
if (steps[0].removed !== 57721 || faith.survivors !== 90 || hero.address !== "2130 N GRAND AVE") {
  throw new Error("facts.json changed: re-read the copy in demo.ts before rebuilding");
}

// ---------------------------------------------------------------- node helpers
const nodes: Nodes = {};
const add = (n: SceneNode) => ((nodes[n.id] = n), n.id);

type Opts = {
  inTick?: number;
  x?: number;
  y?: number;
  position?: Animatable<Vec3>;
  scale?: number | Animatable<Vec3>;
  anchor?: { x: number; y: number };
  opacity?: number | Animatable<number>;
  blendMode?: string;
};
function baseOf(id: string, out: number, o: Opts) {
  const b: Record<string, unknown> = { outTick: out };
  if (o.inTick) b.inTick = o.inTick;
  if (o.anchor) b.anchor = o.anchor;
  if (o.scale !== undefined) b.scale = o.scale;
  if (o.opacity !== undefined) b.opacity = o.opacity;
  if (o.position) b.position = o.position;
  else Object.assign(b, { x: o.x ?? 0, y: o.y ?? 0 });
  const n = base(id, b as never) as unknown as Record<string, unknown>;
  if (o.blendMode) n.blendMode = o.blendMode;
  return n;
}

function image(id: string, out: number, o: Opts & { asset: string; w: number; h: number }) {
  return add({ ...baseOf(id, out, o), type: "image", assetId: o.asset, size: constant({ width: o.w, height: o.h }), fit: "fill" } as never);
}

const num = (id: string, name: string, value: number | Animatable<number>, min = -1e5, max = 1e5) => ({
  id: `${id}-${name}`,
  name,
  valueType: "number",
  value: typeof value === "number" ? constant(value) : value,
  minimum: min,
  maximum: max,
});
const col = (id: string, name: string, c: Color) => ({ id: `${id}-${name}`, name, valueType: "color", value: constant(c) });
const pt = (id: string, name: string, x: number, y: number) => ({
  id: `${id}-${name}`,
  name,
  valueType: "point",
  value: constant({ x, y }),
  minimum: { x: -1e5, y: -1e5 },
  maximum: { x: 1e5, y: 1e5 },
});

/** A keyed track that tolerates keys at the same tick (later wins) and sorts them. */
function track<V>(id: string, keys: [number, V, (CubicBezier | "linear" | "hold")?][]) {
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  const out: typeof keys = [];
  for (const k of sorted) {
    if (out.length && out[out.length - 1][0] === k[0]) out[out.length - 1] = k;
    else out.push(k);
  }
  return tr(id, out as never) as Animatable<V>;
}

/** Display type: Bricolage Grotesque 800 with the brand's tight tracking. */
function displayRun(t: string, size: number, color: Color, lh = Math.round(size * 1.08)): TextRun {
  return run({ text: t, font: "display", size, weight: 800, color, lineHeight: lh });
}
function tracked(n: SceneNode, size: number, em = -0.03) {
  (n as unknown as Record<string, unknown>).animators = [
    { id: `${n.id}.trk`, selector: { start: 0, end: 400, units: "characters" }, tracking: constant(em * size) },
  ];
  return n;
}

/**
 * One line of words that settles in (rise 22 px + fade) and leaves (fade + lift).
 * (x, y) is the top-left of the line's box.
 */
function settleLine(id: string, o: { x: number; y: number; w: number; runs: TextRun[]; tIn: number; tOut?: number; dy?: number; align?: "left" | "center"; size?: number }) {
  const dy = o.dy ?? 22;
  const tIn = T(o.tIn);
  const pos: [number, Vec3, (CubicBezier | "hold")?][] = [[tIn, v3(o.x, o.y + dy), OUT], [tIn + T(0.55), v3(o.x, o.y), "hold"]];
  const op: [number, number, (CubicBezier | "hold" | "linear")?][] = [[tIn, 0, OUT], [tIn + T(0.4), 1, "hold"]];
  const hardCut = o.tOut !== undefined && o.tOut >= B.outro; // leaves on the outro's hard cut
  if (o.tOut !== undefined && !hardCut) {
    pos.push([T(o.tOut), v3(o.x, o.y), IN], [T(o.tOut) + T(0.25), v3(o.x, o.y - 12)]);
    op.push([T(o.tOut), 1, IN], [T(o.tOut) + T(0.22), 0]);
  }
  const n = text(id, o.tOut === undefined ? D : hardCut ? T(B.outro) : T(o.tOut) + T(0.3), {
    inTick: tIn,
    w: o.w,
    align: o.align ?? "left",
    runs: o.runs,
    position: track(`${id}.pos`, pos),
    opacity: track(`${id}.op`, op),
  });
  if (o.size) tracked(n, o.size);
  return add(n);
}

/** A two-line display statement for the sheet or the painting. */
function statement(id: string, lines: string[], o: { x: number; y: number; size: number; tIn: number; tOut?: number; color?: Color; w?: number }) {
  const lh = Math.round(o.size * 1.08);
  return lines.map((l, i) =>
    settleLine(`${id}${i}`, {
      x: o.x,
      y: o.y + i * lh,
      w: o.w ?? 900,
      runs: [displayRun(l, o.size, o.color ?? C.ink, lh)],
      tIn: o.tIn + i * 0.1,
      tOut: o.tOut !== undefined ? o.tOut + i * 0.04 : undefined,
      size: o.size,
    }),
  );
}

/** Fade a group in and out as one (isolated, so overlaps don't double). */
function fadeGroup(id: string, kids: string[], tIn: number, tOut: number, o: { dx?: number; dy?: number; inDur?: number } = {}) {
  const a = T(tIn);
  const b = T(tOut);
  const dx = o.dx ?? 0;
  const dy = o.dy ?? 0;
  const hardCut = tOut >= B.outro; // leaves on the outro's hard cut
  const pos: [number, Vec3, (CubicBezier | "hold")?][] = [[a, v3(dx, dy), OUT], [a + T(0.5), v3(0, 0), "hold"]];
  const op: [number, number, (CubicBezier | "hold")?][] = [[a, 0, OUT], [a + T(o.inDur ?? 0.35), 1, "hold"]];
  if (!hardCut) {
    pos.push([b, v3(0, 0), IN], [b + T(0.25), v3(0, -10)]);
    op.push([b, 1, IN], [b + T(0.22), 0]);
  }
  return add(
    group(id, hardCut ? T(B.outro) : b + T(0.3), kids, {
      inTick: a,
      isolation: true,
      position: track(`${id}.pos`, pos),
      opacity: track(`${id}.op`, op),
    }),
  );
}

const R = (spec: Omit<RunSpec, "color"> & { color?: Color }) => run({ color: C.ink, ...spec } as RunSpec);

// =====================================================================================
// 1. The painting, printed  [0, 8)
// =====================================================================================
const P_END = T(B.drop);
const paintPhase = keyed<number>("paint.phase", [[0, 0, "linear"], [P_END, 2.4]]);
const paintId = painting(nodes, P_END, paintPhase);

const printSksl = (() => {
  const read = (f: string) => readFileSync(join(here, "shaders", f), "utf8");
  const [uniforms, body] = read("print.sksl").split("//#body");
  return [read("head.sksl"), uniforms, "uniform float2 renderScale;\n", read("common.sksl"), body].join("\n");
})();
const PRINT = "print";
add({
  ...baseOf(PRINT, P_END, {}),
  type: "effect",
  inputId: paintId,
  effect: "custom-sksl",
  implementation: printSksl,
  parameters: [
    num(PRINT, "cell", track("print.cell", [[0, 13, "hold"], [T(B.printDone), 13, { x1: 0.5, y1: 0, x2: 0.9, y2: 0.5 }], [T(7.95), 46]]), 1, 200),
    num(PRINT, "exposure", 0.04, -1, 1),
    num(PRINT, "contrast", 1.35, 0, 8),
    num(PRINT, "gamma", 1.1, 0.1, 8),
    num(PRINT, "invert", 0, 0, 1),
    col(PRINT, "ink", C.blue),
    col(PRINT, "paper", C.stock),
    num(PRINT, "phase", keyed<number>("print.phase", [[0, 0, "linear"], [P_END, 1]]), 0, 1),
    num(PRINT, "angle", 15, -180, 180),
    num(PRINT, "softness", 1, 0, 8),
    pt(PRINT, "center", 1180, 930),
    num(PRINT, "progress", track("print.progress", [[0, 0, "hold"], [T(B.printIn), 0, { x1: 0.45, y1: 0, x2: 0.25, y2: 1 }], [T(B.printDone), 1]]), 0, 1),
    num(PRINT, "reach", 1560, 0, 4000),
    num(PRINT, "band", 280, 1, 2000),
    num(PRINT, "bandCell", 12, 1, 200),
    pt(PRINT, "origin", 960, 540),
    num(PRINT, "warmGain", 1.7, 0, 10),
    pt(PRINT, "misreg", 3, 2),
    col(PRINT, "coral", C.coral),
  ],
  capability: { requires: ["runtime-effect"], fallback: "passthrough", maxTemporarySurfaces: 1 },
} as never);
// A slow push-in over the whole canvas, like a camera moving toward the painting.
add(
  group("shot1", P_END, [PRINT], {
    anchor: { x: 960, y: 560 },
    position: constant(v3(960, 560)),
    scale: track("shot1.sc", [[0, s(1), "linear"], [P_END, s(1.055)]]),
    opacity: track("shot1.op", [[0, 0, OUT], [T(0.6), 1]]),
  }),
);
const titles1 = [
  ...statement("t1", ["Orange County", "needs homes."], { x: 116, y: 104, size: 120, tIn: 0.5, tOut: 3.55 }),
  ...statement("t2", ["Nonprofits find", "land by luck."], { x: 116, y: 104, size: 120, tIn: B.title2, tOut: 7.62 }),
];

// =====================================================================================
// 2. The product  [8, 24): map on the right, the sheet on the left
// =====================================================================================
const P2 = T(B.drop);
const P2_END = T(B.outro);
const SHEET_W = 760;
const PADX = 80;

add(rect("mapGround", P2_END, { inTick: P2, x: SHEET_W + (W - SHEET_W) / 2, y: H / 2, w: W - SHEET_W, h: H, r: 0, style: solid(C.stock2) }));

// ---------------------------------------------------------------- the map
const mapKids: string[] = [];
const IMG = map.image;
const ringIds: string[] = [];
const waveIn = (d: number) => T(B.drop + d * 0.6);
const waveCut = (d: number) => T(B.cut1 + d * 0.75);
const TINT = 0.13;
map.rings.forEach((r: { file: string; r: number }, k: number) => {
  const id = `ring${k}`;
  const ti = waveIn(r.r);
  const tc = waveCut(r.r);
  image(id, P2_END, {
    inTick: P2,
    asset: `img-ring${k}`,
    x: IMG.x + IMG.w / 2,
    y: IMG.y + IMG.h / 2,
    w: IMG.w,
    h: IMG.h,
    opacity: track(`${id}.op`, [
      [P2, 0, "hold"],
      [ti, 0, OUT],
      [ti + T(0.3), 1, "hold"],
      [tc, 1, OUT],
      [tc + T(0.4), TINT, "hold"],
      [T(17.6), TINT, IN],
      [T(18.1), 0],
    ]),
  });
  ringIds.push(id);
});
mapKids.push(...ringIds);

// The zoomed neighbourhood: screen-resolution dots and outlines, faded in as the zoom lands.
const Z = map.zoomImage;
image("zoomImg", P2_END, {
  inTick: T(17.4),
  asset: "img-zoom",
  x: Z.x + Z.w / 2,
  y: Z.y + Z.h / 2,
  w: Z.w,
  h: Z.h,
  opacity: track("zoomImg.op", [[T(17.4), 0, "linear"], [T(18.1), 0.2]]),
});
mapKids.push("zoomImg");

// Survivors of step 1: vector dots that grow as the cut passes, then fall away or stamp coral.
type Surv = { x: number; y: number; step: number; d: number; dup: boolean; apn: string };
const surv: Surv[] = map.survivors;
const finals = surv.filter((p) => p.step === -1 && !p.dup).sort((a, b) => a.x + a.y * 0.6 - (b.x + b.y * 0.6));
const DOT = map.layout.dot as number;
const BIG = 3.3; // survivor dots grow to ~9 px so they read after the cut
/** The 90 coral stamps land in a 0.6 s sweep across the city. */
const stampAt = (k: number) => T(B.found + (k / finals.length) * 0.6);
const survIds: string[] = [];
const coralIds: string[] = [];
surv.forEach((p, i) => {
  const id = `s${i}`;
  const ti = waveIn(p.d);
  const tg = waveCut(p.d);
  const scale: [number, Vec3, (CubicBezier | "hold")?][] = [[0, s(1), "hold"], [tg, s(1), POP], [tg + T(0.35), s(BIG), "hold"]];
  const op: [number, number, (CubicBezier | "hold")?][] = [[P2, 0, "hold"], [ti, 0, OUT], [ti + T(0.3), 1, "hold"]];
  const fallAway = (t: number) => {
    scale.push([t, s(BIG), OUT], [t + T(0.4), s(1)]);
    op.push([t, 1, OUT], [t + T(0.4), TINT, "hold"]);
  };
  if (p.step === 3) fallAway(T(B.cut3 + p.d * 0.4));
  else if (p.step === 4) fallAway(T(B.cut4 + p.d * 0.45));
  else if (p.step === -1) {
    // Under its coral stamp the blue drops to tint, so the two inks never fight.
    const k = p.dup ? -1 : finals.indexOf(p);
    const t = stampAt(Math.max(0, k)) + T(0.1);
    op.push([t, 1, "hold"], [t + FRAME, TINT, "hold"]);
    scale.push([t, s(BIG), "hold"], [t + FRAME, s(1), "hold"]);
  }
  op.push([T(17.2), op[op.length - 1][1], IN], [T(17.6), 0]);
  add(ellipse(id, P2_END, { inTick: P2, x: p.x, y: p.y, w: DOT, h: DOT, scale: track(`${id}.sc`, scale), style: solid(C.blue, track(`${id}.op`, op)) }));
  survIds.push(id);
});
const heroIdx = finals.findIndex((p) => p.apn === hero.apn);
if (heroIdx < 0) throw new Error("hero lot is not among the final survivors");
finals.forEach((p, k) => {
  const id = `f${k}`;
  const t = stampAt(k);
  const isHero = k === heroIdx;
  add(
    ellipse(id, P2_END, {
      inTick: t,
      x: p.x,
      y: p.y,
      w: 12,
      h: 12,
      scale: track(`${id}.sc`, [[t, s(0.4), POP], [t + T(0.3), s(1)]]),
      style: solid(
        C.coral,
        track(`${id}.op`, [[t, 0, OUT], [t + T(0.12), 1, "hold"], [T(17.15), 1, IN], [T(isHero ? 17.7 : 17.5), 0]]),
      ),
    }),
  );
  coralIds.push(id);
});
// The hero lot's real outline, from the assessor parcel: coral over a blue plate a hair out of register.
const outline: [number, number][] = map.hero.outline;
const ZOOM = map.layout.zoom as number;
const heroContour = polyline(outline, true);
add(
  path("heroBlue", P2_END, {
    inTick: T(17.3),
    x: 1.6 / ZOOM,
    y: 1.2 / ZOOM,
    contours: [heroContour],
    style: line(C.blue, 3 / ZOOM, track("heroBlue.op", [[T(17.3), 0, "linear"], [T(17.9), 1]])),
  }),
);
add(path("heroFill", P2_END, { inTick: T(17.3), contours: [heroContour], style: solid(C.coral, track("heroFill.op", [[T(17.3), 0, "linear"], [T(17.8), 1]])) }));
mapKids.push(...survIds, ...coralIds, "heroFill", "heroBlue");

// The zoom: exponential scale about the hero lot, which glides to its place on screen.
const [HSX, HSY] = map.layout.heroScreen as [number, number];
const HX = map.hero.x as number;
const HY = map.hero.y as number;
const zoomPos: [number, Vec3, "linear" | "hold"][] = [[0, v3(HX, HY), "hold"]];
const zoomSc: [number, Vec3, "linear" | "hold"][] = [[0, s(1), "hold"]];
{
  const a = T(B.zoom);
  const b = T(B.zoomEnd);
  for (let t = a; t <= b; t += FRAME) {
    const u = (t - a) / (b - a);
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const zs = Math.exp(Math.log(ZOOM) * e);
    // Keep the lot's screen path straight: lerp its screen position on the same ease.
    zoomPos.push([t, v3(HX + (HSX - HX) * e, HY + (HSY - HY) * e), "linear"]);
    zoomSc.push([t, s(zs), "linear"]);
  }
}
add(group("map", P2_END, mapKids, { inTick: P2, anchor: { x: HX, y: HY }, position: track("map.pos", zoomPos), scale: track("map.sc", zoomSc) }));

// A tag beside the lot once it is big.
{
  const ax = HSX + 92;
  const ay = HSY - 94;
  const kids = [
    add(rect("tagBox", P2_END, { inTick: T(18.0), x: ax + 78, y: ay, w: 156, h: 44, r: 22, style: solid(C.ink) })),
    add(text("tagText", P2_END, { inTick: T(18.0), x: ax, y: ay - 13, w: 156, align: "center", runs: [R({ text: "6.2 acres", font: "ui", size: 21, weight: 600, color: C.stock, lineHeight: 26 })] })),
  ];
  fadeGroup("tag", kids, 18.0, 21.3, { dy: 8 });
}

// ---------------------------------------------------------------- the sheet
add(rect("sheet", P2_END, { inTick: P2, x: SHEET_W / 2, y: H / 2, w: SHEET_W, h: H + 4, r: 0, style: solid(C.stock) }));
add(rect("sheetEdge", P2_END, { inTick: P2, x: SHEET_W, y: H / 2, w: 1.5, h: H, r: 0, style: solid(C.ink, 0.12) }));

const ST = { x: PADX, y: 66, size: 60, w: 680 };
const st = [
  ...statement("s2", ["Groundwork finds", "it on purpose."], { ...ST, tIn: 8.1, tOut: 10.85 }),
  ...statement("s3", ["Sifted one law", "at a time."], { ...ST, tIn: 11.05, tOut: 16.85 }),
  ...statement("s4", ["Every check", "names its source."], { ...ST, tIn: 17.3, tOut: 19.85 }),
  ...statement("s5", ["Unknown stays", "a question."], { ...ST, tIn: 20.0, tOut: 21.25 }),
  ...statement("s6", ["Claude drafts", "the first letter."], { ...ST, tIn: 21.4, tOut: B.outro }),
];

// Counter: blue over coral, the two inks sliding into register as it lands.
const CTOP = 214;
const counterRuns = (c: Color) => (v: number) => [run({ text: fmt(v), font: "display", size: 150, weight: 800, color: c, lineHeight: 150 })];
function counterKeys(c: Color) {
  const n = counterRuns(c);
  const keys: [number, TextRun[], "hold"][] = [[0, n(57926), "hold"]];
  const tick = (from: number, to: number, t0: number, dur: number, stepsN: number) => {
    for (let k = 1; k <= stepsN; k++) {
      const u = k / stepsN;
      const e = 1 - Math.pow(1 - u, 3);
      keys.push([T(t0) + Math.round((u * T(dur)) / FRAME) * FRAME, n(k === stepsN ? to : Math.round(from + (to - from) * e)), "hold"]);
    }
  };
  tick(57926, steps[0].remaining, B.cut1, 0.9, 18);
  tick(steps[1].remaining, steps[2].remaining, B.cut3, 0.4, 8);
  tick(steps[2].remaining, steps[3].remaining, B.cut4, 0.5, 10);
  keys.push([T(B.found), n(faith.survivors), "hold"]);
  return keys;
}
const counterOp = track("counter.op", [[P2, 1, "hold"], [T(16.92), 1, IN], [T(17.2), 0]]);
const register = (id: string) =>
  track(`${id}.pos`, [
    [P2, v3(PADX - 4 + 16, CTOP + 12), OUT],
    [P2 + T(0.6), v3(PADX - 4 + 3, CTOP + 2.5), "hold"],
    [T(B.found), v3(PADX - 4 + 14, CTOP + 10), OUT],
    [T(B.found) + T(0.6), v3(PADX - 4 + 3, CTOP + 2.5)],
  ]);
add(
  tracked(
    text("counterCoral", P2_END, { inTick: P2, w: 680, runs: track("counterCoral.runs", counterKeys(C.coral) as never), position: register("counterCoral"), opacity: counterOp }),
    150,
    -0.02,
  ),
);
add(
  tracked(
    text("counter", P2_END, {
      inTick: P2,
      x: PADX - 4,
      y: CTOP,
      w: 680,
      runs: track("counter.runs", counterKeys(C.blue) as never),
      opacity: track("counter.op2", [[P2, 1, "hold"], [T(16.92), 1, IN], [T(17.2), 0]]),
    }),
    150,
    -0.02,
  ),
);
const labelRun = (t: string, c: Color) => [R({ text: t, font: "ui", size: 28, weight: 500, color: c, lineHeight: 34 })];
add(
  text("counterLabel", P2_END, {
    inTick: P2,
    x: PADX,
    y: 384,
    w: 680,
    runs: track("counterLabel.runs", [[P2, labelRun("parcels in Santa Ana, Orange County", C.muted), "hold"], [T(B.found), labelRun(`lots worth a call under ${faith.law}`, C.ink), "hold"]] as never),
    opacity: track("counterLabel.op", [[P2, 0, OUT], [P2 + T(0.4), 1, "hold"], [T(B.found) - T(0.12), 1, IN], [T(B.found), 0, OUT], [T(B.found) + T(0.3), 1, "hold"], [T(16.92), 1, IN], [T(17.2), 0]]),
  }),
);

// ---------------------------------------------------------------- the five laws, as the app names them
type LensRow = { id: string; name: string; law: string };
const LENS_ROWS: LensRow[] = [
  { id: "faith", name: "Church & college land", law: "SB 4" },
  { id: "public", name: "Public land for sale", law: "Surplus Land Act" },
  { id: "commercial", name: "Underused commercial lots", law: "AB 2011" },
  { id: "starter", name: "Room for 10 starter homes", law: "SB 684 / SB 1123" },
  { id: "backyard", name: "Big backyards", law: "SB 9" },
];
const ROW0 = 462;
const ROW_H = 96;

/** The app's lens pictograms (src/components/LensIcon.tsx), 64 grid, drawn at k px per unit. */
function pictogram(id: string, lens: string, ox: number, oy: number, k: number, out: number, inTick: number): string[] {
  const g = gridMap(k, ox, oy);
  const ids: string[] = [];
  const poly = (pid: string, pts: [number, number][], c: Color) =>
    ids.push(add(path(`${id}.${pid}`, out, { inTick, contours: [polyline(pts.map(([x, y]) => g(x, y)), true)], style: solid(c) })));
  const svg = (pid: string, d: string, c: Color) => ids.push(add(path(`${id}.${pid}`, out, { inTick, contours: svgToContours(d, g), style: solid(c) })));
  const box = (pid: string, x: number, y: number, w: number, h: number, c: Color, r = 0.6) =>
    ids.push(add(path(`${id}.${pid}`, out, { inTick, contours: [rrContour(ox + x * k, oy + y * k, w * k, h * k, r * k)], style: solid(c) })));
  const home = (pid: string, x: number, w: number, h: number, c: Color, door = true) => {
    const top = 52 - h;
    poly(pid, [[x, top], [x + w / 2, top - w * 0.42], [x + w, top], [x + w, 52], [x, 52]], c);
    if (door) {
      const dw = Math.max(3, w * 0.24);
      const dh = Math.min(h * 0.55, 8);
      box(`${pid}d`, x + w / 2 - dw / 2, 52 - dh, dw, dh, C.stock2, 1);
    }
  };
  if (lens === "faith") {
    svg("chapel", "M9 52V31l9-8 9 8v21Z", C.blue);
    svg("spire", "M16.5 23.5V12.6c0-.5.3-.9.7-1.1L18 11l.8.5c.4.2.7.6.7 1.1v10.9Z", C.blue);
    svg("door", "M15.5 52v-7.5a2.5 2.5 0 0 1 5 0V52Z", C.stock2);
    home("home", 33, 20, 13, C.coral);
  } else if (lens === "public") {
    svg("ped", "M7 30.5 20 23l13 7.5Z", C.blue);
    box("beam", 8, 31.5, 24, 3, C.blue);
    [10.5, 17.75, 25].forEach((cx, i) => box(`col${i}`, cx, 36, 4.5, 13, C.blue));
    box("step", 7, 49, 26, 3, C.blue, 0);
    home("home", 38, 18, 12, C.coral);
  } else if (lens === "commercial") {
    box("tower", 20, 16, 24, 36, C.coral, 1.5);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) box(`w${r}${c}`, 25 + c * 9, 21 + r * 7, 5, 3.5, C.stock2, 0.8);
    box("mall", 6, 38, 52, 14, C.blue, 1.5);
    box("band", 6, 38, 52, 3.5, hex("#16308E"), 1);
    [10, 22, 34, 46].forEach((x, i) => box(`sf${i}`, x, 44.5, 8, 7.5, C.stock2, 0.8));
  } else if (lens === "starter") {
    [
      { x: 6, w: 11, h: 11 },
      { x: 19, w: 11, h: 14 },
      { x: 32, w: 11, h: 11 },
      { x: 45, w: 11, h: 14 },
    ].forEach((p, i) => {
      home(`h${i}`, p.x, p.w, p.h, C.coral, false);
      box(`h${i}d`, p.x + p.w / 2 - 1.5, 47, 3, 5, C.stock2, 0.7);
    });
  } else if (lens === "backyard") {
    home("main", 7, 22, 16, C.blue);
    for (let y = 12; y < 52; y += 5) box(`split${y}`, 34.2, y, 1.6, 2.4, C.ink, 0.6);
    home("adu", 40, 17, 12, C.coral);
  }
  box("ground", 4, 52, 56, 2.5, C.ink, 1.25);
  return ids;
}

const lawRowIds: string[] = [];
LENS_ROWS.forEach((L, k) => {
  const top = ROW0 + k * ROW_H;
  const t0 = B.laws + k * 0.25;
  const tOut = k === 0 ? 16.9 : 10.95 + k * 0.03;
  const ids: string[] = [];
  ids.push(add(rect(`law${k}.tile`, D, { inTick: T(t0), x: PADX + 38, y: top + 46, w: 76, h: 76, r: 14, style: solid(C.stock2) })));
  ids.push(...pictogram(`law${k}.pic`, L.id, PADX + 38 - 32 * 0.95, top + 46 - 32 * 0.95, 0.95, D, T(t0)));
  ids.push(add(text(`law${k}.name`, D, { inTick: T(t0), x: PADX + 100, y: top + 12, w: 560, runs: [R({ text: L.name, font: "ui", size: 29, weight: 600, lineHeight: 34 })] })));
  ids.push(add(text(`law${k}.law`, D, { inTick: T(t0), x: PADX + 100, y: top + 50, w: 560, runs: [R({ text: L.law, font: "ui", size: 21, weight: 500, color: C.muted, lineHeight: 26 })] })));
  lawRowIds.push(fadeGroup(`law${k}`, ids, t0, tOut, { dx: 26 }));
});
// The chosen law gets the selected row ground.
add(
  rect("lawPick", T(16.9) + T(0.3), {
    inTick: T(B.sieve),
    x: SHEET_W / 2,
    y: ROW0 + 46,
    w: SHEET_W - 64,
    h: 92,
    r: 14,
    style: solid(C.stock2, track("lawPick.op", [[T(B.sieve), 0, OUT], [T(B.sieve) + T(0.3), 1, "hold"], [T(16.9), 1, IN], [T(17.15), 0]])),
  }),
);


// ---------------------------------------------------------------- the receipt
const RC0 = 590;
const RC_H = 78;
const receipt = [
  { n: `−${fmt(steps[0].removed)}`, label: steps[0].cut, detail: "SB 4 p1 · OpenStreetMap + SCAG land use", t: B.cut1 },
  { n: `−${fmt(steps[1].removed)}`, label: "in a very high fire zone", detail: "SB 4 p2 · CAL FIRE + OC hazard zones", t: B.cut2 },
  { n: `−${fmt(steps[2].removed)}`, label: "in a FEMA flood zone", detail: "SB 4 p2 · OC Floodplains (FEMA DFIRM)", t: B.cut3 },
  { n: `−${fmt(steps[3].removed)}`, label: steps[3].cut, detail: "Our call, not the law", t: B.cut4 },
];
const NUMW = 150;
receipt.forEach((r, k) => {
  const top = RC0 + k * RC_H;
  const id = `rc${k}`;
  const t0 = T(r.t);
  const kids = [
    add(text(`${id}.n`, D, { inTick: t0, x: PADX, y: top, w: NUMW, align: "right", runs: [R({ text: r.n, font: "mono", size: 26, weight: 500, color: C.coralInk, lineHeight: 32 })] })),
    add(text(`${id}.l`, D, { inTick: t0, x: PADX + NUMW + 24, y: top, w: 440, runs: [R({ text: r.label, font: "ui", size: 26, weight: 500, lineHeight: 32 })] })),
    add(text(`${id}.d`, D, { inTick: t0, x: PADX + NUMW + 24, y: top + 36, w: 440, runs: [R({ text: r.detail, font: "ui", size: 18, weight: 500, color: C.muted, lineHeight: 22 })] })),
  ];
  if (k < receipt.length - 1) kids.push(add(rect(`${id}.rule`, D, { inTick: t0, x: SHEET_W / 2, y: top + RC_H - 10, w: SHEET_W - 2 * PADX + 20, h: 1, r: 0, style: solid(C.ink, 0.08) })));
  // Write in: a wipe from the left with a short fade.
  add(
    rect(`${id}.clip`, D, {
      inTick: t0,
      x: PADX - 10,
      y: top + 30,
      anchor: { x: -(SHEET_W - PADX) / 2, y: 0 },
      w: SHEET_W - PADX,
      h: 76,
      r: 0,
      scale: track(`${id}.clip.sc`, [[t0, s(0.001, 1), OUT], [t0 + T(0.5), s(1)]]),
      style: {},
    }),
  );
  add(group(`${id}.in`, D, kids, { inTick: t0, clipPathId: `${id}.clip` }));
  fadeGroup(id, [`${id}.in`], r.t, 16.9, { inDur: 0.25 });
});

// ---------------------------------------------------------------- the site page
const SITE_IN = 17.3;
const ADDR_Y = 226;
const siteIds: string[] = [];
const addr = "2130 N Grand Ave";
siteIds.push(
  fadeGroup("siteHead", [
    add(tracked(text("addr", D, { inTick: T(SITE_IN), x: PADX - 2, y: ADDR_Y, w: 600, runs: [displayRun(addr, 50, C.ink, 56)] }), 50)),
    add(text("apn", D, { inTick: T(SITE_IN), x: PADX, y: ADDR_Y + 66, w: 600, runs: [R({ text: `Santa Ana, Orange County · APN ${hero.apn}`, font: "ui", size: 20, weight: 500, color: C.muted, lineHeight: 24 })] })),
  ], SITE_IN, B.outro, { dy: 14 }),
);
// Score stamp: blue disc, coral disc a hair out of register behind it.
{
  const cx = 646;
  const cy = ADDR_Y + 40;
  const kids = [
    add(ellipse("stampCoral", D, { inTick: T(SITE_IN), x: cx + 3, y: cy + 2.5, w: 84, h: 84, style: solid(C.coral) })),
    add(ellipse("stampBlue", D, { inTick: T(SITE_IN), x: cx, y: cy, w: 84, h: 84, style: solid(C.blue), blendMode: "multiply" } as never)),
    add(tracked(text("stampN", D, { inTick: T(SITE_IN), x: cx - 60, y: cy - 23, w: 120, align: "center", runs: [displayRun(String(hero.score), 32, C.stock, 34)] }), 32, -0.02)),
  ];
  (nodes.stampBlue as unknown as Record<string, unknown>).blendMode = "multiply";
  add(
    group("stamp", T(B.outro), kids, {
      inTick: T(SITE_IN + 0.2),
      isolation: true,
      anchor: { x: cx, y: cy },
      position: constant(v3(cx, cy)),
      scale: track("stamp.sc", [[T(SITE_IN + 0.2), s(0.3), POP], [T(SITE_IN + 0.6), s(1)]]),
      opacity: track("stamp.op", [[T(SITE_IN + 0.2), 0, OUT], [T(SITE_IN + 0.35), 1]]),
    }),
  );
}
// Verdict block.
{
  const top = 336;
  const kids = [
    add(rect("verdictBg", D, { inTick: T(SITE_IN), x: SHEET_W / 2, y: top + 56, w: SHEET_W - 2 * PADX + 24, h: 112, r: 14, style: solid(C.blueTint) })),
    add(tracked(text("verdictHead", D, { inTick: T(SITE_IN), x: PADX + 22, y: top + 16, w: 560, runs: [run({ text: `Likely yes under ${faith.law}`, font: "display", size: 30, weight: 800, color: C.ink, lineHeight: 36 })] }), 30, -0.02)),
    add(text("verdictSub", D, { inTick: T(SITE_IN), x: PADX + 22, y: top + 60, w: 560, runs: [R({ text: `If ${hero.unknown.length} things check out that no public data can answer.`, font: "ui", size: 20, weight: 500, lineHeight: 26 })] })),
  ];
  fadeGroup("verdict", kids, SITE_IN + 0.15, B.outro, { dy: 14 });
}
// Homes, labelled assumed.
{
  const top = 470;
  const kids = [
    add(tracked(text("homes", D, { inTick: T(SITE_IN), x: PADX - 2, y: top, w: 400, runs: [displayRun(`~${hero.units} homes`, 40, C.blue, 46)] }), 40)),
    add(rect("assumedBox", D, { inTick: T(SITE_IN), x: PADX + 314, y: top + 26, w: 112, h: 34, r: 17, style: line(C.muted, 1.5, 0.8, [3, 4]) })),
    add(text("assumed", D, { inTick: T(SITE_IN), x: PADX + 258, y: top + 14, w: 112, align: "center", runs: [R({ text: "assumed", font: "ui", size: 18, weight: 600, color: C.muted, lineHeight: 22 })] })),
  ];
  fadeGroup("homesRow", kids, SITE_IN + 0.3, B.outro, { dy: 14 });
}
// Checks: pass = stock check on a blue disc; unknown = dotted ring with "?".
const checks = [
  { label: "A place of worship is mapped here", src: "SCAG land use, religious facility · Nov 7, 2026", ok: true },
  { label: "Not in a very high fire hazard zone", src: "CAL FIRE + OC hazard zones · Nov 7, 2026", ok: true },
  { label: "Not in a FEMA flood hazard area", src: "OC Floodplains (FEMA DFIRM), zone X · Nov 7, 2026", ok: true },
  { label: "At least 10,000 sq ft", src: `${fmt(hero.lot)} sq ft lot · Santa Ana parcels · Nov 7, 2026`, ok: true },
  { label: hero.unknown[0] as string, src: "No public dataset. Someone has to confirm this.", ok: false },
];
const CK0 = 556;
const CK_H = 74;
checks.forEach((c, k) => {
  const top = CK0 + k * CK_H;
  const id = `ck${k}`;
  const t0 = c.ok ? B.checks + k * 0.25 : B.unknown;
  const mx = PADX + 16;
  const my = top + 16;
  const kids: string[] = [];
  if (c.ok) {
    kids.push(add(ellipse(`${id}.disc`, D, { inTick: T(t0), x: mx, y: my, w: 30, h: 30, style: solid(C.blue) })));
    kids.push(add(path(`${id}.tick`, D, { inTick: T(t0), contours: [polyline([[mx - 7, my + 0.5], [mx - 2, my + 5.5], [mx + 7.5, my - 5]])], style: line(C.stock, 3.2) })));
  } else {
    kids.push(add(ellipse(`${id}.ring`, D, { inTick: T(t0), x: mx, y: my, w: 28, h: 28, style: line(C.muted, 2.6, 1, [0.1, 4.6]) })));
    kids.push(add(text(`${id}.q`, D, { inTick: T(t0), x: mx - 20, y: my - 12, w: 40, align: "center", runs: [R({ text: "?", font: "ui", size: 18, weight: 700, color: C.muted, lineHeight: 22 })] })));
    kids.push(add(rect(`${id}.box`, D, { inTick: T(t0), x: SHEET_W / 2, y: top + 26, w: SHEET_W - 2 * PADX + 24, h: 68, r: 12, style: line(C.muted, 1.5, 0.55, [5, 5]) })));
  }
  kids.push(add(text(`${id}.l`, D, { inTick: T(t0), x: PADX + 44, y: top + 1, w: 580, runs: [R({ text: c.label, font: "ui", size: 24, weight: 500, lineHeight: 30 })] })));
  kids.push(add(text(`${id}.s`, D, { inTick: T(t0), x: PADX + 44, y: top + 34, w: 580, runs: [R({ text: c.src, font: "ui", size: 17, weight: 500, color: C.muted, lineHeight: 21 })] })));
  fadeGroup(id, kids, t0, B.outro, { dx: 18 });
});

// ---------------------------------------------------------------- the letter (the app's own template)
{
  const L0 = B.letter;
  const CX = 1376;
  const CW = 860;
  const CHh = 640;
  const CY = 548;
  const x0 = CX - CW / 2 + 52;
  const y0 = CY - CHh / 2 + 44;
  const card: string[] = [];
  card.push(add(rect("letterCard", D, { inTick: T(L0), x: CX, y: CY, w: CW, h: CHh, r: 14, style: both(solid(C.stock), line(C.ink, 1.5, 0.12)) })));
  // Header: a sparkle, the app's label.
  const sp = (x: number, y: number, r: number): [number, number][] => [[x, y - r], [x + r * 0.28, y - r * 0.28], [x + r, y], [x + r * 0.28, y + r * 0.28], [x, y + r], [x - r * 0.28, y + r * 0.28], [x - r, y], [x - r * 0.28, y - r * 0.28]];
  card.push(add(path("sparkle", D, { inTick: T(L0), contours: [polyline(sp(x0 + 11, y0 + 14, 12), true)], style: solid(C.coral) })));
  card.push(add(text("letterHead", D, { inTick: T(L0), x: x0 + 34, y: y0, w: 700, runs: [R({ text: "Draft by Claude: edit before you use it", font: "ui", size: 21, weight: 600, color: C.muted, lineHeight: 28 })] })));
  card.push(add(rect("letterRule", D, { inTick: T(L0), x: CX, y: y0 + 52, w: CW - 104, h: 1, r: 0, style: solid(C.ink, 0.1) })));
  const body = [
    "Dear Property owner,",
    "",
    "My name is [Your name], and I work with [Organization], a",
    "nonprofit that builds affordable homes in Orange County. We",
    "are exploring sites at 2130 N Grand Ave that may qualify for",
    "affordable housing under SB 4, a California law that",
    "streamlines approvals for this kind of project.",
    "",
    "We understand there is a congregation at this location, and",
    "we wanted to ask whether the institution owns the land and",
    "would be open to a conversation.",
  ];
  const LH = 36;
  body.forEach((ln, i) => {
    if (!ln) return;
    const id = `lt${i}`;
    const top = y0 + 80 + i * LH;
    const t = T(L0 + 0.35 + i * 0.13);
    add(text(id, D, { inTick: t, x: x0, y: top, w: CW - 104, runs: [R({ text: ln, font: "ui", size: 23, weight: 400, lineHeight: 30 })] }));
    add(rect(`${id}.clip`, D, { inTick: t, x: x0 - 4, y: top + 16, anchor: { x: -(CW - 96) / 2, y: 0 }, w: CW - 96, h: 36, r: 0, scale: track(`${id}.clip.sc`, [[t, s(0.001, 1), "linear"], [t + T(0.32), s(1)]]), style: {} }));
    card.push(add(group(`${id}.g`, D, [id], { inTick: t, clipPathId: `${id}.clip` })));
  });
  // Never sent: a coral pill at the foot of the card.
  const pillY = CY + CHh / 2 - 62;
  const tp = L0 + 1.9;
  const pill = [
    add(rect("sentBox", D, { inTick: T(tp), x: x0 + 128, y: pillY, w: 256, h: 46, r: 23, style: solid(C.coral) })),
    add(text("sentText", D, { inTick: T(tp), x: x0, y: pillY - 14, w: 256, align: "center", runs: [R({ text: "Drafted. Never sent.", font: "ui", size: 21, weight: 600, color: C.ink, lineHeight: 28 })] })),
  ];
  card.push(
    add(
      group("sent", D, pill, {
        inTick: T(tp),
        isolation: true,
        anchor: { x: x0 + 128, y: pillY },
        position: constant(v3(x0 + 128, pillY)),
        scale: track("sent.sc", [[T(tp), s(0.6), POP], [T(tp + 0.35), s(1)]]),
        opacity: track("sent.op", [[T(tp), 0, OUT], [T(tp + 0.15), 1]]),
      }),
    ),
  );
  add(group("letterInner", D, card, { inTick: T(L0) }));
  add({
    ...baseOf("letterShadow", D, { inTick: T(L0) }),
    type: "effect",
    inputId: "letterInner",
    effect: "drop-shadow",
    parameters: [num("letterShadow", "blur", 26, 0, 200), col("letterShadow", "color", hex("#141B3C")), num("letterShadow", "offsetX", 0), num("letterShadow", "offsetY", 18)],
    capability: { requires: ["image-filter"], fallback: "passthrough", maxTemporarySurfaces: 1 },
  } as never);
  add(
    group("letter", P2_END, ["letterShadow"], {
      inTick: T(L0),
      isolation: true,
      position: track("letter.pos", [[T(L0), v3(0, 70), OUT], [T(L0 + 0.55), v3(0, 0)]]),
      opacity: track("letter.op", [[T(L0), 0, OUT], [T(L0 + 0.3), 1]]),
    }),
  );
}

// =====================================================================================
// 3. The lockup  [24, 30)
// =====================================================================================
const P3 = T(B.outro);
{
  const K = 8; // 32 grid -> 256 px
  const ox = W / 2 - 16 * K;
  const oy = 262 - 4.62 * K;
  const g = gridMap(K, ox, oy);
  const [, slabTop] = g(0, 24.25);
  const [, slabBottom] = g(0, 28.5);
  const [sillX, sillY] = g(16, 23);
  const t = (sec: number) => T(B.outro + sec);
  add(
    path("lkHouse", D, {
      inTick: P3,
      contours: houseContours(g),
      style: solid(C.blue, track("lkHouse.op", [[t(0.2), 0, OUT], [t(0.55), 1]])),
      anchor: { x: sillX, y: sillY },
      position: track("lkHouse.pos", [[t(0.2), v3(sillX, sillY + 40), OUT], [t(0.75), v3(sillX, sillY)]]),
      scale: track("lkHouse.sc", [[t(0.2), s(0.92), OUT], [t(0.75), s(1)]]),
    }),
  );
  add(rect("lkStemClip", D, { inTick: P3, x: sillX, y: (g(0, 12)[1] + slabTop + 6) / 2, w: 10 * K, h: slabTop + 6 - g(0, 12)[1], r: 0, style: {} }));
  add(path("lkStem", D, { inTick: P3, contours: svgToContours(STEM_D, g), style: solid(C.coral), position: track("lkStem.pos", [[t(0.5), v3(0, 8.6 * K), OUT], [t(1.05), v3(0, 0)]]) }));
  add(group("lkStemG", D, ["lkStem"], { inTick: P3, clipPathId: "lkStemClip" }));
  const [slabL] = g(2, 0);
  const [slabR] = g(30, 0);
  add(
    rect("lkSlabClip", D, {
      inTick: P3,
      x: slabL - 4,
      y: (slabTop + slabBottom) / 2,
      anchor: { x: -(slabR - slabL + 8) / 2, y: 0 },
      w: slabR - slabL + 8,
      h: slabBottom - slabTop + 8,
      r: 0,
      scale: track("lkSlabClip.sc", [[P3, s(0.001, 1), OUT], [t(0.5), s(1)]]),
      style: {},
    }),
  );
  add(path("lkSlab", D, { inTick: P3, contours: svgToContours(SLAB_D, g), style: solid(C.coral) }));
  add(group("lkSlabG", D, ["lkSlab"], { inTick: P3, clipPathId: "lkSlabClip" }));
  const wmTop = slabBottom + 18;
  settleLine("lkWord", { x: 0, y: wmTop, w: W, align: "center", runs: [displayRun("Groundwork", 176, C.ink, 190)], tIn: B.outro + 0.75, dy: 16, size: 176 });
  (nodes.lkWord as unknown as Record<string, unknown>).animators = [
    { id: "lkWord.trk", selector: { start: 0, end: 10, units: "characters" }, tracking: constant(-0.035 * 176) },
  ];
  settleLine("lkTag", {
    x: 0,
    y: wmTop + 214,
    w: W,
    align: "center",
    runs: [R({ text: "Find the land California’s new housing laws opened.", font: "ui", size: 40, weight: 500, color: C.muted, lineHeight: 48 })],
    tIn: B.outro + 1.1,
    dy: 12,
  });
  settleLine("lkFoot", {
    x: 0,
    y: 972,
    w: W,
    align: "center",
    runs: [R({ text: "Santa Ana, Orange County  ·  Built at the Claude Impact Lab, UC Irvine", font: "ui", size: 24, weight: 500, color: C.muted, lineHeight: 30 })],
    tIn: B.outro + 1.6,
    dy: 8,
  });
}

// =====================================================================================
// Assembly
// =====================================================================================
add(rect("bg", D, { x: W / 2, y: H / 2, w: W + 4, h: H + 4, r: 0, style: solid(C.stock) }));

const roots = [
  "bg",
  "shot1",
  ...titles1,
  "mapGround",
  "map",
  "tag",
  "sheet",
  "sheetEdge",
  ...st,
  "counterCoral",
  "counter",
  "counterLabel",
  "lawPick",
  ...lawRowIds,
  ...receipt.map((_, k) => `rc${k}`),
  "siteHead",
  "stamp",
  "verdict",
  "homesRow",
  ...checks.map((_, k) => `ck${k}`),
  "letter",
  "lkHouse",
  "lkStemG",
  "lkSlabG",
  "lkWord",
  "lkTag",
  "lkFoot",
];

const assets: Record<string, unknown> = {
  "font-display": { id: "font-display", type: "font", uri: "fonts/BricolageGrotesque.ttf", family: "Bricolage Grotesque", style: "normal", weight: 800 },
  "font-ui": { id: "font-ui", type: "font", uri: "fonts/InterTight.ttf", family: "Inter Tight", style: "normal", weight: 500 },
  "font-mono": { id: "font-mono", type: "font", uri: "fonts/GeistMono.ttf", family: "Geist Mono", style: "normal", weight: 500 },
  "img-zoom": { id: "img-zoom", type: "image", uri: "assets/zoom.png", width: Z.pxW, height: Z.pxH, mimeType: "image/png" },
};
map.rings.forEach((r: { file: string }, k: number) => {
  assets[`img-ring${k}`] = { id: `img-ring${k}`, type: "image", uri: `assets/${r.file}`, width: IMG.pxW, height: IMG.pxH, mimeType: "image/png" };
});
// Fonts travel beside the document, so packaging, review and export all find them.
mkdirSync(join(OUTDIR, "fonts"), { recursive: true });
for (const f of ["BricolageGrotesque.ttf", "InterTight.ttf", "GeistMono.ttf"]) copyFileSync(join(here, "..", "readme", "fonts", f), join(OUTDIR, "fonts", f));
const SCORE = join(OUTDIR, "assets", "score.wav");
if (existsSync(SCORE)) {
  assets.score = { id: "score", type: "audio", uri: "assets/score.wav", mimeType: "audio/wav", durationTicks: D };
  add({ ...baseOf("score", D, {}), type: "audio", assetId: "score", volume: constant(1), playbackRate: constant(1), startOffsetTick: 0, loop: false } as never);
  roots.push("score");
} else {
  console.warn("no score.wav yet: building without sound (run music.py)");
}

const doc = withComputedRevision({
  version: ANIMATION_DOCUMENT_VERSION,
  id: "groundwork-demo",
  name: "Groundwork demo, Orange County",
  canvas: { width: W, height: H, pixelAspectRatio: 1, backgroundColor: C.stock },
  timing: { ticksPerSecond: TPS, frameRate: { numerator: FPS, denominator: 1 }, durationTicks: D, displayStartTick: 0 },
  assets,
  rootCompositionId: "main",
  components: {},
  compositions: { main: { id: "main", name: "Main", width: W, height: H, durationTicks: D, nodes, rootNodeIds: roots } },
  markers: [
    marker("paint", T(2.0), { name: "Orange County needs homes" }),
    marker("luck", T(5.0), { name: "Nonprofits find land by luck" }),
    marker("print", T(6.6), { name: "Painting prints as riso" }),
    marker("drop", T(B.drop), { name: "Drop: the product", cut: true }),
    marker("laws", T(10.7), { name: "Five laws" }),
    marker("cut1", T(12.6), { name: "Sieve step 1" }),
    marker("cut4", T(15.7), { name: "Sieve step 4" }),
    marker("found", T(16.6), { name: "90 lots worth a call" }),
    marker("site", T(19.4), { name: "Site checks" }),
    marker("unknown", T(20.8), { name: "Unknown stays a question" }),
    marker("letter", T(23.4), { name: "Letter drafted" }),
    marker("outro", T(B.outro), { name: "Lockup", cut: true }),
    marker("end", T(29.5), { name: "End card" }),
  ],
  design: { tokens: { looping: false } },
  capabilities: { required: ["runtime-effect"], optional: [], unsupportedPolicy: "warn" },
} as never);
assertValidAnimationDocument(doc);
writeFileSync(join(OUTDIR, "demo.json"), JSON.stringify(doc));
console.log(`demo.json: ${Object.keys(nodes).length} nodes, revision ${(doc as { revision: string }).revision}`);
void EASE;
void GLIDE;
