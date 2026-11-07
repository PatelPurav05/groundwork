/**
 * The Groundwork "Foundation" mark, exact geometry from src/components/LogoMark.tsx (32 grid).
 *
 * The SVG arcs in the house path (softened apex, doorway corners) are converted
 * to exact cubic Béziers here, because Clayzo's SVG importer flattens `A`
 * commands to chords. The coral shape is split into the slab and the doorway
 * stem (same outline, joined under the slab) so each can move on its own.
 */
import type { PathContour, PathVertex } from "@clayzo/animation/authoring";

export const HOUSE_D =
  "M15.05 4.62a1.5 1.5 0 0 1 1.9 0l9.1 7.47c.6.5.95 1.23.95 2.01V23H5V14.1c0-.78.35-1.51.95-2.01l9.1-7.47ZM13.5 23v-5.25a1.25 1.25 0 0 1 1.25-1.25h2.5a1.25 1.25 0 0 1 1.25 1.25V23h-5Z";
export const CORAL_D =
  "M14.75 17.75h2.5c.14 0 .25.11.25.25v6.25H28.75c.69 0 1.25.56 1.25 1.25v1.75c0 .69-.56 1.25-1.25 1.25H3.25C2.56 28.5 2 27.94 2 27.25V25.5c0-.69.56-1.25 1.25-1.25H14.5V18c0-.14.11-.25.25-.25Z";

/** The slab alone: x 2–30, y 24.25–28.5, corners r 1.25 (as in CORAL_D). */
export const SLAB_D =
  "M3.25 24.25H28.75c.69 0 1.25.56 1.25 1.25v1.75c0 .69-.56 1.25-1.25 1.25H3.25C2.56 28.5 2 27.94 2 27.25V25.5c0-.69.56-1.25 1.25-1.25Z";
/** The doorway stem alone, extended 0.6 into the slab so the join has no seam. */
export const STEM_D = "M14.75 17.75h2.5c.14 0 .25.11.25.25v6.85H14.5V18c0-.14.11-.25.25-.25Z";

type Seg = { x: number; y: number; c1?: [number, number]; c2?: [number, number] };

/** Endpoint-parameterised arc to cubic segments (SVG spec F.6.5). */
function arcToCubics(x1: number, y1: number, rx: number, ry: number, phiDeg: number, fa: number, fs: number, x2: number, y2: number): Seg[] {
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  let lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (fa === fs) co = -co;
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const pt = (t: number) => {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy] as [number, number];
  };
  const dpt = (t: number) => {
    const ex = -rx * Math.sin(t);
    const ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey] as [number, number];
  };
  const segs: Seg[] = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + i * step;
    const b = a + step;
    const [ax, ay] = pt(a);
    const [bx, by] = pt(b);
    const [dax, day] = dpt(a);
    const [dbx, dby] = dpt(b);
    segs.push({ x: bx, y: by, c1: [ax + k * dax, ay + k * day], c2: [bx - k * dbx, by - k * dby] });
  }
  return segs;
}

/** A small, exact SVG path parser (M L H V C A Z, absolute and relative) to Clayzo contours. */
export function svgToContours(d: string, map: (x: number, y: number) => [number, number] = (x, y) => [x, y]): PathContour[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let i = 0;
  const num = () => parseFloat(tokens[i++]);
  const isNum = () => i < tokens.length && !/[a-zA-Z]/.test(tokens[i]);
  const contours: { start: [number, number]; segs: Seg[] }[] = [];
  let cur: { start: [number, number]; segs: Seg[] } | null = null;
  let x = 0;
  let y = 0;
  let cmd = "";
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "Z") {
      if (cur) {
        x = cur.start[0];
        y = cur.start[1];
      }
      cur = null;
      continue;
    }
    if (C === "M") {
      const nx = num() + (rel ? x : 0);
      const ny = num() + (rel ? y : 0);
      x = nx;
      y = ny;
      cur = { start: [x, y], segs: [] };
      contours.push(cur);
      cmd = rel ? "l" : "L";
      continue;
    }
    if (!cur) throw new Error("path: drawing before M");
    if (C === "L") {
      x = num() + (rel ? x : 0);
      y = num() + (rel ? y : 0);
      cur.segs.push({ x, y });
    } else if (C === "H") {
      x = num() + (rel ? x : 0);
      cur.segs.push({ x, y });
    } else if (C === "V") {
      y = num() + (rel ? y : 0);
      cur.segs.push({ x, y });
    } else if (C === "C") {
      const ox = rel ? x : 0;
      const oy = rel ? y : 0;
      const c1: [number, number] = [num() + ox, num() + oy];
      const c2: [number, number] = [num() + ox, num() + oy];
      x = num() + ox;
      y = num() + oy;
      cur.segs.push({ x, y, c1, c2 });
    } else if (C === "A") {
      const rx = num();
      const ry = num();
      const rot = num();
      const fa = num();
      const fs = num();
      const nx = num() + (rel ? x : 0);
      const ny = num() + (rel ? y : 0);
      cur.segs.push(...arcToCubics(x, y, rx, ry, rot, fa, fs, nx, ny));
      x = nx;
      y = ny;
    } else throw new Error(`path: unsupported command ${cmd}`);
    if (!isNum()) continue;
  }
  // Segments → vertices with relative tangents.
  return contours.map(({ start, segs }) => {
    const pts: { p: [number, number]; inT: [number, number]; outT: [number, number] }[] = [{ p: start, inT: [0, 0], outT: [0, 0] }];
    for (const s of segs) {
      const prev = pts[pts.length - 1];
      if (s.c1) prev.outT = [s.c1[0] - prev.p[0], s.c1[1] - prev.p[1]];
      pts.push({ p: [s.x, s.y], inT: s.c2 ? [s.c2[0] - s.x, s.c2[1] - s.y] : [0, 0], outT: [0, 0] });
    }
    // A closing segment that returns exactly to the start merges into the first vertex.
    const last = pts[pts.length - 1];
    if (pts.length > 1 && Math.hypot(last.p[0] - start[0], last.p[1] - start[1]) < 1e-6) {
      pts[0].inT = last.inT;
      pts.pop();
    }
    const vertices: PathVertex[] = pts.map(({ p, inT, outT }) => {
      const [mx, my] = map(p[0], p[1]);
      const [ix, iy] = map(p[0] + inT[0], p[1] + inT[1]);
      const [ox, oy] = map(p[0] + outT[0], p[1] + outT[1]);
      return { point: { x: mx, y: my }, inTangent: { x: ix - mx, y: iy - my }, outTangent: { x: ox - mx, y: oy - my } };
    });
    return { closed: true, vertices };
  });
}

/** Map the 32 grid to canvas: unit scale k, with grid point (gx, gy) landing at (x, y). */
export const gridMap = (k: number, ox = 0, oy = 0) => (x: number, y: number): [number, number] => [ox + x * k, oy + y * k];

/** Reverse a contour's winding (for cutting holes under nonzero fill). */
export function reverseContour(c: PathContour): PathContour {
  const v = [...c.vertices].reverse().map((p) => ({ point: p.point, inTangent: p.outTangent, outTangent: p.inTangent }));
  return { closed: c.closed, vertices: v };
}

/** House contours with the doorway wound the other way, so nonzero fill cuts it out. */
export function houseContours(map: (x: number, y: number) => [number, number]): PathContour[] {
  const [outer, door] = svgToContours(HOUSE_D, map);
  return [outer, reverseContour(door)];
}
