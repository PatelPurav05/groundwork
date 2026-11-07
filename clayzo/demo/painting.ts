/**
 * The opening shot: Orange County at sunset, in thick palette-knife oil.
 *
 * Looking east from Santa Ana at the moment Saddleback goes pink: Modjeska (left) and Santiago
 * (right, higher) with the saddle between, the Belt of Venus over them, dry foothills, rows of
 * orange trees (the county's namesake), fan palms, and a mission-style church with a wide,
 * empty parking lot: the kind of land SB 4 opened.
 *
 * Art direction
 *   verb      glint: a low warm light swings across the ridges of paint
 *   geometry  knife strokes: broad loose diagonals in the sky, strokes along every edge below
 *   palette   east-facing sunset: sky #8FA3CD -> lavender #A3A7CF -> Belt of Venus #E9B7A8 ->
 *             peach #F5D7B6; alpenglow #DCA08F, violet shadow #7E7699; chaparral #7A7A5E;
 *             grove green #2F4A2C / #7C9448, fruit #F28A26; stucco #F3DDC2, tile #B4553A;
 *             asphalt #85807C, stall paint #EFE8DA
 *   scale     the painting is the whole frame; the upper-left sky stays calm for the titles
 *
 * Two layers, two passes: the sky (broad, low relief, so titles sit on it) and the land over it
 * (edge-following knife strokes, ragged silhouette against the sky). Nothing in the flat
 * pictures is animated; only the light swings.
 */
import type { Animatable, SceneNode } from "@clayzo/animation/authoring";
import { flatPicture } from "./paint/flat";
import { stillPass } from "./paint/paint";

export const PW = 1920;
export const PH = 1080;
const HORIZON = 600;

type Pt = [number, number];

export function painting(nodes: Record<string, SceneNode>, end: number, phase: Animatable<number>) {
  const F = flatPicture(nodes, end, 23);

  // ================================================================ sky layer
  const S: string[] = [];
  S.push(
    F.grad("sky", F.rect(-6, -10, PW + 12, PH + 20), -10, HORIZON + 40, [
      [0, "#8FA3CD"],
      [0.34, "#A3A7CF"],
      [0.6, "#C9AEC6"],
      [0.78, "#E9B7A8"],
      [1, "#F5D7B6"],
    ]),
  );
  S.push(F.glow("venus", 1360, 470, 1500, 260, "#F8D2BC", 0.75));
  S.push(F.glow("calm", 520, 230, 1300, 420, "#A2B1D6", 0.5));
  const streaks: [number, number, number, number, string, number][] = [
    [1180, 150, 560, 34, "#D9B3C4", 0.75],
    [1560, 210, 640, 30, "#E6BFC0", 0.7],
    [1010, 246, 380, 22, "#CDB0CB", 0.6],
    [1780, 118, 420, 26, "#D6B6C8", 0.55],
  ];
  streaks.forEach(([x, y, w, h, c, a], i) => S.push(F.blob(`cirrus${i}`, x, y, w, h, c, a, -4 + i * 1.6)));
  const skyFlat = F.group("skyFlat", S);

  // ================================================================ land layer
  const L: string[] = [];
  const box = (id: string, x: number, y: number, w: number, h: number, c: string, a = 1) => L.push(F.shape(id, F.rect(x, y, w, h), c, a));

  // ---------------------------------------------------------------- Saddleback
  L.push(F.shape("rangeFar", F.ridge([[560, 562], [760, 522], [960, 474], [1080, 436], [1240, 400], [1700, 404], [1930, 432]], HORIZON + 40), "#A595B2"));
  const body: Pt[] = [
    [620, 610], [760, 556], [880, 506], [990, 452], [1090, 392], [1170, 330], [1226, 298], [1262, 304],
    [1310, 334], [1366, 350], [1420, 328], [1476, 282], [1514, 262], [1556, 278], [1640, 334], [1740, 390],
    [1860, 430], [1980, 458], [1980, 660], [620, 660],
  ];
  L.push(F.shape("mtnBody", F.poly(body), "#B6879A"));
  // Alpenglow on the west faces (the sun is behind the viewer).
  L.push(F.shape("glowModjeska", F.poly([[880, 506], [990, 452], [1090, 392], [1170, 330], [1226, 298], [1238, 340], [1180, 420], [1100, 500], [980, 560], [860, 590]]), "#DCA08F"));
  L.push(F.shape("glowSantiago", F.poly([[1366, 350], [1420, 328], [1476, 282], [1514, 262], [1522, 300], [1488, 372], [1440, 450], [1380, 520], [1330, 470], [1350, 400]]), "#E2A894"));
  L.push(F.shape("glowStreak1", F.poly([[1250, 318], [1272, 310], [1240, 430], [1216, 486], [1196, 474]]), "#EFBBA4", 0.95));
  L.push(F.shape("glowStreak2", F.poly([[1530, 286], [1550, 292], [1534, 380], [1504, 464], [1484, 452]]), "#F1C1AA", 0.9));
  // Shadow faces: violet.
  L.push(F.shape("shadeSaddle", F.poly([[1262, 304], [1310, 334], [1366, 350], [1350, 420], [1290, 500], [1250, 470], [1244, 380]]), "#867AA0"));
  L.push(F.shape("shadeSantiago", F.poly([[1556, 278], [1640, 334], [1740, 390], [1860, 430], [1980, 458], [1980, 600], [1700, 600], [1600, 470], [1560, 380]]), "#7E7699"));
  [[1040, 470, 980, 590], [1150, 400, 1100, 560], [1420, 400, 1400, 560], [1640, 420, 1690, 580]].forEach(([x0, y0, x1, y1], i) =>
    L.push(F.line(`ravine${i}`, `M ${x0} ${y0} Q ${(x0 + x1) / 2 + 14} ${(y0 + y1) / 2} ${x1} ${y1}`, "#76688E", 14, 0.8)),
  );
  L.push(F.shape("chaparral", F.ridge([[600, 612], [780, 574], [960, 562], [1140, 550], [1320, 558], [1520, 542], [1720, 550], [1930, 538]], HORIZON + 60), "#7A7A5E"));
  L.push(F.shape("chaparralLit", F.ridge([[600, 628], [820, 600], [1060, 592], [1300, 598], [1560, 584], [1930, 588]], HORIZON + 60), "#9A8F64"));

  // ---------------------------------------------------------------- foothills and plain
  L.push(F.shape("foothillsL", F.ridge([[-10, 562], [160, 548], [360, 566], [560, 586], [760, 608]], HORIZON + 80), "#8C8768"));
  L.push(F.shape("plain", F.ridge([[-10, 614], [400, 606], [900, 618], [1400, 608], [1930, 614]], PH + 10), "#A79A62"));
  L.push(F.glow("plainWarm", 900, 650, 1600, 130, "#E3C78A", 0.5));
  for (let i = 0; i < 34; i++) {
    const x = F.rnd() * PW;
    const w = 50 + F.rnd() * 80;
    L.push(F.blob(`farTree${i}`, x, 622 + F.rnd() * 10, w, 22 + F.rnd() * 10, F.rnd() > 0.5 ? "#5E6B45" : "#6E764C", 0.9));
  }

  // ---------------------------------------------------------------- palms (behind the church and lot)
  const GROUND = 806;
  const palm = (id: string, x: number, top: number, lean: number) => {
    L.push(F.line(`${id}Trunk`, `M ${x} ${GROUND} C ${x + lean * 0.3} ${(GROUND + top) / 2} ${x + lean * 0.8} ${top + 60} ${x + lean} ${top}`, "#3B2E26", 22));
    const hx = x + lean;
    const fronds: [number, number, string][] = [
      [-160, 60, "#33492C"], [-118, 92, "#3E5634"], [-70, 100, "#2E4428"], [-24, 104, "#40593A"], [26, 100, "#33492C"],
      [74, 92, "#3E5634"], [124, 70, "#2E4428"], [172, 48, "#3A5131"],
    ];
    fronds.forEach(([ang, len, c], i) => {
      const a = ((ang - 90) * Math.PI) / 180;
      const ex = hx + Math.cos(a) * len * 1.3;
      const ey = top + Math.sin(a) * len * 0.7 + len * 0.62;
      L.push(F.line(`${id}Frond${i}`, `M ${hx} ${top} Q ${(hx + ex) / 2} ${Math.min(top, ey) - 26} ${ex} ${ey}`, c, 28));
    });
    L.push(F.blob(`${id}Lit`, hx - 18, top - 10, 96, 34, "#7E914E", 0.95, -12));
  };
  palm("palmA", 1430, 404, 12);
  palm("palmB", 1640, 360, -16);
  palm("palmC", 1800, 440, 8);

  // ---------------------------------------------------------------- orange grove (left), rows in perspective
  const VP: Pt = [980, 614];
  const rows = 7;
  for (let r = 0; r < rows; r++) {
    const t = (r + 1) / (rows + 1);
    const endX = -260 + r * 150;
    const endY = 700 + t * 520;
    const trees = 9;
    for (let k = trees - 1; k >= 0; k--) {
      const u = Math.pow((k + 1) / trees, 1.6);
      const x = VP[0] + (endX - VP[0]) * u;
      const y = VP[1] + (endY - VP[1]) * u;
      if (x > 700 && y > 640) continue; // keep the church and the lot clear
      const s = 14 + 150 * u;
      const id = `tree${r}_${k}`;
      L.push(F.blob(`${id}Shadow`, x + s * 0.12, y + s * 0.06, s * 1.25, s * 0.42, "#3A4A2C", 0.75));
      L.push(F.blob(`${id}Dark`, x, y - s * 0.32, s * 1.1, s * 0.86, "#2F4A2C"));
      L.push(F.blob(`${id}Mid`, x - s * 0.08, y - s * 0.44, s * 0.86, s * 0.62, "#456736"));
      L.push(F.blob(`${id}Lit`, x - s * 0.18, y - s * 0.56, s * 0.5, s * 0.34, "#7C9448", 0.95));
      if (s > 50) {
        const n = Math.round(s / 26);
        for (let f = 0; f < n; f++) {
          const fx = x + (F.rnd() - 0.5) * s * 0.8;
          const fy = y - s * 0.3 + (F.rnd() - 0.5) * s * 0.5;
          const fr = Math.max(12, s * 0.12);
          L.push(F.blob(`${id}Fruit${f}`, fx, fy, fr, fr, F.rnd() > 0.4 ? "#F28A26" : "#F7A63C"));
        }
      }
    }
  }
  L.push(F.glow("groveDust", 260, 960, 1100, 260, "#C9A46A", 0.35));

  // ---------------------------------------------------------------- the church, drawn at 1.3x about its door sill
  const K = 1.3;
  const CX = 1080;
  const ch = (x: number, y: number): Pt => [CX + (x - 1040) * K, GROUND + (y - 772) * K];
  const P = (pts: Pt[]) => F.poly(pts.map(([x, y]) => ch(x, y)));
  L.push(F.shape("nave", P([[1110, 640], [1330, 622], [1330, 742], [1110, 772]]), "#D7BEA2"));
  L.push(F.shape("naveRoof", P([[1100, 642], [1190, 600], [1336, 590], [1336, 626]]), "#9E4A33"));
  L.push(F.shape("naveRoofLit", P([[1120, 634], [1196, 604], [1320, 596], [1320, 612], [1200, 618]]), "#C0613F"));
  L.push(F.shape("facade", P([[930, 772], [930, 640], [960, 640], [968, 612], [996, 604], [1012, 572], [1040, 560], [1068, 572], [1084, 604], [1112, 612], [1120, 640], [1150, 640], [1150, 772]]), "#F3DDC2"));
  L.push(F.shape("facadeShade", P([[1118, 640], [1150, 640], [1150, 772], [1118, 772]]), "#D5BB9E"));
  L.push(F.shape("door", P([[1020, 772], [1020, 712], [1030, 698], [1050, 698], [1060, 712], [1060, 772]]), "#5A3A30"));
  const [rx, ry] = ch(1040, 632);
  L.push(F.blob("rose", rx, ry, 30 * K, 30 * K, "#8A5A44"));
  for (const x of [966, 1114]) L.push(F.shape(`win${x}`, P([[x - 9, 720], [x - 9, 688], [x, 678], [x + 9, 688], [x + 9, 720]]), "#6A4638"));
  L.push(F.shape("towerBody", P([[868, 520], [932, 520], [932, 772], [868, 772]]), "#EAD2B4"));
  L.push(F.shape("towerShade", P([[912, 520], [932, 520], [932, 772], [912, 772]]), "#CDB396"));
  L.push(F.shape("towerCap", P([[860, 524], [900, 476], [940, 524]]), "#B4553A"));
  L.push(F.shape("towerCapLit", P([[866, 520], [900, 482], [904, 520]]), "#CF6A44"));
  L.push(F.shape("bellArch", P([[886, 590], [886, 556], [900, 544], [914, 556], [914, 590]]), "#4E3028"));
  L.push(F.shape("bellArch2", P([[886, 652], [886, 622], [900, 612], [914, 622], [914, 652]]), "#5E3A30"));
  const [tx, ty] = ch(900, 476);
  L.push(F.line("cross", `M ${tx} ${ty} L ${tx} ${ty - 50} M ${tx - 16} ${ty - 34} L ${tx + 16} ${ty - 34}`, "#3E2A24", 9));
  L.push(F.shape("hedge", F.ridge([[880, GROUND], [960, GROUND - 10], [1060, GROUND - 4], [1160, GROUND - 12], [1300, GROUND - 6], [1440, GROUND - 12]], GROUND + 22), "#4D6A3A"));

  // ---------------------------------------------------------------- the empty parking lot
  const LOT_TOP = GROUND + 16;
  L.push(F.shape("lot", F.poly([[740, LOT_TOP], [1930, LOT_TOP - 10], [1930, PH + 10], [500, PH + 10]]), "#85807C"));
  L.push(F.glow("lotSheen", 1280, 900, 1100, 220, "#B9AE9E", 0.55));
  // Far row of stalls: lines converging toward the church.
  for (let i = 0; i < 9; i++) {
    const x0 = 860 + i * 124;
    const x1 = 700 + i * 176;
    L.push(F.line(`stall${i}`, `M ${x0} ${LOT_TOP + 10} L ${x1} ${LOT_TOP + 140}`, "#EFE8DA", 12, 0.95));
  }
  L.push(F.line("aisle", `M 590 ${LOT_TOP + 150} L 1930 ${LOT_TOP + 140}`, "#E6DECF", 12, 0.85));
  // Near row, wider apart.
  for (let i = 0; i < 6; i++) {
    const x0 = 680 + i * 250;
    L.push(F.line(`stallNear${i}`, `M ${x0 + 40} ${LOT_TOP + 176} L ${x0 - 40} ${PH + 10}`, "#EFE8DA", 16, 0.95));
  }
  L.push(F.shape("curb", F.poly([[500, PH + 10], [740, LOT_TOP], [762, LOT_TOP], [530, PH + 10]]), "#D9CFBE"));
  L.push(F.shape("grassL", F.ridge([[-10, 1000], [200, 980], [420, 1010], [520, 1040]], PH + 10), "#B9995A"));
  const landFlat = F.group("landFlat", L);

  // ================================================================ the paint
  const sky = F.add(
    stillPass({ id: "skyPaint", input: skyFlat, end, cell: 46, relief: 6, detail: 0.2, horizonY: 2000, lightSwing: 0.35, phase }),
  );
  const land = F.add(
    stillPass({ id: "landPaint", input: landFlat, end, cell: 30, relief: 13, detail: 0.14, horizonY: 0, baseAngle: 0, verticalLuma: 0.22, lightSwing: 0.5, phase }),
  );
  return F.group("painting", [sky, land]);
}
