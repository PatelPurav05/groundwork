/**
 * architecture — 1600×900, 9.6 s loop. The system, left to right.
 *
 * Art direction
 *   Verb: flow. Geometry: hairline cards (r 14), chips (r 10), hairline
 *   connectors, small round pulses. Palette: stock, ink, blue (data in
 *   motion, pass), coral (fail, the Claude accent), muted (unknown, captions).
 *   Words: the real names of sources, steps and rules; no marketing copy.
 *
 * Beats (s)
 *   0.00–0.20  still stock
 *   0.20–1.70  columns arrive left→right (title, card, contents staggered 50 ms)
 *   1.60–2.15  connectors draw on
 *   2.20–8.00  three pulse cycles (1.8 s each): sources → pipeline → rules → app;
 *              as each pulse reaches the rules engine the lens marks tick
 *              through pass / fail / unknown
 *   8.00–8.80  hold (last pulse lands in the app at 8.0)
 *   8.80–9.30  fade to stock; 9.30–9.60 still (= tick 0)
 */
import { C, FRAME, HAIR_A, IN, OUT, both, buildDoc, constant, ellipse, group, line, marker, path, polyline, rect, run, s, sec, solid, text, tr, v3, type Nodes } from "./kit";
import type { PathContour } from "@clayzo/animation/authoring";
import { CLAUDE_LINES, CLAUDE_TEXT } from "./strings";

export const W = 1600;
export const H = 900;
const D = sec(9.6);
const snap = (t: number) => Math.round(t / FRAME) * FRAME;

type Pt = [number, number];
const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};
const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt): PathContour => ({
  closed: false,
  vertices: [
    { point: { x: p0[0], y: p0[1] }, inTangent: { x: 0, y: 0 }, outTangent: { x: p1[0] - p0[0], y: p1[1] - p0[1] } },
    { point: { x: p3[0], y: p3[1] }, inTangent: { x: p2[0] - p3[0], y: p2[1] - p3[1] }, outTangent: { x: 0, y: 0 } },
  ],
});

export function architecture() {
  const nodes: Nodes = {};
  const roots: string[] = [];

  const TOP = 146; // column titles
  const BODY = 212; // cards start
  const BUS = 380; // the connector line between cards
  // Widths: the App card is sized so the widest Claude line fits on one line at 19 px.
  const GAP_X = 52;
  const widths = [268, 304, 260, 500];
  const titles = ["Public data", "Pipeline", "Rules engine", "App"];
  const cols = widths.map((w, i) => ({ x: 56 + widths.slice(0, i).reduce((a, b) => a + b, 0) + i * GAP_X, w, title: titles[i] }));
  const colT = (i: number) => 0.2 + i * 0.3;

  // Entrance helpers -------------------------------------------------------
  const fadeIn = (id: string, t0: number, dy = 10, ax = 0, ay = 0) => ({
    isolation: true,
    position: tr(`${id}.pos`, [[snap(sec(t0)), v3(ax, ay + dy), OUT], [snap(sec(t0 + 0.5)), v3(ax, ay)]]),
    opacity: tr(`${id}.op`, [[snap(sec(t0)), 0, OUT], [snap(sec(t0 + 0.35)), 1]]),
  });
  const cardIn = (id: string, t0: number, cx: number, cy: number) => ({
    isolation: true,
    anchor: { x: cx, y: cy },
    position: constant(v3(cx, cy)),
    scale: tr(`${id}.sc`, [[snap(sec(t0)), s(0.96), OUT], [snap(sec(t0 + 0.5)), s(1)]]),
    opacity: tr(`${id}.op`, [[snap(sec(t0)), 0, OUT], [snap(sec(t0 + 0.35)), 1]]),
  });
  const card = (id: string, x: number, y: number, w: number, h: number) =>
    (nodes[id] = rect(id, D, { x: x + w / 2, y: y + h / 2, w, h, r: 14, style: both(solid(C.stock), line(C.ink, 1.5, HAIR_A)) }));
  const label = (id: string, x: number, y: number, w: number, t: string, o: { font?: "ui" | "mono" | "display"; size?: number; weight?: number; color?: typeof C.ink; align?: "left" | "center" | "right" } = {}) =>
    (nodes[id] = text(id, D, {
      x,
      y,
      w,
      align: o.align,
      runs: [run({ text: t, font: o.font ?? "ui", size: o.size ?? 19, weight: o.weight ?? 500, color: o.color ?? C.ink, lineHeight: Math.round((o.size ?? 19) * 1.3) })],
    }));
  const hair = (id: string, x: number, y: number, w: number) => (nodes[id] = rect(id, D, { x: x + w / 2, y, w, h: 1.5, r: 0, style: solid(C.ink, HAIR_A) }));

  // Column titles ----------------------------------------------------------
  cols.forEach((c, i) => {
    const id = `title${i}`;
    label(`${id}.t`, 0, 0, c.w, c.title, { font: "display", size: 30, weight: 800 });
    nodes[id] = group(id, D, [`${id}.t`], fadeIn(id, colT(i), 10, c.x, TOP));
    roots.push(id);
  });

  // 1. Public data ---------------------------------------------------------
  const sources = ["Santa Ana parcels", "City zoning", "SCAG land use", "HCD surplus notices", "OpenStreetMap", "FEMA flood", "CAL FIRE", "Caltrans transit"];
  const CH = 44;
  const CG = 10;
  const chipY = (k: number) => BODY + k * (CH + CG);
  const c0 = cols[0];
  [...sources, "+18 more"].forEach((name, k) => {
    const id = `chip${k}`;
    const more = k === sources.length;
    nodes[`${id}.bg`] = rect(`${id}.bg`, D, {
      x: c0.w / 2,
      y: CH / 2,
      w: c0.w,
      h: CH,
      r: 10,
      style: more ? line(C.muted, 1.5, 0.6, [4, 5]) : both(solid(C.stock), line(C.ink, 1.5, HAIR_A)),
    });
    const kids = [`${id}.bg`];
    if (!more) {
      nodes[`${id}.dot`] = rect(`${id}.dot`, D, { x: 20, y: CH / 2, w: 8, h: 8, r: 2, style: solid(C.blue) });
      kids.push(`${id}.dot`);
    }
    label(`${id}.t`, more ? 16 : 36, CH / 2 - 17, c0.w - 48, name, { font: "mono", size: 18, color: more ? C.muted : C.ink });
    kids.push(`${id}.t`);
    nodes[id] = group(id, D, kids, fadeIn(id, colT(0) + 0.1 + k * 0.05, 8, c0.x, chipY(k)));
    roots.push(id);
  });
  const cap0Y = chipY(sources.length + 1) + 8;
  label("cap0.t", 0, 0, c0.w + 120, "26 public sources · cached once", { color: C.muted, size: 19 });
  nodes.cap0 = group("cap0", D, ["cap0.t"], fadeIn("cap0", colT(0) + 0.6, 6, c0.x, cap0Y));
  roots.push("cap0");

  // 2. Pipeline ------------------------------------------------------------
  const c1 = cols[1];
  const P = 24;
  const pRows = ["centroids + lot area", "point-in-polygon joins", "23-bit flags + enrichment"];
  const pH = P + 28 + 18 + pRows.length * 44 + 10 + 26 + 10 + 2 * 50 + P - 10;
  card("pipe.card", 0, 0, c1.w, pH);
  label("pipe.title", P, P - 2, c1.w - 2 * P, "scripts/data", { font: "mono", size: 20, weight: 600 });
  hair("pipe.h1", P, P + 40, c1.w - 2 * P);
  const pipeKids = ["pipe.card", "pipe.title", "pipe.h1"];
  pRows.forEach((r, k) => {
    const y = P + 58 + k * 44;
    nodes[`pipe.r${k}.n`] = rect(`pipe.r${k}.n`, D, { x: P + 4, y: y + 17, w: 8, h: 8, r: 2, style: solid(C.blue, 0.35) });
    label(`pipe.r${k}`, P + 22, y, c1.w - 2 * P - 22, r);
    pipeKids.push(`pipe.r${k}.n`, `pipe.r${k}`);
  });
  const outY = P + 58 + pRows.length * 44 + 6;
  label("pipe.outL", P, outY, 200, "Writes", { color: C.muted, size: 18 });
  pipeKids.push("pipe.outL");
  ["parcels.json · 57,926", "sites.json · 5,645"].forEach((t, k) => {
    const y = outY + 34 + k * 50;
    nodes[`pipe.o${k}.bg`] = rect(`pipe.o${k}.bg`, D, { x: c1.w / 2, y: y + 20, w: c1.w - 2 * P, h: 40, r: 10, style: solid(C.blueTint) });
    label(`pipe.o${k}`, P + 14, y + 4, c1.w - 2 * P - 28, t, { font: "mono", size: 18, color: C.blue });
    pipeKids.push(`pipe.o${k}.bg`, `pipe.o${k}`);
  });
  nodes.pipeIn = group("pipeIn", D, pipeKids, { x: c1.x, y: BODY });
  nodes.pipe = group("pipe", D, ["pipeIn"], cardIn("pipe", colT(1) + 0.1, c1.x + c1.w / 2, BODY + pH / 2));
  roots.push("pipe");

  // 3. Rules engine --------------------------------------------------------
  const c2 = cols[2];
  const lenses = ["SB 4", "SB 9", "SB 684 / 1123", "AB 2011", "Surplus Land Act"];
  const RH = 48;
  const rH = P + 28 + 16 + lenses.length * RH + P - 8;
  card("rules.card", 0, 0, c2.w, rH);
  label("rules.title", P, P - 2, c2.w - 2 * P, "5 lenses · page-cited", { weight: 600 });
  hair("rules.h1", P, P + 40, c2.w - 2 * P);
  const rulesKids = ["rules.card", "rules.title", "rules.h1"];
  type St = "pass" | "fail" | "unknown";
  const states: St[][] = [
    ["pass", "unknown", "pass", "fail"],
    ["fail", "pass", "unknown", "pass"],
    ["unknown", "fail", "pass", "pass"],
    ["pass", "pass", "fail", "unknown"],
    ["fail", "unknown", "unknown", "pass"],
  ];
  const CYCLE = 1.8;
  const PULSE0 = 2.2;
  const TRAVEL = 0.5;
  // When a pulse reaches the rules card: chips fan (stagger up to 0.4) + travel, then the bus hop.
  const arriveRules = (c: number) => PULSE0 + c * CYCLE + 0.4 + TRAVEL + 0.15 + TRAVEL;
  const MARK = 26;
  lenses.forEach((name, k) => {
    const y = P + 58 + k * RH;
    const mx = P + MARK / 2;
    const my = y + 17;
    label(`rules.l${k}`, P + MARK + 14, y, c2.w - 2 * P - MARK - 14, name);
    rulesKids.push(`rules.l${k}`);
    // Each state's mark is its own group; visibility follows the state sequence.
    const seq = states[k];
    const swaps = [1, 2, 3].map((c) => snap(sec(arriveRules(c - 1)) + k * sec(0.05)));
    (["pass", "fail", "unknown"] as St[]).forEach((st) => {
      const id = `rules.m${k}.${st}`;
      const kids: string[] = [];
      if (st === "pass") {
        nodes[`${id}.disc`] = ellipse(`${id}.disc`, D, { x: 0, y: 0, w: MARK, h: MARK, style: solid(C.blue) });
        nodes[`${id}.glyph`] = path(`${id}.glyph`, D, { contours: [polyline([[-5.5, 0.5], [-1.5, 4.5], [6, -4]])], style: line(C.stock, 2.4) });
      } else if (st === "fail") {
        nodes[`${id}.disc`] = ellipse(`${id}.disc`, D, { x: 0, y: 0, w: MARK, h: MARK, style: solid(C.coral) });
        nodes[`${id}.glyph`] = path(`${id}.glyph`, D, {
          contours: [polyline([[-4.5, -4.5], [4.5, 4.5]]), polyline([[4.5, -4.5], [-4.5, 4.5]])],
          style: line(C.ink, 2.2),
        });
      } else {
        nodes[`${id}.disc`] = ellipse(`${id}.disc`, D, { x: 0, y: 0, w: MARK - 2, h: MARK - 2, style: line(C.muted, 1.75, 1, [0.1, 4.1]) });
        nodes[`${id}.glyph`] = text(`${id}.glyph`, D, { x: -20, y: -11, w: 40, align: "center", runs: [run({ text: "?", font: "ui", size: 17, weight: 600, color: C.muted, lineHeight: 18 })] });
      }
      kids.push(`${id}.disc`, `${id}.glyph`);
      // opacity / scale keys
      const on0 = seq[0] === st;
      const op: [number, number, unknown][] = [[0, on0 ? 1 : 0, "hold"]];
      const sc: [number, ReturnType<typeof s>, unknown][] = [[0, s(1), "hold"]];
      swaps.forEach((t, c) => {
        const was = seq[c] === st;
        const now = seq[c + 1] === st;
        if (was && !now) {
          op.push([t - sec(0.1), 1, IN], [t, 0, "hold"]);
          sc.push([t - sec(0.1), s(1), IN], [t, s(0.9), "hold"]);
        } else if (!was && now) {
          op.push([t, 0, OUT], [t + sec(0.2), 1, "hold"]);
          sc.push([t, s(0.9), OUT], [t + sec(0.3), s(1), "hold"]);
        }
      });
      // The loop returns to the first state while everything is faded out.
      const back = sec(9.4);
      op.push([back, on0 ? 1 : 0, "hold"]);
      sc.push([back, s(1), "hold"]);
      // keyframes must be increasing; sort and drop duplicate ticks
      const clean = <T,>(keys: [number, T, unknown][]) => keys.sort((a, b) => a[0] - b[0]).filter((kf, i, arr) => i === 0 || kf[0] !== arr[i - 1][0]);
      nodes[id] = group(id, D, kids, {
        isolation: true,
        position: constant(v3(mx, my)),
        opacity: tr(`${id}.op`, clean(op) as never),
        scale: tr(`${id}.sc`, clean(sc) as never),
      });
      rulesKids.push(id);
    });
  });
  nodes.rulesIn = group("rulesIn", D, rulesKids, { x: c2.x, y: BODY });
  nodes.rules = group("rules", D, ["rulesIn"], cardIn("rules", colT(2) + 0.1, c2.x + c2.w / 2, BODY + rH / 2));
  roots.push("rules");
  label("cap2.t", 0, 0, c2.w, "Unknown never cuts", { color: C.muted });
  nodes.cap2 = group("cap2", D, ["cap2.t"], fadeIn("cap2", colT(2) + 0.5, 6, c2.x, BODY + rH + 18));
  roots.push("cap2");

  // 4. App -----------------------------------------------------------------
  const c3 = cols[3];
  const mapH = 168;
  const aRows = ["Sieve", "Shortlist", "Site page · every check sourced"];
  const AR = 46;
  const claudeH = 3 * 26 + 30;
  const aH = P + mapH + 14 + aRows.length * AR + 16 + claudeH + P;
  card("app.card", 0, 0, c3.w, aH);
  const appKids = ["app.card"];
  // mini map: a tint ground with tiny lots, a few coral
  const mw = c3.w - 2 * P;
  nodes["app.map"] = rect("app.map", D, { x: P + mw / 2, y: P + mapH / 2, w: mw, h: mapH, r: 10, style: solid(C.stock2) });
  appKids.push("app.map");
  {
    const lot = 8;
    const gap = 3;
    const contoursBlue: PathContour[] = [];
    const coral: Pt[] = [];
    let idx = 0;
    const blocksX = Math.floor((mw - 40 + 11) / 41);
    const mx0 = Math.round((mw - (blocksX * 41 - 11)) / 2);
    for (let by = 0; by < 5; by++)
      for (let bx = 0; bx < blocksX; bx++) {
        const x0 = P + mx0 + bx * 41;
        const y0 = P + 17 + by * 29;
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 3; i++) {
            idx++;
            const x = x0 + i * (lot + gap);
            const y = y0 + j * (lot + gap);
            if (x + lot > P + mw - 14 || y + lot > P + mapH - 12) continue;
            if ((idx * 37) % 23 === 0) coral.push([x, y]);
            else contoursBlue.push(rectContour(x, y, lot, lot));
          }
      }
    nodes["app.lots"] = path("app.lots", D, { contours: contoursBlue, style: solid(C.blue, 0.22) });
    appKids.push("app.lots");
    coral.forEach(([x, y], k) => {
      const id = `app.c${k}`;
      const t = snap(sec(colT(3) + 0.7) + k * sec(0.05));
      nodes[id] = rect(id, D, { x: x + lot / 2, y: y + lot / 2, w: lot, h: lot, r: 1.5, scale: tr(`${id}.sc`, [[t, s(0.9), OUT], [t + sec(0.3), s(1.15)]]), style: solid(C.coral, tr(`${id}.op`, [[t, 0, OUT], [t + sec(0.2), 1]])) });
      appKids.push(id);
    });
  }
  aRows.forEach((r, k) => {
    const y = P + mapH + 14 + k * AR;
    if (k > 0) hair(`app.h${k}`, P, y, mw);
    nodes[`app.r${k}.n`] = rect(`app.r${k}.n`, D, { x: P + 6, y: y + AR / 2 + 4, w: 10, h: 10, r: 2.5, style: solid(C.blue) });
    label(`app.r${k}`, P + 26, y + AR / 2 - 13, mw - 26, r, {});
    appKids.push(...(k > 0 ? [`app.h${k}`] : []), `app.r${k}.n`, `app.r${k}`);
  });
  const cy0 = P + mapH + 14 + aRows.length * AR + 16;
  nodes["app.claude.bg"] = rect("app.claude.bg", D, { x: P + mw / 2, y: cy0 + claudeH / 2, w: mw, h: claudeH, r: 10, style: solid(C.coralTint) });
  nodes["app.claude"] = text("app.claude", D, {
    x: P + 16,
    y: cy0 + 12,
    w: mw - 32,
    runs: [
      run({ text: "Claude", font: "ui", size: 19, weight: 600, color: C.ink, lineHeight: 26 }),
      ...CLAUDE_LINES.map((t) => run({ text: t, ...CLAUDE_TEXT, color: C.ink, lineHeight: 26 })),
    ],
  });
  appKids.push("app.claude.bg", "app.claude");
  nodes.appIn = group("appIn", D, appKids, { x: c3.x, y: BODY });
  nodes.app = group("app", D, ["appIn"], cardIn("app", colT(3) + 0.1, c3.x + c3.w / 2, BODY + aH / 2));
  roots.push("app");

  // Connectors -------------------------------------------------------------
  const conStart = 1.6;
  const draw = (id: string, t0: number, dur: number) => [{ id: `${id}.trim`, type: "trim", start: constant(0), end: tr(`${id}.trim`, [[snap(sec(t0)), 0, OUT], [snap(sec(t0 + dur)), 1]]), offset: constant(0) }];
  const fanEnd: Pt = [c1.x, BUS];
  const fan: [Pt, Pt, Pt, Pt][] = sources.map((_, k) => {
    const p0: Pt = [c0.x + c0.w, chipY(k) + CH / 2];
    return [p0, [p0[0] + 40, p0[1]], [fanEnd[0] - 30, fanEnd[1]], fanEnd];
  });
  const conIds: string[] = [];
  fan.forEach((b, k) => {
    const id = `con.f${k}`;
    nodes[id] = path(id, D, { contours: [cubic(...b)], style: line(C.ink, 1.5, 0.16), operators: draw(id, conStart + k * 0.03, 0.45) });
    conIds.push(id);
  });
  const hop1: [Pt, Pt, Pt, Pt] = [[c1.x + c1.w, BUS], [c1.x + c1.w + 20, BUS], [c2.x - 20, BUS], [c2.x, BUS]];
  const hop2: [Pt, Pt, Pt, Pt] = [[c2.x + c2.w, BUS], [c2.x + c2.w + 20, BUS], [c3.x - 20, BUS], [c3.x, BUS]];
  nodes["con.h1"] = path("con.h1", D, { contours: [cubic(...hop1)], style: line(C.ink, 1.5, 0.16), operators: draw("con.h1", conStart + 0.25, 0.35) });
  nodes["con.h2"] = path("con.h2", D, { contours: [cubic(...hop2)], style: line(C.ink, 1.5, 0.16), operators: draw("con.h2", conStart + 0.4, 0.35) });
  conIds.push("con.h1", "con.h2");
  const portIds: string[] = [];
  // little ports where connectors meet the cards
  [[c1.x, BUS], [c1.x + c1.w, BUS], [c2.x, BUS], [c2.x + c2.w, BUS], [c3.x, BUS]].forEach(([x, y], k) => {
    const id = `port${k}`;
    const t0 = snap(sec(conStart + 0.2 + k * 0.06));
    const appear = () => tr(`${id}.op`, [[t0, 0, OUT], [t0 + sec(0.3), 1]]);
    nodes[id] = ellipse(id, D, { x, y, w: 9, h: 9, style: both(solid(C.stock, appear()), line(C.blue, 1.5, appear())) });
    portIds.push(id);
  });
  nodes.connectors = group("connectors", D, conIds);
  nodes.ports = group("ports", D, portIds);

  // Pulses -----------------------------------------------------------------
  const pulseIds: string[] = [];
  const pulse = (id: string, b: [Pt, Pt, Pt, Pt], t0: number, dur: number) => {
    const start = snap(sec(t0));
    const end = snap(start + sec(dur));
    const pos: [number, ReturnType<typeof v3>, unknown][] = [];
    for (let t = start; t <= end; t += FRAME * 2) {
      const u = (t - start) / (end - start);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const [x, y] = bez(...b, e);
      pos.push([t, v3(x, y), "linear"]);
    }
    const op = tr(`${id}.op`, [[0, 0, "hold"], [start, 0, OUT], [start + sec(0.1), 1, "hold"], [end - sec(0.12), 1, IN], [end, 0]]);
    nodes[id] = ellipse(id, D, { position: tr(`${id}.pos`, pos as never), w: 10, h: 10, style: solid(C.blue, op) });
    pulseIds.push(id);
  };
  for (let c = 0; c < 3; c++) {
    const base = PULSE0 + c * CYCLE;
    const order = [3, 0, 6, 1, 5, 2, 7, 4];
    order.forEach((k, j) => pulse(`pulse.c${c}.f${k}`, fan[k], base + j * 0.05, TRAVEL));
    pulse(`pulse.c${c}.h1`, hop1, base + 0.4 + TRAVEL + 0.15, TRAVEL);
    pulse(`pulse.c${c}.h2`, hop2, arriveRules(c) + 0.15, TRAVEL);
  }
  nodes.pulses = group("pulses", D, pulseIds);

  nodes.scene = group("scene", D, ["connectors", ...roots, "ports", "pulses"], {
    isolation: true,
    opacity: tr("scene.op", [[0, 1, "hold"], [sec(8.8), 1, IN], [sec(9.3), 0]]),
  });

  return buildDoc({
    id: "architecture",
    name: "Groundwork architecture",
    width: W,
    height: H,
    duration: D,
    nodes,
    roots: ["scene"],
    markers: [
      marker("columns", sec(1.5), { name: "Columns in" }),
      marker("wired", sec(2.2), { name: "Connectors" }),
      marker("pulse1", sec(arriveRules(0) - 0.4), { name: "Pulse 1" }),
      marker("tick1", sec(arriveRules(0) + 0.5), { name: "Marks tick" }),
      marker("pulse3", sec(arriveRules(2) + 0.3), { name: "Pulse 3" }),
      marker("hold", sec(8.5), { name: "Hold" }),
      marker("reset", sec(9.1), { name: "Reset" }),
    ],
  });
}

function rectContour(x: number, y: number, w: number, h: number): PathContour {
  return polyline([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
}
