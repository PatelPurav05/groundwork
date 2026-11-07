// Drawing the FLAT picture the paint passes repaint. It is a plain Clayzo shape picture: flat
// colour regions in the right places. The passes supply the brushwork, so draw shapes and
// colours, not texture. See references/flat-picture.md for what reads well under the strokes.
//
//   const F = flatPicture(nodes, END, 11);
//   const sky = F.group("skyFlat", [F.grad("skyGrad", F.rect(0, 0, W, 600), 0, 560, [[0, "#9AA0B2"], [1, "#DEDAD6"]])]);

import { base, constant, fill, parseSvgPath, type SceneNode } from "@clayzo/animation/authoring";
import { hex } from "./paint";

type Pt = [number, number];

/** A cornflower-style head palette: light petal tips, mid body, dark underside, dark centre. */
export interface HeadPalette { light: string; mid: string; dark: string; centre: string; stamen?: string }

export function flatPicture(nodes: Record<string, SceneNode>, end: number, seed = 11) {
  let s = seed;
  /** Deterministic 0..1, so every build draws the same picture (and the same strokes). */
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const add = (n: SceneNode) => ((nodes[n.id] = n), n.id);
  // Template-string paths: exponent notation (1e-7) and NaN break the parser, so catch both here.
  const svg = (d: string) => {
    if (d.includes("NaN")) throw new Error(`path has NaN (a Math.pow of a negative base?): ${d.slice(0, 120)}`);
    return parseSvgPath(d.replace(/-?\d*\.?\d+e[-+]?\d+/gi, (m) => Number(m).toFixed(3))).path;
  };

  const poly = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";
  const rect = (x: number, y: number, w: number, h: number) => `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  /** A smooth ridge or field edge through points, closed down to `bottom`. */
  const ridge = (pts: Pt[], bottom: number) => {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
      d += ` C ${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
    }
    return `${d} L ${pts[pts.length - 1][0]} ${bottom} L ${pts[0][0]} ${bottom} Z`;
  };
  /** A spiky round head: n petals with uneven tips, squashed to `ys`. Keep `inner` 0.7+ for
   *  ruffled flowers; low values read as stars. */
  const star = (cx: number, cy: number, r: number, inner: number, n: number, ys: number, rot = 0) => {
    const pts: Pt[] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r * (0.82 + rnd() * 0.3) : r * inner;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * ys]);
    }
    return poly(pts);
  };

  const shape = (id: string, d: string, c: string, a = 1) => add({
    ...base(id, { outTick: end }), type: "path", path: constant(svg(d)), style: { fill: fill(hex(c), a) },
  } as any);
  /** A path filled with a vertical gradient from y0 to y1. */
  const grad = (id: string, d: string, y0: number, y1: number, stops: [number, string][]) => add({
    ...base(id, { outTick: end }), type: "path", path: constant(svg(d)),
    style: { gradientFill: { kind: "linear", start: constant({ x: 0, y: y0 }), end: constant({ x: 0, y: y1 }), opacity: constant(1),
      stops: constant(stops.map(([p, c]) => ({ position: p, color: hex(c) }))) } },
  } as any);
  const blob = (id: string, x: number, y: number, w: number, h: number, c: string, a = 1, rot = 0) => add({
    ...base(id, { outTick: end, x, y, rotation: constant({ x: 0, y: 0, z: rot }) } as any), type: "ellipse",
    size: constant({ width: w, height: h }), style: { fill: fill(hex(c), a) },
  } as any);
  /** A soft radial glow (light breaking through, a sun, a warm wash on a field). */
  const glow = (id: string, x: number, y: number, w: number, h: number, c: string, a: number) => add({
    ...base(id, { outTick: end, x, y, scale: constant({ x: 1, y: h / w, z: 1 }) } as any), type: "ellipse",
    size: constant({ width: w, height: w }),
    style: { gradientFill: { kind: "radial", start: constant({ x: 0, y: 0 }), end: constant({ x: w / 2, y: 0 }), opacity: constant(1),
      stops: constant([{ position: 0, color: hex(c, a) }, { position: 0.4, color: hex(c, a * 0.7) }, { position: 1, color: hex(c, 0) }]) } },
  } as any);
  const line = (id: string, d: string, c: string, width: number, a = 1) => add({
    ...base(id, { outTick: end }), type: "path", path: constant(svg(d)),
    style: { stroke: { color: constant(hex(c)), opacity: constant(a), width: constant(width), lineCap: "round", lineJoin: "round", miterLimit: 4 } },
  } as any);
  const group = (id: string, children: string[]) => add({ ...base(id, { outTick: end }), type: "group", children } as any);

  /** A row of conifer spires as ONE compound path per colour. Hundreds of separate spires bloat
   *  the document and crash `clayzo review` (an overlong diagnostic summary). */
  const spires = (id: string, x0: number, x1: number, top: (x: number) => number, baseY: number, cols: string[], step: number, hJit: number) => {
    const byColour = new Map<string, string[]>(cols.map((c) => [c, []]));
    for (let x = x0; x <= x1; x += step + rnd() * step) {
      const t = top(x) - rnd() * hJit;
      const w = 10 + Math.pow(rnd(), 2) * 34;
      byColour.get(pick(cols))!.push(poly([[x - w / 2, baseY], [x - w * 0.3, t + (baseY - t) * 0.45], [x - w * 0.12, t + (baseY - t) * 0.2], [x, t], [x + w * 0.12, t + (baseY - t) * 0.2], [x + w * 0.3, t + (baseY - t) * 0.45], [x + w / 2, baseY]]));
    }
    return [...byColour].filter(([, ds]) => ds.length).map(([c, ds], i) => shape(`${id}${i}`, ds.join(" "), c));
  };

  /** A cornflower-like head: dark underside, mid body, light upper petals, a few lit petals
   *  fanning up, a dark core and centre. The radiating strokes of the field and rooted passes
   *  turn it into ruffled petals. */
  const flowerHead = (id: string, cx: number, cy: number, r: number, P: HeadPalette) => {
    const out = [
      shape(`${id}Dark`, star(cx, cy + r * 0.08, r, 0.74, 20, 0.6, rnd()), P.dark),
      shape(`${id}Mid`, star(cx - r * 0.02, cy - r * 0.05, r * 0.92, 0.72, 18, 0.58, rnd()), P.mid),
      shape(`${id}Light`, star(cx - r * 0.06, cy - r * 0.2, r * 0.74, 0.68, 14, 0.46, rnd()), P.light, 0.92),
    ];
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k - 1) * 0.6 + (rnd() - 0.5) * 0.3;
      out.push(blob(`${id}Petal${k}`, cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.32 - r * 0.05, r * 0.38, r * 0.15, P.light, 0.6, (a * 180) / Math.PI));
    }
    out.push(blob(`${id}Core`, cx, cy + r * 0.05, r * 0.5, r * 0.28, P.dark));
    out.push(blob(`${id}Centre`, cx, cy + r * 0.02, r * 0.3, r * 0.17, P.centre));
    out.push(blob(`${id}Stamen`, cx - r * 0.04, cy - r * 0.02, r * 0.14, r * 0.07, P.stamen ?? "#7A5AC0"));
    return out;
  };

  /** Grass blades from y0 down to y1, back to front, taller and wider toward the viewer.
   *  Vary the lean and keep bright yellow-greens rare, or the field reads as a barcode. */
  const blades = (id: string, count: number, W: number, y0: number, y1: number, cols: string[], maxLen = 270) => {
    const roots: Pt[] = [];
    for (let i = 0; i < count; i++) roots.push([rnd() * W, y0 + Math.pow(rnd(), 0.8) * (y1 - y0)]);
    roots.sort((a, b) => a[1] - b[1]);
    return roots.map(([x, y], i) => {
      const dz = (y - y0) / (y1 - y0), len = 40 + (maxLen - 40) * dz, lean = (rnd() - 0.4) * len * 0.25;
      return line(`${id}${i}`, `M ${x} ${y} C ${x + lean * 0.2} ${y - len * 0.5} ${x + lean * 0.7} ${y - len * 0.8} ${x + lean} ${y - len}`,
        pick(cols), 2.5 + 5 * dz, 0.95);
    });
  };

  return { rnd, pick, add, svg, poly, rect, ridge, star, shape, grad, blob, glow, line, group, spires, flowerHead, blades };
}
