/**
 * backyard — SB 9, lot splits.
 * Verb: divide. A house on its lot; a dashed lot line draws down through the
 * yard and a second, smaller clay house appears in the new back lot.
 */
import { trim } from "@clayzo/animation/authoring";
import { C, EASE, IN, OUT, POP, buildLens, groupNode, housePoints, inkLine, line, pathNode, rectNode, roundedPoly, s, solid, track, v3 } from "./shared";

const END = 312; // 1.3 s
const BASE = 210;
const AX = 210; // second house centre

export function backyard() {
  const nodes = {
    lot: rectNode("lot", END, { x: 144, y: 160, w: 232, h: 148, r: 20, style: solid(C.green) }),
    split: pathNode("split", END, {
      contours: [line([[160, 98], [160, 222]])],
      operators: [
        trim("split.trim", {
          end: track("split.end", [
            [0, 1, IN],
            [48, 0, "hold"],
            [104, 0, OUT],
            [200, 1],
          ]),
        }),
      ],
      // Faded out while fully trimmed, so no round-cap dot lingers at the top.
      style: inkLine(5, track("split.op", [[0, 0.55, "hold"], [36, 0.55, IN], [48, 0, "hold"], [104, 0, "linear"], [120, 0.55]]), [9, 10]),
    }),
    home: pathNode("home", END, {
      contours: [roundedPoly(housePoints(84, 60, 34).map(([x, y]) => [x + 94, y + BASE] as const), 7)],
      style: solid(C.ink),
    }),
    homeDoor: rectNode("homeDoor", END, { x: 94, y: 193, w: 20, h: 32, r: 7, style: solid(C.paper) }),
    adu: groupNode("adu", END, ["aduBody", "aduDoor"], {
      anchor: { x: AX, y: BASE },
      isolation: true,
      position: track("adu.pos", [
        [0, v3(AX, BASE), "hold"],
        [168, v3(AX, BASE + 14), OUT],
        [272, v3(AX, BASE)],
      ]),
      scale: track("adu.scale", [
        [0, s(1), IN],
        [56, s(0.6), "hold"],
        [168, s(0.6), POP],
        [272, s(1)],
      ]),
      opacity: track("adu.op", [
        [0, 1, IN],
        [56, 0, "hold"],
        [168, 0, EASE],
        [216, 1],
      ]),
    }),
    aduBody: pathNode("aduBody", END, {
      contours: [roundedPoly(housePoints(56, 40, 24).map(([x, y]) => [x + AX, y + BASE] as const), 6)],
      style: solid(C.clay),
    }),
    aduDoor: rectNode("aduDoor", END, { x: AX, y: 198, w: 14, h: 22, r: 5, style: solid(C.paper) }),
  };
  return buildLens({
    id: "backyard",
    name: "Lot splits (SB 9)",
    end: END,
    nodes,
    roots: ["lot", "split", "home", "homeDoor", "adu"],
  });
}
