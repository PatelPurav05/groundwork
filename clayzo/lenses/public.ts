/**
 * public — Surplus Land Act.
 * Verb: claim. A public parcel with a marker flag; the flag unfurls clay
 * ("available") and a house lands on the parcel.
 */
import { fill } from "@clayzo/animation/authoring";
import { C, EASE, IN, OUT, POP, buildLens, groupNode, housePoints, pathNode, rectNode, roundedPoly, s, solid, track, v3 } from "./shared";

const END = 312; // 1.3 s
const BASE = 206;
const HX = 190; // house centre

export function publicLand() {
  const nodes = {
    parcel: rectNode("parcel", END, { x: 144, y: 204, w: 236, h: 56, r: 18, style: solid(C.green) }),
    pole: rectNode("pole", END, { x: 82, y: 152, w: 7, h: 112, r: 3.5, style: solid(C.ink) }),
    flag: pathNode("flag", END, {
      contours: [roundedPoly([[84, 98], [134, 98], [122, 115], [134, 132], [84, 132]], 4)],
      anchor: { x: 84, y: 115 },
      position: track("flag.pos", [[0, v3(84, 115)]]),
      scale: track("flag.scale", [
        [0, s(1), IN],
        [48, s(0.82, 1), "hold"],
        [104, s(0.82, 1), POP],
        [184, s(1)],
      ]),
      style: {
        fill: fill(
          track("flag.color", [
            [0, C.clay, EASE],
            [48, C.ink, "hold"],
            [104, C.ink, EASE],
            [168, C.clay],
          ]),
        ),
      },
    }),
    house: groupNode("house", END, ["houseBody", "houseDoor"], {
      anchor: { x: HX, y: BASE },
      isolation: true,
      position: track("house.pos", [
        [0, v3(HX, BASE), "hold"],
        [152, v3(HX, BASE - 22), OUT],
        [256, v3(HX, BASE)],
      ]),
      scale: track("house.scale", [
        [0, s(1), IN],
        [56, s(0.6), "hold"],
        [152, s(0.6), POP],
        [256, s(1)],
      ]),
      opacity: track("house.op", [
        [0, 1, IN],
        [56, 0, "hold"],
        [152, 0, EASE],
        [200, 1],
      ]),
    }),
    houseBody: pathNode("houseBody", END, {
      contours: [roundedPoly(housePoints(76, 54, 32).map(([x, y]) => [x + HX, y + BASE] as const), 7)],
      style: solid(C.clay),
    }),
    houseDoor: rectNode("houseDoor", END, {
      x: HX,
      y: BASE - 1,
      anchor: { x: 0, y: 13 },
      w: 18,
      h: 26,
      r: 6,
      scale: track("houseDoor.scale", [[0, s(1), "hold"], [56, s(0.6), "hold"], [208, s(0.6), OUT], [280, s(1)]]),
      style: solid(C.paper, track("houseDoor.op", [[0, 1, IN], [40, 0, "hold"], [208, 0, EASE], [256, 1]])),
    }),
  };
  return buildLens({
    id: "public",
    name: "Public land (Surplus Land Act)",
    end: END,
    nodes,
    roots: ["parcel", "pole", "flag", "house"],
  });
}
