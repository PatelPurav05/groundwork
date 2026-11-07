// Impasto oil paint for Clayzo: builders for the four paint passes, the wind, and baking still
// layers to images. Copy this folder's paint.ts, flat.ts, paint-util.sksl, paint-strokes.sksl
// and passes/ into your project, keeping the layout (paint.ts reads the shaders beside it).
//
// Every pass is a custom-sksl effect over a FLAT picture drawn from shapes (flat.ts). The pass
// repaints it as palette-knife strokes. Motion never moves the flat picture: a pass warps the
// coordinate it paints from and each stroke samples its colour at its own rest position, so the
// strokes ride with what they paint.
//
// Uniforms bind by position, so each builder below owns its pass's parameter order. Change a
// pass's uniforms and its builder together.

import { readFileSync } from "node:fs";
import { base, constant, keyed, type Animatable, type Color, type SceneNode } from "@clayzo/animation/authoring";

const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
const UTIL = read("./paint-util.sksl");
const STROKES = read("./paint-strokes.sksl");

export type PassName = "still" | "sky" | "field" | "rooted";

/** A pass's full SkSL: its uniforms, the library, its stroke hooks, the stroke field, its main. */
export function loadPass(name: PassName): string {
  const text = read(`./passes/${name}.sksl`);
  const [header, rest] = text.split("//#hooks");
  const [hooks, main] = rest.split("//#main");
  return [header, UTIL, hooks, STROKES, main].join("\n");
}

type Num = number | Animatable<number>;
const anim = (v: Num): Animatable<number> => (typeof v === "number" ? constant(v) : v);

export const hex = (h: string, a = 1): Color => ({
  r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255, a,
});
const num = (id: string, name: string, v: Num) =>
  ({ id: `${id}-${name}`, name, valueType: "number" as const, minimum: -1e6, maximum: 1e6, value: anim(v) });
const col = (id: string, name: string, c: string, a = 1) =>
  ({ id: `${id}-${name}`, name, valueType: "color" as const, value: constant(hex(c, a)) });

/** The loop clock every moving pass shares: 0 -> 2pi, linear, across the whole loop. */
export const phaseTrack = (id: string, endTick: number) => keyed(`${id}.phase`, [[0, 0, "linear"], [endTick, Math.PI * 2]]);

/** Wind that repeats exactly over the loop: three whole-number gust rates (~3.1 s, ~1.4 s and
 *  ~0.75 s apart) and a direction (+1 blows left to right). */
export interface Wind { a: number; b: number; c: number; dir: 1 | -1 }
export function wind(o: { loopSeconds: number; direction?: 1 | -1 }): Wind {
  const a = Math.max(1, Math.round(o.loopSeconds / 3.1));
  const b = Math.max(a + 1, Math.round(o.loopSeconds / 1.4));
  const c = Math.max(b + 1, Math.round(o.loopSeconds / 0.75));
  return { a, b, c, dir: o.direction ?? 1 };
}

const effect = (id: string, input: string, end: number, sksl: string, parameters: any[]): SceneNode => ({
  ...base(id, { outTick: end }), type: "effect", inputId: input, effect: "custom-sksl", implementation: sksl, parameters,
  capability: { requires: ["runtime-effect"], fallback: "passthrough", maxTemporarySurfaces: 1 },
} as any);

/** Light from the upper left, the conventional studio light on a canvas. */
export const UPPER_LEFT = -2.24;

/** A picture that does not move: a whole landscape, or one layer (mountains, forest, buildings).
 *  With lightSwing > 0 the light swings over the loop and the ridges glint; otherwise it is
 *  static and can be baked (see bake_layers.py). */
export function stillPass(o: {
  id: string; input: string; end: number;
  cell?: number; relief?: number; detail?: number; lightAngle?: number;
  lightSwing?: number; phase?: Animatable<number>;
  horizonY?: number; baseAngle?: number; verticalLuma?: number; boundsPadding?: number;
}): SceneNode {
  const cell = o.cell ?? 26;
  return effect(o.id, o.input, o.end, loadPass("still"), [
    num(o.id, "phase", o.phase ?? (o.lightSwing ? phaseTrack(o.id, o.end) : constant(0))),
    num(o.id, "cell", cell), num(o.id, "relief", o.relief ?? 12), num(o.id, "detail", o.detail ?? 0.14),
    num(o.id, "lightAngle", o.lightAngle ?? UPPER_LEFT), num(o.id, "lightSwing", o.lightSwing ?? 0),
    num(o.id, "horizonY", o.horizonY ?? 0), num(o.id, "baseAngle", o.baseAngle ?? -0.55),
    num(o.id, "verticalLuma", o.verticalLuma ?? 0), num(o.id, "boundsPadding", o.boundsPadding ?? cell * 2),
  ]);
}

export interface CloudColours { lit: string; mid: string; shadow: string; glow: string }
/** Pearl overcast with a warm break: the cornflower meadow's sky. */
export const PEARL_CLOUDS: CloudColours = { lit: "#F0EDED", mid: "#D1D1D9", shadow: "#9EA3B8", glow: "#FFFAEB" };
/** Golden hour: peach and cream clouds over blue-grey. */
export const GOLDEN_CLOUDS: CloudColours = { lit: "#F7E3C4", mid: "#E2B48E", shadow: "#8C9AB0", glow: "#FFF1D6" };

/** A sky of drifting clouds over the clear sky in `input`. The clouds travel
 *  canvasW x driftLoops per loop in windDir, so they float off one edge and the loop closes. */
export function skyPass(o: {
  id: string; input: string; end: number; canvasW: number; skyBottom: number;
  cell?: number; relief?: number; lightAngle?: number; windDir?: 1 | -1; driftLoops?: number;
  cloudTop?: number; coverage?: number; clouds?: CloudColours;
}): SceneNode {
  const cell = o.cell ?? 50;
  if (!Number.isInteger(o.canvasW / cell)) throw new Error(`skyPass: canvasW ${o.canvasW} / cell ${cell} must be a whole number`);
  if (!Number.isInteger(o.canvasW / 400)) console.warn(`skyPass: canvasW ${o.canvasW} is not a multiple of 400; the cloud field will not wrap seamlessly`);
  const C = o.clouds ?? PEARL_CLOUDS;
  return effect(o.id, o.input, o.end, loadPass("sky"), [
    num(o.id, "phase", phaseTrack(o.id, o.end)), num(o.id, "windDir", o.windDir ?? 1), num(o.id, "driftLoops", o.driftLoops ?? 1),
    num(o.id, "cell", cell), num(o.id, "relief", o.relief ?? 5), num(o.id, "lightAngle", o.lightAngle ?? UPPER_LEFT),
    num(o.id, "canvasW", o.canvasW), num(o.id, "skyBottom", o.skyBottom),
    num(o.id, "cloudTop", o.cloudTop ?? 470), num(o.id, "coverage", o.coverage ?? 0.22),
    col(o.id, "cloudLit", C.lit), col(o.id, "cloudMid", C.mid), col(o.id, "cloudShadow", C.shadow), col(o.id, "cloudGlow", C.glow),
    num(o.id, "boundsPadding", 0),
  ]);
}

/** A field in perspective from farY (still) to nearY (full depth) that leans with each gust,
 *  its upright blades swinging about their roots. `accent` names the small flowers' colour
 *  family so their petals radiate; omit it for plain grass. */
export function fieldPass(o: {
  id: string; input: string; end: number; wind: Wind; farY: number; nearY: number;
  cell?: number; relief?: number; lightAngle?: number; detail?: number;
  lean?: number; bladeSway?: number; accent?: string; boundsPadding?: number;
}): SceneNode {
  const w = o.wind;
  return effect(o.id, o.input, o.end, loadPass("field"), [
    num(o.id, "phase", phaseTrack(o.id, o.end)),
    num(o.id, "windA", w.a), num(o.id, "windB", w.b), num(o.id, "windC", w.c), num(o.id, "windDir", w.dir),
    num(o.id, "cell", o.cell ?? 20), num(o.id, "relief", o.relief ?? 12), num(o.id, "lightAngle", o.lightAngle ?? UPPER_LEFT),
    num(o.id, "detail", o.detail ?? 0.2), num(o.id, "farY", o.farY), num(o.id, "nearY", o.nearY),
    num(o.id, "lean", o.lean ?? 16), num(o.id, "bladeSway", o.bladeSway ?? 0.3),
    col(o.id, "accent", o.accent ?? "#808080", o.accent ? 1 : 0),
    num(o.id, "boundsPadding", o.boundsPadding ?? 30),
  ]);
}

/** One rooted, bending thing: head centre (x, y) and radius r, root below it, how far the wind
 *  bends it (0.11–0.16 rad per unit of wind) and its own rhythm (0–1). */
export interface Rooted { x: number; y: number; r: number; rootX: number; rootY: number; stiff: number; seed: number }

/** Everything rooted that bends, in one pass. `objects` back to front: the flat picture in
 *  `input` must draw them in the same order. */
export function rootedPass(o: {
  id: string; input: string; end: number; wind: Wind; objects: Rooted[];
  relief?: number; lightAngle?: number; headSquash?: number; flutter?: number; boundsPadding?: number;
}): SceneNode {
  const objs = o.objects;
  const f = (v: number) => v.toFixed(1);
  const A = (i: number) => `float4(f${i}hx, f${i}hy, f${i}r, f${i}rx)`;
  const B = (i: number) => `float4(f${i}ry, ${f(i)}, f${i}seed, f${i}stiff)`;
  // Only objects whose rest boxes can overlap need to ask each other who owns a stroke.
  const box = (h: Rooted) => ({ x0: Math.min(h.x, h.rootX) - h.r * 1.4, x1: Math.max(h.x, h.rootX) + h.r * 1.4, y0: h.y - h.r * 0.9, y1: h.rootY });
  const overlaps = (a: Rooted, b: Rooted) => { const P = box(a), Q = box(b); return P.x0 < Q.x1 && Q.x0 < P.x1 && P.y0 < Q.y1 && Q.y0 < P.y1; };
  const sksl = loadPass("rooted")
    .replace("//#generated-uniforms", objs.map((_, i) =>
      `uniform float f${i}hx; uniform float f${i}hy; uniform float f${i}r; uniform float f${i}rx; uniform float f${i}ry; uniform float f${i}seed; uniform float f${i}stiff;`).join("\n"))
    .replace("//#generated-owners", [
      "// Is c claimed by an object in front of object idx (higher index = nearer)?",
      "bool frontOwns(float2 c, float idx) {",
      ...objs.map((h, k) => {
        const behind = objs.map((_, i) => i).filter((i) => i < k && overlaps(objs[i], h));
        return behind.length ? `  if ((${behind.map((i) => `idx == ${f(i)}`).join(" || ")}) && inObject(c, ${A(k)}, ${B(k)})) { return true; }` : "";
      }).filter(Boolean),
      "  return false;",
      "}",
    ].join("\n"))
    .replace("//#generated-calls", objs.map((_, k) => objs.length - 1 - k).map((i) =>
      `  c = paintObject(q, ${A(i)}, ${B(i)}, hit); if (hit) { return c; }`).join("\n"));
  const w = o.wind;
  return effect(o.id, o.input, o.end, sksl, [
    num(o.id, "phase", phaseTrack(o.id, o.end)),
    num(o.id, "windA", w.a), num(o.id, "windB", w.b), num(o.id, "windC", w.c), num(o.id, "windDir", w.dir),
    num(o.id, "relief", o.relief ?? 13), num(o.id, "lightAngle", o.lightAngle ?? UPPER_LEFT),
    num(o.id, "headSquash", o.headSquash ?? 0.62), num(o.id, "flutter", o.flutter ?? 0.07),
    ...objs.flatMap((h, i) => [
      num(o.id, `f${i}hx`, h.x), num(o.id, `f${i}hy`, h.y), num(o.id, `f${i}r`, h.r),
      num(o.id, `f${i}rx`, h.rootX), num(o.id, `f${i}ry`, h.rootY), num(o.id, `f${i}seed`, h.seed), num(o.id, `f${i}stiff`, h.stiff),
    ]),
    num(o.id, "boundsPadding", o.boundsPadding ?? 60),
  ]);
}

// ---------- baking still layers to images (scripts/bake_layers.py drives this) ----------

/** The layer bake_layers.py asked for (BAKE=<name>), or "" for the normal build. */
export const BAKE = process.env.BAKE ?? "";

/** Where to write the document: the normal file, or assets/bake-<layer>.json while baking. */
export const outputPath = (normal: string) => (BAKE ? `assets/bake-${BAKE}.json` : normal);

/** Where a baked layer sits, from assets/layers.json. */
export interface Placed { x: number; y: number; width: number; height: number; file: string; mime: string }

/** The baked layers, or {} while baking. `dir` is the project folder URL (new URL("./", import.meta.url)). */
export function readLayers(dir: URL): Record<string, Placed> {
  if (BAKE) return {};
  try { return JSON.parse(readFileSync(new URL("./assets/layers.json", dir), "utf8")); }
  catch { throw new Error("assets/layers.json is missing: run scripts/bake_layers.py first"); }
}

/** An image node showing a baked layer exactly where it was drawn. */
export const imageNode = (id: string, asset: string, at: Placed, end: number): SceneNode => ({
  ...base(id, { outTick: end, x: at.x + at.width / 2, y: at.y + at.height / 2 }), type: "image", assetId: asset,
  size: constant({ width: at.width, height: at.height }), fit: "fill",
} as any);

/** The document's assets for the baked layers. */
export const imageAssets = (layers: Record<string, Placed>) => Object.fromEntries(Object.entries(layers).map(([id, L]) =>
  [id, { id, type: "image", uri: `assets/${L.file}`, width: L.width, height: L.height, mimeType: L.mime }]));

/** Drop every node the roots do not draw, so baked shapes stay out of the shipped document. */
export function prune(nodes: Record<string, SceneNode>, roots: string[]) {
  const keep = new Set<string>();
  const walk = (id: string) => {
    if (keep.has(id)) return;
    keep.add(id);
    const n = nodes[id] as any;
    if (!n) throw new Error(`prune: no node ${id}`);
    [...(n.children ?? []), n.inputId, n.contentId, n.matteId, n.clipPathId].filter(Boolean).forEach(walk);
  };
  roots.forEach(walk);
  for (const id of Object.keys(nodes)) if (!keep.has(id)) delete nodes[id];
}
