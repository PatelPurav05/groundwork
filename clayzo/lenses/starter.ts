/**
 * starter — SB 684 / SB 1123, small-lot starter homes.
 * Verb: split. One lot tile subdivides into six small tiles, and a tiny clay
 * house pops onto each in turn.
 */
import { C, EASE, IN, OUT, POP, buildLens, groupNode, housePoints, pathNode, rectNode, roundedPoly, s, solid, track } from "./shared";

const END = 328; // ~1.37 s
const LOT = { x: 144, y: 150, w: 216, h: 156, r: 22 };
const GAP = 10;
const COLS = 3;
const ROWS = 2;
const TW = (LOT.w - GAP * (COLS - 1)) / COLS;
const TH = (LOT.h - GAP * (ROWS - 1)) / ROWS;

export function starter() {
  const left = LOT.x - LOT.w / 2;
  const top = LOT.y - LOT.h / 2;
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return { i, cx: left + TW / 2 + col * (TW + GAP), cy: top + TH / 2 + row * (TH + GAP) };
  });

  const nodes: Record<string, ReturnType<typeof rectNode>> = {
    // Clips the tiles to the lot, so merged they read as one rounded tile.
    lotClip: rectNode("lotClip", END, { x: LOT.x, y: LOT.y, w: LOT.w, h: LOT.h, r: LOT.r, style: {} }),
  };
  const tileIds: string[] = [];
  const houseIds: string[] = [];
  const merged = { width: TW + GAP + 1, height: TH + GAP + 1 };
  const apart = { width: TW, height: TH };
  for (const c of cells) {
    const id = `tile${c.i}`;
    tileIds.push(id);
    nodes[id] = rectNode(id, END, {
      x: c.cx,
      y: c.cy,
      w: TW,
      h: TH,
      r: 12,
      size: track(`${id}.size`, [
        [0, apart, EASE],
        [80, merged, "hold"],
        [112, merged, OUT],
        [200, apart],
      ]),
      radius: track(`${id}.r`, [
        [0, 12, EASE],
        [80, 0, "hold"],
        [112, 0, OUT],
        [200, 12],
      ]),
      style: solid(C.green),
    });

    const hid = `home${c.i}`;
    houseIds.push(hid);
    const bx = c.cx;
    const by = c.cy + 19;
    const t0 = 164 + c.i * 12; // 50 ms stagger, reading order
    nodes[hid] = pathNode(hid, END, {
      contours: [roundedPoly(housePoints(32, 20, 14).map(([x, y]) => [x + bx, y + by] as const), 4)],
      anchor: { x: bx, y: by },
      x: bx,
      y: by,
      scale: track(`${hid}.scale`, [
        [0, s(1), IN],
        [48, s(0.6), "hold"],
        [t0, s(0.6), POP],
        [t0 + 80, s(1)],
      ]),
      style: solid(C.clay, track(`${hid}.op`, [[0, 1, IN], [48, 0, "hold"], [t0, 0, EASE], [t0 + 44, 1]])),
    });
  }
  nodes.tiles = groupNode("tiles", END, tileIds, { clipPathId: "lotClip" });
  return buildLens({
    id: "starter",
    name: "Starter homes (SB 684 / SB 1123)",
    end: END,
    nodes,
    roots: ["tiles", ...houseIds],
  });
}
