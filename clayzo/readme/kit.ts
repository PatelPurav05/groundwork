/**
 * Shared kit for the three Groundwork README animations (hero, sieve, architecture).
 *
 *   npx tsx clayzo/readme/build.ts
 *
 * World: calm editorial product motion on stock. Two inks (blue = what exists,
 * coral = the found thing), solid flat geometry, 1.5–2 px hairlines, rounded
 * rects r 10–14. No texture, no gradients, no glows.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANIMATION_DOCUMENT_VERSION,
  assertValidAnimationDocument,
  base,
  constant,
  fill,
  hex,
  keyed,
  marker,
  stroke,
  withComputedRevision,
  type Animatable,
  type AnimationDocument,
  type Color,
  type CubicBezier,
  type Key,
  type Marker,
  type PathContour,
  type SceneNode,
  type ShapeStyle,
  type TextRun,
  type Vec3,
} from "@clayzo/animation/authoring";

export const TPS = 240;
/** Authored at 60 fps: one frame is 4 ticks; every key sits on that grid. */
export const FRAME = 4;
export const sec = (s: number) => Math.round((s * TPS) / FRAME) * FRAME;

export const C = {
  stock: hex("#FBFBF8"),
  stock2: hex("#F2F3EF"),
  ink: hex("#141B3C"),
  blue: hex("#1D3BA8"),
  coral: hex("#FF5A4E"),
  coralInk: hex("#C9372D"),
  muted: hex("#5A6178"),
  blueTint: hex("#E4E8F6"),
  coralTint: hex("#FFE6E2"),
  /** rgba(20,27,60,0.12) on stock, flattened so it can be a fill colour. */
  hair: hex("#E0E1E2"),
};
export const HAIR_A = 0.12;

/** The house ease: strong ease-out for every entrance. */
export const OUT: CubicBezier = { x1: 0.23, y1: 1, x2: 0.32, y2: 1 };
/** A whisper of overshoot, for the one stamp-in per piece. */
export const POP: CubicBezier = { x1: 0.34, y1: 1.32, x2: 0.64, y2: 1 };
/** Exits and resets: accelerate away. */
export const IN: CubicBezier = { x1: 0.55, y1: 0, x2: 0.8, y2: 0.4 };
/** Even in-out, for travel along connectors. */
export const EASE: CubicBezier = { x1: 0.45, y1: 0, x2: 0.55, y2: 1 };

export const FONTS = {
  display: "Bricolage Grotesque",
  ui: "Inter Tight",
  mono: "Geist Mono",
};

export const v3 = (x: number, y: number): Vec3 => ({ x, y, z: 0 });
export const s = (k: number, ky = k): Vec3 => ({ x: k, y: ky, z: 1 });

let trackSeq = 0;
/** A keyed track; ids are made unique automatically. */
export function tr<T>(id: string, keys: readonly Key<T>[]): Animatable<T> {
  return keyed(`${id}.t${trackSeq++}`, keys);
}

export type Nodes = Record<string, SceneNode>;

type Common = {
  x?: number;
  y?: number;
  position?: Animatable<Vec3>;
  scale?: number | Animatable<Vec3>;
  anchor?: { x: number; y: number };
  opacity?: number | Animatable<number>;
  inTick?: number;
};

function opts(out: number, o: Common) {
  const shared = {
    outTick: out,
    ...(o.inTick ? { inTick: o.inTick } : {}),
    ...(o.anchor ? { anchor: o.anchor } : {}),
    ...(o.scale !== undefined ? { scale: o.scale } : {}),
    ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
  };
  return o.position ? { ...shared, position: o.position } : { ...shared, x: o.x ?? 0, y: o.y ?? 0 };
}

export const solid = (c: Color | Animatable<Color>, opacity: number | Animatable<number> = 1): ShapeStyle => ({ fill: fill(c, opacity) });
export const line = (c: Color, width: number, opacity: number | Animatable<number> = 1, dash?: number[]): ShapeStyle => ({
  stroke: stroke(c, width, { opacity, cap: "round", join: "round", ...(dash ? { dash } : {}) }),
});

/** A filled shape with a stroke on top. */
export const both = (f: ShapeStyle, st: ShapeStyle): ShapeStyle => ({ ...f, ...st });

export function rect(
  id: string,
  out: number,
  o: Common & { w: number; h: number; r: number; style: ShapeStyle; size?: Animatable<{ width: number; height: number }> },
): SceneNode {
  return {
    ...base(id, opts(out, o)),
    type: "rect",
    size: o.size ?? constant({ width: o.w, height: o.h }),
    cornerRadius: constant(o.r),
    style: o.style,
  } as SceneNode;
}

export function ellipse(id: string, out: number, o: Common & { w: number; h: number; style: ShapeStyle }): SceneNode {
  return { ...base(id, opts(out, o)), type: "ellipse", size: constant({ width: o.w, height: o.h }), style: o.style } as SceneNode;
}

export function path(id: string, out: number, o: Common & { contours: PathContour[]; style: ShapeStyle; operators?: unknown[] }): SceneNode {
  return {
    ...base(id, opts(out, o)),
    type: "path",
    path: constant({ contours: o.contours }),
    style: o.style,
    ...(o.operators ? { operators: o.operators } : {}),
  } as SceneNode;
}

export function group(id: string, out: number, children: string[], o: Common & { clipPathId?: string; isolation?: boolean } = {}): SceneNode {
  return {
    ...base(id, opts(out, o)),
    type: "group",
    children,
    ...(o.clipPathId ? { clipPathId: o.clipPathId } : {}),
    ...(o.isolation ? { isolation: true } : {}),
  } as SceneNode;
}

export type RunSpec = { text: string; font: keyof typeof FONTS; size: number; weight: number; color: Color; lineHeight?: number };

export function run(r: RunSpec): TextRun {
  return {
    text: r.text,
    fontAssetId: `font-${r.font}`,
    fontFamily: FONTS[r.font],
    fontSize: r.size,
    fontWeight: r.weight,
    letterSpacing: 0,
    lineHeight: r.lineHeight ?? Math.round(r.size * 1.25),
    color: r.color,
  };
}

/**
 * One line of text. (x, y) is the top-left of the box; the first baseline sits
 * `lineHeight` below y. `align` aligns within `w`.
 */
export function text(
  id: string,
  out: number,
  o: Common & { runs: TextRun[] | Animatable<TextRun[]>; w: number; h?: number; align?: "left" | "center" | "right" },
): SceneNode {
  const runs = Array.isArray(o.runs) ? constant(o.runs) : o.runs;
  return {
    ...base(id, opts(out, o)),
    type: "text",
    runs,
    box: { width: o.w, height: o.h ?? 200 },
    wrap: "none",
    align: o.align ?? "left",
    verticalAlign: "top",
  } as SceneNode;
}

/** Rounded rect contour (top-left x, y). Cubic corners, K = 0.5523. */
export function rrContour(x: number, y: number, w: number, h: number, r: number): PathContour {
  const k = 0.5523 * r;
  const P = (px: number, py: number, ix = 0, iy = 0, ox = 0, oy = 0) => ({ point: { x: px, y: py }, inTangent: { x: ix, y: iy }, outTangent: { x: ox, y: oy } });
  return {
    closed: true,
    vertices: [
      P(x + r, y, -k, 0, 0, 0),
      P(x + w - r, y, 0, 0, k, 0),
      P(x + w, y + r, 0, -k, 0, 0),
      P(x + w, y + h - r, 0, 0, 0, k),
      P(x + w - r, y + h, k, 0, 0, 0),
      P(x + r, y + h, 0, 0, -k, 0),
      P(x, y + h - r, 0, k, 0, 0),
      P(x, y + r, 0, 0, 0, -k),
    ],
  };
}

export function polyline(points: readonly (readonly [number, number])[], closed = false): PathContour {
  return {
    closed,
    vertices: points.map(([x, y]) => ({ point: { x, y }, inTangent: { x: 0, y: 0 }, outTangent: { x: 0, y: 0 } })),
  };
}

/** Deterministic PRNG so every build is the same document. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------

export interface DocSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  duration: number;
  nodes: Nodes;
  roots: string[];
  markers?: Marker[];
}

export function buildDoc(spec: DocSpec): AnimationDocument {
  const fontAsset = (key: keyof typeof FONTS, file: string, weight: number) => ({
    id: `font-${key}`,
    type: "font" as const,
    uri: `../fonts/${file}`,
    family: FONTS[key],
    style: "normal",
    weight,
  });
  const nodes: Nodes = {
    bg: rect("bg", spec.duration, { x: spec.width / 2, y: spec.height / 2, w: spec.width + 4, h: spec.height + 4, r: 0, style: solid(C.stock) }),
    ...spec.nodes,
  };
  const doc = withComputedRevision({
    version: ANIMATION_DOCUMENT_VERSION,
    id: spec.id,
    name: spec.name,
    canvas: { width: spec.width, height: spec.height, pixelAspectRatio: 1, backgroundColor: C.stock },
    timing: { ticksPerSecond: TPS, frameRate: { numerator: 60, denominator: 1 }, durationTicks: spec.duration, displayStartTick: 0 },
    assets: {
      "font-display": fontAsset("display", "BricolageGrotesque.ttf", 800),
      "font-ui": fontAsset("ui", "InterTight.ttf", 500),
      "font-mono": fontAsset("mono", "GeistMono.ttf", 500),
    },
    rootCompositionId: "main",
    components: {},
    compositions: {
      main: { id: "main", name: "Main", width: spec.width, height: spec.height, durationTicks: spec.duration, nodes, rootNodeIds: ["bg", ...spec.roots] },
    },
    markers: spec.markers ?? [],
    design: { tokens: { looping: true } },
    capabilities: { required: [], optional: [], unsupportedPolicy: "warn" },
  } as never);
  assertValidAnimationDocument(doc);
  return doc;
}

export function writeDoc(dir: string, doc: AnimationDocument) {
  const file = join(dir, `${doc.id}.json`);
  writeFileSync(file, JSON.stringify(doc, null, 1) + "\n");
  return file;
}

export { marker, constant, hex };

/** Drawn width of a run, from metrics.json (run measure.ts when copy changes). */
export function widthOf(r: { text: string; font: string; size: number; weight: number }): number {
  const metrics = JSON.parse(readFileSync(join(__dirname, "metrics.json"), "utf8")) as Record<string, number>;
  const w = metrics[`${r.font}|${r.size}|${r.weight}|${r.text}`];
  if (w === undefined) throw new Error(`no metric for "${r.text}": run measure.ts`);
  return w;
}
