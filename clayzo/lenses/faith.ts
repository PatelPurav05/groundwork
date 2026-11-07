/**
 * faith — SB 4, church land.
 * Verb: rise. A chapel with a steeple stands on its lot; parking stripes give
 * way as a small clay house rises beside it.
 */
import { C, IN, OUT, POP, EASE, buildLens, ellipseNode, groupNode, housePoints, inkLine, line, pathNode, rectNode, roundedPoly, s, solid, track, v3 } from "./shared";

const END = 288; // 1.2 s
const BASE = 208; // where buildings stand

export function faith() {
  const nodes = {
    lot: rectNode("lot", END, { x: 144, y: 214, w: 240, h: 40, r: 16, style: solid(C.stone) }),
    stripes: pathNode("stripes", END, {
      contours: [182, 204, 226].map((x) => line([[x, 200], [x, 224]])),
      style: inkLine(5, track("stripes.op", [[0, 0, EASE], [56, 0.32, "hold"], [128, 0.32, EASE], [184, 0]])),
    }),
    steeple: pathNode("steeple", END, {
      contours: [roundedPoly([[110, 40], [123, 68], [123, 112], [97, 112], [97, 68]], 4)],
      style: solid(C.ink),
    }),
    chapel: pathNode("chapel", END, {
      contours: [roundedPoly([[68, BASE], [68, 134], [110, 98], [152, 134], [152, BASE]], 7)],
      style: solid(C.ink),
    }),
    rose: ellipseNode("rose", END, { x: 110, y: 146, w: 18, h: 18, style: solid(C.paper) }),
    door: rectNode("door", END, { x: 110, y: 192, w: 24, h: 36, r: 11, style: solid(C.paper) }),

    // The new home: rises from the lot, anchored at its base.
    house: groupNode("house", END, ["houseBody", "houseDoor"], {
      anchor: { x: 204, y: BASE },
      isolation: true,
      position: track("house.pos", [
        [0, v3(204, BASE), "hold"],
        [112, v3(204, BASE + 16), OUT],
        [232, v3(204, BASE)],
      ]),
      scale: track("house.scale", [
        [0, s(1), IN],
        [56, s(0.6), "hold"],
        [112, s(0.6), POP],
        [232, s(1)],
      ]),
      opacity: track("house.op", [
        [0, 1, IN],
        [56, 0, "hold"],
        [112, 0, EASE],
        [168, 1],
      ]),
    }),
    houseBody: pathNode("houseBody", END, {
      contours: [roundedPoly(housePoints(56, 48, 26).map(([x, y]) => [x + 204, y + BASE] as const), 6)],
      style: solid(C.clay),
    }),
    houseDoor: rectNode("houseDoor", END, {
      // Scales from its sill: anchor at the bottom edge of the centred rect.
      x: 204,
      y: 206,
      anchor: { x: 0, y: 12 },
      w: 14,
      h: 24,
      r: 5,
      scale: track("houseDoor.scale", [[0, s(1), "hold"], [56, s(0.6), "hold"], [176, s(0.6), OUT], [248, s(1)]]),
      style: solid(C.paper, track("houseDoor.op", [[0, 1, IN], [40, 0, "hold"], [176, 0, EASE], [224, 1]])),
    }),
  };
  return buildLens({
    id: "faith",
    name: "Church land (SB 4)",
    end: END,
    nodes,
    roots: ["lot", "stripes", "steeple", "chapel", "rose", "door", "house"],
  });
}
