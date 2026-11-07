/**
 * commercial — AB 2011, homes on commercial corridors.
 * Verb: grow. A low strip-mall block over striped parking; the stripes slide
 * away and the block grows into a mid-rise whose clay windows light up.
 */
import type { CubicBezier, Vec3 } from "@clayzo/animation/authoring";
import { C, EASE, IN, OUT, POP, buildLens, inkLine, line, pathNode, rectNode, s, solid, track, v3 } from "./shared";

const END = 360; // 1.5 s
const BASE = 208;
const W = 136;
const TALL = 136;
const LOW = 56;

const GROW: CubicBezier = { x1: 0.3, y1: 1.12, x2: 0.4, y2: 1 };

export function commercial() {
  // Height and centre share keys and easing, so the base never moves.
  const keys = (h: (k: number) => unknown) =>
    [
      [0, h(TALL), IN],
      [72, h(LOW), "hold"],
      [136, h(LOW), GROW],
      [256, h(TALL)],
    ] as const;
  const windows = [100, 136].flatMap((y, row) =>
    [112, 144, 176].map((x, col) => ({ x, y, i: (1 - row) * 3 + col })),
  ); // stagger bottom row first, left to right: the building fills as it rises

  const nodes: Record<string, ReturnType<typeof rectNode>> = {
    slab: rectNode("slab", END, { x: 144, y: 226, w: 244, h: 36, r: 14, style: solid(C.stone) }),
    stripes: pathNode("stripes", END, {
      contours: [52, 82, 112, 142, 172, 202, 232].map((x) => line([[x, 216], [x - 8, 236]])),
      position: track<Vec3>("stripes.pos", [
        [0, v3(-20, 0), EASE],
        [64, v3(0, 0), "hold"],
        [136, v3(0, 0), OUT],
        [224, v3(28, 0), "hold"],
        [232, v3(-20, 0)],
      ]),
      style: inkLine(5, track("stripes.op", [[0, 0, EASE], [64, 0.3, "hold"], [136, 0.3, EASE], [208, 0]])),
    }),
    block: rectNode("block", END, {
      w: W,
      h: TALL,
      r: 10,
      size: track("block.size", keys((h) => ({ width: W, height: h })) as never),
      position: track("block.pos", keys((h) => v3(144, BASE - h / 2)) as never),
      style: solid(C.ink),
    }),
    storefront: rectNode("storefront", END, { x: 144, y: 188, w: 112, h: 22, r: 6, style: solid(C.claySoft) }),
  };
  for (const w of windows) {
    const t0 = 200 + w.i * 12; // 50 ms stagger
    nodes[`win${w.i}`] = rectNode(`win${w.i}`, END, {
      x: w.x,
      y: w.y,
      w: 22,
      h: 20,
      r: 5,
      scale: track(`win${w.i}.scale`, [
        [0, s(1), "hold"],
        [40, s(0.6), "hold"],
        [t0, s(0.6), POP],
        [t0 + 72, s(1)],
      ]),
      style: solid(C.clay, track(`win${w.i}.op`, [[0, 1, IN], [40, 0, "hold"], [t0, 0, EASE], [t0 + 40, 1]])),
    });
  }
  return buildLens({
    id: "commercial",
    name: "Commercial corridors (AB 2011)",
    end: END,
    nodes,
    roots: ["slab", "stripes", "block", "storefront", ...windows.map((w) => `win${w.i}`)],
  });
}
