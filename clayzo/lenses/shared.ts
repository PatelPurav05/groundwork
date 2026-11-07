/**
 * Shared kit for the five Groundwork lens illustrations.
 *
 * Every lens is a 288×288 transparent square, played in a ~72 px tile.
 * Tick 0 is the resting frame (the finished picture). The "play" segment
 * tucks the new thing away, shows the "before" for a beat, then tells the
 * story of what the law unlocks and lands exactly back on the resting frame,
 * so rest, reduced motion and the end of play are one picture.
 */
import {
  ANIMATION_DOCUMENT_VERSION,
  assertValidAnimationDocument,
  base,
  constant,
  fill,
  hex,
  keyed,
  marker,
  stateMachine,
  stroke,
  valueAt,
  withComputedRevision,
  withStateMachine,
  type AnimationDocument,
  type Animatable,
  type CubicBezier,
  type PathContour,
  type PathVertex,
  type SceneNode,
  type ShapeStyle,
  type Vec3,
} from "@clayzo/animation/authoring";

export const SIZE = 288;
export const TPS = 240;
/** 60 fps: one frame is 4 ticks. Every key below sits on that grid. */
export const FRAME = 4;

export const C = {
  ink: hex("#1b1a17"),
  clay: hex("#c8553a"),
  paper: hex("#f5f2ec"),
  /** --surface-2 (#efebe3) deepened ~4 % toward ink, so ground slabs still read on a #efebe3 tile. */
  stone: hex("#e7e2d8"),
  green: hex("#e1efe6"),
  claySoft: hex("#f6e2da"),
};

/** The app's --ease-out: strong, decisive entrances. */
export const OUT: CubicBezier = { x1: 0.23, y1: 1, x2: 0.32, y2: 1 };
/** Entrances with a whisper of overshoot (~3 %). */
export const POP: CubicBezier = { x1: 0.34, y1: 1.28, x2: 0.64, y2: 1 };
/** Exits: accelerate away, quickly. */
export const IN: CubicBezier = { x1: 0.55, y1: 0, x2: 0.8, y2: 0.4 };
/** Colour and fades that should feel even. */
export const EASE: CubicBezier = { x1: 0.4, y1: 0, x2: 0.2, y2: 1 };

export type Pt = readonly [number, number];
export type KeyList<T> = readonly (readonly [number, T, (CubicBezier | "linear" | "hold")?])[];

/** A position. z stays 0: a non-zero z moves the node in depth and the renderers drop it. */
export const v3 = (x: number, y: number): Vec3 => ({ x, y, z: 0 });
/** A uniform scale, or (k, ky) for a non-uniform one. */
export const s = (k: number, ky = k): Vec3 => ({ x: k, y: ky, z: 1 });

/** A track that must end where it starts: the resting value. */
export function track<T>(id: string, keys: KeyList<T>): Animatable<T> {
  return keyed(id, keys as never) as Animatable<T>;
}

/**
 * A closed polygon with every corner rounded by `r` (exact enough: a cubic
 * whose handles reach 55 % of the way to the corner).
 */
export function roundedPoly(points: readonly Pt[], r: number): PathContour {
  const vertices: PathVertex[] = [];
  const n = points.length;
  const K = 0.55;
  for (let i = 0; i < n; i++) {
    const [px, py] = points[i];
    const [ax, ay] = points[(i - 1 + n) % n];
    const [bx, by] = points[(i + 1) % n];
    const la = Math.hypot(ax - px, ay - py);
    const lb = Math.hypot(bx - px, by - py);
    const ra = Math.min(r, la / 2);
    const rb = Math.min(r, lb / 2);
    const p1 = { x: px + ((ax - px) / la) * ra, y: py + ((ay - py) / la) * ra };
    const p2 = { x: px + ((bx - px) / lb) * rb, y: py + ((by - py) / lb) * rb };
    vertices.push({ point: p1, inTangent: { x: 0, y: 0 }, outTangent: { x: (px - p1.x) * K, y: (py - p1.y) * K } });
    vertices.push({ point: p2, inTangent: { x: (px - p2.x) * K, y: (py - p2.y) * K }, outTangent: { x: 0, y: 0 } });
  }
  return { closed: true, vertices };
}

/** An open polyline (for strokes). */
export function line(points: readonly Pt[]): PathContour {
  return {
    closed: false,
    vertices: points.map(([x, y]) => ({ point: { x, y }, inTangent: { x: 0, y: 0 }, outTangent: { x: 0, y: 0 } })),
  };
}

/** A gabled house outline, local to its base centre (0, 0). */
export function housePoints(w: number, wallH: number, roofH: number): Pt[] {
  const h = w / 2;
  return [
    [-h, 0],
    [-h, -wallH],
    [0, -wallH - roofH],
    [h, -wallH],
    [h, 0],
  ];
}

// ---------------------------------------------------------------------------
// Node builders. Positions are in the parent's space; rects are centred.

type Common = {
  x?: number;
  y?: number;
  position?: Animatable<Vec3>;
  scale?: Animatable<Vec3>;
  anchor?: { x: number; y: number };
  opacity?: Animatable<number>;
};

export function rectNode(
  id: string,
  out: number,
  o: Common & { w: number; h: number; r: number; style: ShapeStyle; size?: Animatable<{ width: number; height: number }>; radius?: Animatable<number> },
): SceneNode {
  return {
    ...base(id, baseOpts(out, o)),
    type: "rect",
    size: o.size ?? constant({ width: o.w, height: o.h }),
    cornerRadius: o.radius ?? constant(o.r),
    style: o.style,
  } as SceneNode;
}

export function ellipseNode(id: string, out: number, o: Common & { w: number; h: number; style: ShapeStyle }): SceneNode {
  return { ...base(id, baseOpts(out, o)), type: "ellipse", size: constant({ width: o.w, height: o.h }), style: o.style } as SceneNode;
}

export function pathNode(
  id: string,
  out: number,
  o: Common & { contours: PathContour[]; style: ShapeStyle; operators?: unknown[] },
): SceneNode {
  return {
    ...base(id, baseOpts(out, o)),
    type: "path",
    path: constant({ contours: o.contours }),
    style: o.style,
    ...(o.operators ? { operators: o.operators } : {}),
  } as SceneNode;
}

export function groupNode(id: string, out: number, children: string[], o: Common & { clipPathId?: string; isolation?: boolean } = {}): SceneNode {
  return {
    ...base(id, baseOpts(out, o)),
    type: "group",
    children,
    ...(o.clipPathId ? { clipPathId: o.clipPathId } : {}),
    ...(o.isolation ? { isolation: true } : {}),
  } as SceneNode;
}

function baseOpts(out: number, o: Common) {
  const anchor = o.anchor;
  const shared = {
    outTick: out,
    ...(anchor ? { anchor } : {}),
    ...(o.scale ? { scale: o.scale } : {}),
    ...(o.opacity !== undefined ? { opacity: o.opacity } : {}),
  };
  return o.position ? { ...shared, position: o.position } : { ...shared, x: o.x ?? 0, y: o.y ?? 0 };
}

export const solid = (c: ReturnType<typeof hex> | Animatable<ReturnType<typeof hex>>, opacity: number | Animatable<number> = 1): ShapeStyle => ({
  fill: fill(c, opacity),
});
export const inkLine = (width: number, opacity: number | Animatable<number> = 1, dash?: number[]): ShapeStyle => ({
  stroke: stroke(C.ink, width, { opacity, cap: "round", ...(dash ? { dash } : {}) }),
});

// ---------------------------------------------------------------------------
// Document assembly: one "rest" still state and one "play" once state.

export interface LensSpec {
  id: string;
  name: string;
  /** Last tick of motion; every track is back at rest by then. */
  end: number;
  nodes: Record<string, SceneNode>;
  roots: string[];
}

export function buildLens(spec: LensSpec): AnimationDocument {
  const duration = spec.end + FRAME * 2;
  for (const node of Object.values(spec.nodes)) node.outTick = duration;
  const markers = [marker("rest", 0, { name: "Rest" }), marker("play", 0, { name: "Play", durationTicks: spec.end })];
  const scene = withComputedRevision({
    version: ANIMATION_DOCUMENT_VERSION,
    id: `lens-${spec.id}`,
    name: spec.name,
    // Fully transparent: the web player clears to this colour, so the tile behind shows through.
    canvas: { width: SIZE, height: SIZE, pixelAspectRatio: 1, backgroundColor: hex("#f5f2ec00") },
    timing: { ticksPerSecond: TPS, frameRate: { numerator: 60, denominator: 1 }, durationTicks: duration, displayStartTick: 0 },
    assets: {},
    rootCompositionId: "main",
    components: {},
    compositions: {
      main: { id: "main", name: "Main", width: SIZE, height: SIZE, durationTicks: duration, nodes: spec.nodes, rootNodeIds: spec.roots },
    },
    markers,
    design: { tokens: { looping: false } },
    capabilities: { required: [], optional: [], unsupportedPolicy: "warn" },
  });
  const machine = stateMachine({ initial: "rest" })
    .state("rest", { marker: "rest" })
    .state("play", { marker: "play", playback: "once" })
    .on("complete", "play", "rest");
  const doc = withStateMachine(scene, machine, {});
  assertValidAnimationDocument(doc);
  assertRestMatchesEnd(doc, spec.end);
  return doc;
}

/** Every track must land back on its tick-0 value, or rest and end differ. */
function assertRestMatchesEnd(doc: AnimationDocument, end: number) {
  const walk = (value: unknown, path: string) => {
    if (!value || typeof value !== "object") return;
    const v = value as { kind?: string };
    if (v.kind === "keyframed") {
      const a = JSON.stringify(valueAt(value as Animatable<unknown>, 0, TPS));
      const b = JSON.stringify(valueAt(value as Animatable<unknown>, end, TPS));
      if (a !== b) throw new Error(`${doc.id}: ${path} rests at ${a} but ends at ${b}`);
      return;
    }
    for (const [k, child] of Object.entries(value)) walk(child, `${path}.${k}`);
  };
  walk(doc.compositions.main.nodes, "nodes");
}

// ---------------------------------------------------------------------------
// Static SVG of the resting frame (tick 0), for the poster and the fallback.

type AnyNode = SceneNode & Record<string, unknown>;

const css = (c: { r: number; g: number; b: number }) =>
  "#" + [c.r, c.g, c.b].map((n) => Math.round(n * 255).toString(16).padStart(2, "0")).join("");
const num = (n: number) => String(Math.round(n * 100) / 100);
const at = <T,>(a: Animatable<T> | undefined): T | undefined => (a === undefined ? undefined : valueAt(a, 0, TPS));

function styleAttrs(style: ShapeStyle): string | null {
  const parts: string[] = [];
  let visible = false;
  if (style.fill) {
    const o = at(style.fill.opacity) ?? 1;
    if (o > 0) visible = true;
    parts.push(`fill="${css(at(style.fill.color)!)}"`);
    if (o < 1) parts.push(`fill-opacity="${num(o)}"`);
  } else parts.push(`fill="none"`);
  if (style.stroke) {
    const o = at(style.stroke.opacity) ?? 1;
    if (o > 0) visible = true;
    parts.push(
      `stroke="${css(at(style.stroke.color)!)}"`,
      `stroke-width="${num(at(style.stroke.width)!)}"`,
      `stroke-linecap="${style.stroke.lineCap}"`,
      `stroke-linejoin="${style.stroke.lineJoin}"`,
    );
    if (o < 1) parts.push(`stroke-opacity="${num(o)}"`);
    const dash = at(style.stroke.dash);
    if (dash?.length) parts.push(`stroke-dasharray="${dash.map(num).join(" ")}"`);
  }
  return visible ? parts.join(" ") : null;
}

function contourD(c: PathContour): string {
  const v = c.vertices;
  let d = `M${num(v[0].point.x)} ${num(v[0].point.y)}`;
  const seg = (a: PathVertex, b: PathVertex) => {
    const straight = !a.outTangent.x && !a.outTangent.y && !b.inTangent.x && !b.inTangent.y;
    return straight
      ? `L${num(b.point.x)} ${num(b.point.y)}`
      : `C${num(a.point.x + a.outTangent.x)} ${num(a.point.y + a.outTangent.y)} ${num(b.point.x + b.inTangent.x)} ${num(b.point.y + b.inTangent.y)} ${num(b.point.x)} ${num(b.point.y)}`;
  };
  for (let i = 1; i < v.length; i++) d += seg(v[i - 1], v[i]);
  if (c.closed) d += seg(v[v.length - 1], v[0]) + "Z";
  return d;
}

export function restSvg(doc: AnimationDocument): string {
  const comp = doc.compositions.main;
  const nodes = comp.nodes as Record<string, AnyNode>;
  const clips: string[] = [];
  const shape = (n: AnyNode): string | null => {
    if (n.type === "rect") {
      const { width, height } = at(n.size as Animatable<{ width: number; height: number }>)!;
      const r = at(n.cornerRadius as Animatable<number>)!;
      return `<rect x="${num(-width / 2)}" y="${num(-height / 2)}" width="${num(width)}" height="${num(height)}" rx="${num(r)}"`;
    }
    if (n.type === "ellipse") {
      const { width, height } = at(n.size as Animatable<{ width: number; height: number }>)!;
      return `<ellipse cx="0" cy="0" rx="${num(width / 2)}" ry="${num(height / 2)}"`;
    }
    if (n.type === "path") {
      const ops = (n.operators as { type: string; end?: Animatable<number> }[] | undefined) ?? [];
      const trimEnd = ops.find((op) => op.type === "trim")?.end;
      if (trimEnd && (at(trimEnd) ?? 1) <= 0) return null;
      const data = at(n.path as Animatable<{ contours: PathContour[] }>)!;
      return `<path d="${data.contours.map(contourD).join("")}"`;
    }
    return null;
  };
  const xform = (n: AnyNode) => {
    const p = at(n.transform.position)!;
    const a = at(n.transform.anchor)!;
    const k = at(n.transform.scale)!;
    const parts: string[] = [];
    if (p.x || p.y) parts.push(`translate(${num(p.x)} ${num(p.y)})`);
    if (k.x !== 1 || k.y !== 1) parts.push(`scale(${num(k.x)} ${num(k.y)})`);
    if (a.x || a.y) parts.push(`translate(${num(-a.x)} ${num(-a.y)})`);
    return parts.length ? ` transform="${parts.join(" ")}"` : "";
  };
  const draw = (id: string): string => {
    const n = nodes[id];
    const op = at(n.opacity) ?? 1;
    if (op <= 0 || at(n.transform.scale)!.x === 0) return "";
    const opAttr = op < 1 ? ` opacity="${num(op)}"` : "";
    if (n.type === "group") {
      let clip = "";
      if (n.clipPathId) {
        const c = nodes[n.clipPathId as string];
        const cid = `${doc.id}-${n.clipPathId}`;
        clips.push(`<clipPath id="${cid}"><g${xform(c)}>${shape(c)}/></g></clipPath>`);
        clip = ` clip-path="url(#${cid})"`;
      }
      const inner = (n.children as string[]).map(draw).join("");
      return inner ? `<g${xform(n)}${opAttr}><g${clip}>${inner}</g></g>` : "";
    }
    const open = shape(n);
    const st = styleAttrs(n.style as ShapeStyle);
    if (!open || !st) return "";
    return `<g${xform(n)}${opAttr}>${open} ${st}/></g>`;
  };
  const body = comp.rootNodeIds.map(draw).join("");
  const defs = clips.length ? `<defs>${clips.join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="100%" height="100%" aria-hidden="true" focusable="false">${defs}${body}</svg>`;
}
