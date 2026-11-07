/**
 * sieve — 1600×900, 10 s loop. The core mechanic: a city of parcels filtered
 * test by test, with the receipt writing itself beside it.
 *
 * Art direction
 *   Verb: sieve (fall away in a wave). Geometry: small rounded lot squares on
 *   an irregular block grid; one hairline card. Palette: stock, ink, blue lots
 *   and counter, coral survivors, coral-ink cut counts, muted detail.
 *   Words: the real receipt, nothing else.
 *
 * Beats (s)
 *   0.00–0.50  still: the city in blue, counter 57,926
 *   0.50 / 2.30 / 3.20 / 4.30  receipt rows write in (clip wipe + fade)
 *   0.80–1.95  step 1: 859 lots fade to a hairline tint, centre outward; 57,926 → 205
 *   step 2: −0, nothing moves (the honest beat)
 *   3.50–4.05  step 3: 5 lots fade; 205 → 178
 *   4.60–5.25  step 4: 16 lots fade; 178 → 100
 *   5.70–6.60  end: counter → 90 "lots worth a call"; 18 survivors stamp coral
 *   6.50–7.20  "Not cut, shown as a question" + three dashed rows
 *   7.20–8.60  hold
 *   8.60–9.40  reset: receipt fades, lots refill outward, counter back to 57,926
 *   9.40–10.0  still (= tick 0)
 */
import { C, FRAME, HAIR_A, IN, OUT, POP, both, buildDoc, constant, ellipse, group, line, marker, rect, rng, run, s, sec, solid, text, tr, v3, widthOf, type Nodes } from "./kit";
import { ROW_TEXT, SIEVE_LABELS } from "./strings";

export const W = 1600;
export const H = 900;
const D = sec(10);
const snap = (t: number) => Math.round(t / FRAME) * FRAME;

/** Lots of an irregular city: blocks of varying size, a ragged edge, one diagonal avenue. */
function city() {
  const LOT = 13;
  const GAP = 4;
  const STREET = 15;
  const X0 = 64;
  const X1 = 832;
  const Y0 = 72;
  const Y1 = 828;
  const rand = rng(11);
  const cols: number[] = [];
  const rows: number[] = [];
  const cp = [4, 5, 3, 6, 4, 5, 3, 5];
  const rp = [3, 2, 4, 3, 2, 3, 4, 2];
  for (let i = 0, x = 0; ; i++) {
    const c = cp[i % cp.length];
    const w = c * (LOT + GAP) - GAP;
    if (x + w > X1 - X0) break;
    cols.push(c);
    x += w + STREET;
  }
  for (let i = 0, y = 0; ; i++) {
    const r = rp[i % rp.length];
    const h = r * (LOT + GAP) - GAP;
    if (y + h > Y1 - Y0) break;
    rows.push(r);
    y += h + STREET;
  }
  const tw = cols.reduce((a, c) => a + c * (LOT + GAP) - GAP, 0) + STREET * (cols.length - 1);
  const th = rows.reduce((a, r) => a + r * (LOT + GAP) - GAP, 0) + STREET * (rows.length - 1);
  const ox = Math.round(X0 + (X1 - X0 - tw) / 2);
  const oy = Math.round((H - th) / 2);
  // A ragged city limit: a lumpy loop around the centre.
  const cx = ox + tw / 2;
  const cy = oy + th / 2;
  const R = (a: number) => 1 + 0.07 * Math.sin(3 * a + 0.6) + 0.05 * Math.sin(5 * a + 2.1) + 0.04 * Math.cos(7 * a);
  const inside = (x: number, y: number) => {
    const dx = (x - cx) / (tw / 2);
    const dy = (y - cy) / (th / 2);
    const a = Math.atan2(dy, dx);
    // superellipse-ish: squarer than a circle, so the grid fills most of the area
    const d = Math.pow(Math.pow(Math.abs(dx), 3.2) + Math.pow(Math.abs(dy), 3.2), 1 / 3.2);
    return d < 0.935 * R(a);
  };
  // A diagonal avenue (like a freeway) and a river-ish gap.
  const avenue = (x: number, y: number) => {
    const ax = ox + tw * 0.08;
    const ay = oy + th * 0.95;
    const bx = ox + tw * 0.95;
    const by = oy + th * 0.12;
    const t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2);
    const px = ax + t * (bx - ax);
    const py = ay + t * (by - ay);
    return Math.hypot(x - px, y - py) < 12;
  };
  const lots: { x: number; y: number }[] = [];
  let by = oy;
  rows.forEach((r, br) => {
    let bx = ox;
    cols.forEach((c, bc) => {
      const park = (bc === 2 && br === 4) || (bc === 7 && br === 1);
      if (!park)
        for (let j = 0; j < r; j++)
          for (let i = 0; i < c; i++) {
            const x = bx + i * (LOT + GAP) + LOT / 2;
            const y = by + j * (LOT + GAP) + LOT / 2;
            if (!inside(x, y) || avenue(x, y) || rand() < 0.04) continue;
            lots.push({ x, y });
          }
      bx += c * (LOT + GAP) - GAP + STREET;
    });
    by += r * (LOT + GAP) - GAP + STREET;
  });
  return { lots, LOT, cx, cy, maxD: Math.hypot(tw / 2, th / 2) };
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function sieve() {
  const nodes: Nodes = {};
  const { lots, LOT, cx, cy, maxD } = city();

  // ---------------------------------------------------------------- who survives which step
  const pick = rng(5);
  const order = lots.map((_, i) => i);
  // Survivors of step 1: spread out (a minimum spacing), deterministic.
  const s1: number[] = [];
  for (const i of order.sort(() => pick() - 0.5)) {
    if (s1.length >= 41) break;
    const p = lots[i];
    if (s1.every((j) => Math.hypot(lots[j].x - p.x, lots[j].y - p.y) > 62)) s1.push(i);
  }
  if (s1.length < 41) throw new Error(`only ${s1.length} survivors fit`);
  // The 18 that end coral: farthest-point picks, so they cover the whole city.
  const final: number[] = [s1[0]];
  while (final.length < 18) {
    let best = -1;
    let bestD = -1;
    for (const i of s1) {
      if (final.includes(i)) continue;
      const d = Math.min(...final.map((j) => Math.hypot(lots[j].x - lots[i].x, lots[j].y - lots[i].y)));
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    final.push(best);
  }
  const rest = s1.filter((i) => !final.includes(i));
  const cut3 = rest.slice(0, 5); // FEMA flood
  const cut4 = rest.slice(5, 21); // under 10,000 sq ft
  const cutEnd = rest.slice(21, 23); // 100 → 90
  const stepOf = new Map<number, number>();
  lots.forEach((_, i) => stepOf.set(i, 1));
  s1.forEach((i) => stepOf.set(i, 0));
  cut3.forEach((i) => stepOf.set(i, 3));
  cut4.forEach((i) => stepOf.set(i, 4));
  cutEnd.forEach((i) => stepOf.set(i, 5));

  const wave = (p: { x: number; y: number }, t0: number, spread: number) => snap(sec(t0) + (Math.hypot(p.x - cx, p.y - cy) / maxD) * sec(spread));
  const STEP_T: Record<number, [number, number]> = { 1: [0.8, 0.75], 3: [3.5, 0.4], 4: [4.6, 0.45], 5: [5.7, 0.1] };
  const FADE = sec(0.36);
  const lotIds: string[] = [];
  const finalOrder = [...final].sort((a, b) => lots[a].y * 0.6 + lots[a].x - (lots[b].y * 0.6 + lots[b].x));
  const coralIds: string[] = [];
  lots.forEach((p, i) => {
    const id = `lot${i}`;
    const st = stepOf.get(i)!;
    // refill on reset: the same wave, outward
    const tBack = wave(p, 8.7, 0.45);
    const keys: ([number, number, unknown] | [number, number])[] = [[0, 1, "hold"]];
    const fk = finalOrder.indexOf(i);
    if (fk >= 0) {
      // under its coral stamp the blue drops to the hairline tint, so the reset never mixes the two hues
      const t = snap(sec(5.82) + fk * sec(0.04)) + sec(0.14);
      keys.push([t, 1, "hold"], [t + FRAME, HAIR_A, "hold"], [tBack, HAIR_A, OUT], [tBack + sec(0.4), 1]);
    } else if (st > 0) {
      const t = wave(p, STEP_T[st][0], STEP_T[st][1]);
      keys.push([t, 1, OUT], [t + FADE, HAIR_A, "hold"], [tBack, HAIR_A, OUT], [tBack + sec(0.4), 1]);
    }
    nodes[id] = rect(id, D, { x: p.x, y: p.y, w: LOT, h: LOT, r: 2, style: solid(C.blue, tr(`${id}.op`, keys as never)) });
    lotIds.push(id);
  });
  finalOrder.forEach((i, k) => {
    const p = lots[i];
    const id = `found${k}`;
    const t = snap(sec(5.82) + k * sec(0.04));
    nodes[id] = rect(id, D, {
      x: p.x,
      y: p.y,
      w: LOT,
      h: LOT,
      r: 2,
      scale: tr(`${id}.sc`, [[t, s(0.9), OUT], [t + sec(0.16), s(1.14), OUT], [t + sec(0.4), s(1)]]),
      style: solid(C.coral, tr(`${id}.op`, [[0, 0, "hold"], [t, 0, OUT], [t + sec(0.14), 1, "hold"], [sec(8.6), 1, IN], [sec(8.86), 0]])),
    });
    coralIds.push(id);
  });
  nodes.map = group("map", D, [...lotIds, ...coralIds]);

  // ---------------------------------------------------------------- the receipt card
  const CX0 = 880;
  const CX1 = 1536;
  const CY0 = 72;
  const CY1 = 828;
  const PAD = 44;
  const ix = CX0 + PAD;
  const iw = CX1 - CX0 - PAD * 2;
  nodes.card = rect("card", D, {
    x: (CX0 + CX1) / 2,
    y: (CY0 + CY1) / 2,
    w: CX1 - CX0,
    h: CY1 - CY0,
    r: 14,
    style: both(solid(C.stock), line(C.ink, 1.5, HAIR_A)),
  });

  // Counter: hold-keyed runs; ticks down along an ease-out.
  const counterKeys: [number, unknown, "hold"][] = [];
  const num = (v: number) => [run({ text: fmt(v), font: "display", size: 116, weight: 800, color: C.blue, lineHeight: 116 })];
  counterKeys.push([0, num(57926), "hold"]);
  const tick = (from: number, to: number, t0: number, dur: number, steps: number) => {
    for (let k = 1; k <= steps; k++) {
      const u = k / steps;
      const e = 1 - Math.pow(1 - u, 3);
      const v = k === steps ? to : Math.round(from + (to - from) * e);
      counterKeys.push([snap(sec(t0) + u * sec(dur)), num(v), "hold"]);
    }
  };
  tick(57926, 205, 0.8, 0.85, 16);
  tick(205, 178, 3.5, 0.4, 6);
  tick(178, 100, 4.6, 0.5, 9);
  counterKeys.push([sec(5.82), num(90), "hold"]);
  counterKeys.push([sec(9.0), num(57926), "hold"]);
  const counterTop = CY0 + 52;
  nodes.counter = text("counter", D, {
    x: ix - 4,
    y: counterTop,
    w: iw,
    runs: tr("counter.runs", counterKeys as never),
    // a quick drain-and-return at the two swaps that are not a count
    opacity: tr("counter.op", [
      [0, 1, "hold"],
      [sec(5.7), 1, IN],
      [sec(5.82), 0, OUT],
      [sec(6.12), 1, "hold"],
      [sec(8.6), 1, IN],
      [sec(8.9), 0, "hold"],
      [sec(9.0), 0, OUT],
      [sec(9.35), 1],
    ]),
  });
  const labelTop = counterTop + 124;
  const labelRun = (t: string, c = C.muted) => [run({ text: t, font: "ui", size: 24, weight: 500, color: c, lineHeight: 30 })];
  nodes.label = text("label", D, {
    x: ix,
    y: labelTop,
    w: iw,
    runs: tr("label.runs", [[0, labelRun("parcels in Santa Ana"), "hold"], [sec(5.82), labelRun("lots worth a call", C.ink), "hold"], [sec(9.0), labelRun("parcels in Santa Ana")]] as never),
    opacity: tr("label.op", [[0, 1, "hold"], [sec(5.7), 1, IN], [sec(5.82), 0, OUT], [sec(6.16), 1, "hold"], [sec(8.6), 1, IN], [sec(8.9), 0, "hold"], [sec(9.0), 0, OUT], [sec(9.35), 1]]),
  });
  const div1 = labelTop + 58;
  nodes.div1 = rect("div1", D, { x: ix + iw / 2, y: div1, w: iw, h: 1.5, r: 0, style: solid(C.ink, HAIR_A) });

  // Receipt rows.
  const rows = [
    { n: "−57,721", label: SIEVE_LABELS[0], detail: "· SB 4 p1", t: 0.5 },
    { n: "−0", label: SIEVE_LABELS[1], detail: "", t: 2.3 },
    { n: "−27", label: SIEVE_LABELS[2], detail: "", t: 3.2 },
    { n: "−78", label: SIEVE_LABELS[3], detail: "· our assumption", t: 4.3 },
  ];
  const ROW_H = 56;
  const NUM_W = 104;
  const rowIds: string[] = [];
  rows.forEach((r, k) => {
    const top = div1 + 22 + k * ROW_H;
    const id = `row${k}`;
    const kids: string[] = [];
    nodes[`${id}.n`] = text(`${id}.n`, D, { x: ix, y: top, w: NUM_W, align: "right", runs: [run({ text: r.n, font: "mono", size: 21, weight: 500, color: C.coralInk, lineHeight: 28 })] });
    kids.push(`${id}.n`);
    const lx = ix + NUM_W + 24;
    nodes[`${id}.l`] = text(`${id}.l`, D, { x: lx, y: top, w: iw - NUM_W - 24, runs: [run({ text: r.label, ...ROW_TEXT, color: C.ink, lineHeight: 28 })] });
    kids.push(`${id}.l`);
    if (r.detail) {
      const dx = lx + widthOf({ text: r.label, ...ROW_TEXT }) + 6;
      nodes[`${id}.d`] = text(`${id}.d`, D, { x: dx, y: top, w: CX1 - PAD - dx, runs: [run({ text: r.detail, ...ROW_TEXT, color: C.muted, lineHeight: 28 })] });
      kids.push(`${id}.d`);
    }
    // a hairline under each row except the last
    if (k < rows.length - 1) {
      nodes[`${id}.rule`] = rect(`${id}.rule`, D, { x: ix + iw / 2, y: top + ROW_H - 14, w: iw, h: 1, r: 0, style: solid(C.ink, 0.07) });
      kids.push(`${id}.rule`);
    }
    // Write in: a wipe from the left with a short fade.
    const t0 = sec(r.t);
    nodes[`${id}.clip`] = rect(`${id}.clip`, D, {
      x: ix - 8,
      y: top + 14,
      anchor: { x: -(iw + 16) / 2, y: 0 },
      w: iw + 16,
      h: 48,
      r: 0,
      scale: tr(`${id}.clip.sc`, [[t0, s(0.001, 1), OUT], [t0 + sec(0.55), s(1)]]),
      style: {},
    });
    nodes[`${id}.in`] = group(`${id}.in`, D, kids, { clipPathId: `${id}.clip` });
    nodes[id] = group(id, D, [`${id}.in`], {
      isolation: true,
      opacity: tr(`${id}.op`, [[t0, 0, OUT], [t0 + sec(0.3), 1, "hold"], [sec(8.6), 1, IN], [sec(8.95), 0]]),
    });
    rowIds.push(id);
  });

  // Not cut, shown as a question.
  const div2 = div1 + 22 + rows.length * ROW_H + 4;
  const qTop = div2 + 26;
  const qT = 6.5;
  nodes.div2 = rect("div2", D, { x: ix + iw / 2, y: div2, w: iw, h: 1.5, r: 0, style: solid(C.ink, HAIR_A) });
  nodes.qHead = text("qHead", D, {
    x: ix,
    y: qTop,
    w: iw,
    runs: [run({ text: "Not cut, shown as a question", font: "ui", size: 20, weight: 600, color: C.muted, lineHeight: 26 })],
    opacity: tr("qHead.op", [[sec(qT), 0, OUT], [sec(qT + 0.35), 1, "hold"], [sec(8.6), 1, IN], [sec(8.95), 0]]),
  });
  const qs = ["Owned by the institution since 2024", "Not in a fault zone", "Not within 1,200 ft of heavy industry"];
  const Q_H = 46;
  const qIds: string[] = ["qHead"];
  qs.forEach((q, k) => {
    const id = `q${k}`;
    const cyq = qTop + 44 + k * (Q_H + 8) + Q_H / 2;
    const t0 = sec(qT + 0.12) + k * sec(0.07);
    nodes[`${id}.box`] = rect(`${id}.box`, D, { x: ix + iw / 2, y: cyq, w: iw, h: Q_H, r: 12, style: line(C.muted, 1.5, 0.55, [5, 5]) });
    nodes[`${id}.ring`] = ellipse(`${id}.ring`, D, { x: ix + 26, y: cyq, w: 26, h: 26, style: line(C.muted, 1.75, 1, [0.1, 4.2]) });
    nodes[`${id}.qm`] = text(`${id}.qm`, D, { x: ix + 26 - 20, y: cyq - 13, w: 40, align: "center", runs: [run({ text: "?", font: "ui", size: 18, weight: 600, color: C.muted, lineHeight: 20 })] });
    nodes[`${id}.t`] = text(`${id}.t`, D, { x: ix + 54, y: cyq - 14, w: iw - 70, runs: [run({ text: q, font: "ui", size: 20, weight: 500, color: C.ink, lineHeight: 24 })] });
    nodes[id] = group(id, D, [`${id}.box`, `${id}.ring`, `${id}.qm`, `${id}.t`], {
      isolation: true,
      anchor: { x: ix, y: cyq },
      position: tr(`${id}.pos`, [[t0, v3(ix, cyq + 8), OUT], [t0 + sec(0.45), v3(ix, cyq)]]),
      opacity: tr(`${id}.op`, [[t0, 0, OUT], [t0 + sec(0.35), 1, "hold"], [sec(8.6), 1, IN], [sec(8.95), 0]]),
    });
    qIds.push(id);
  });

  return buildDoc({
    id: "sieve",
    name: "Groundwork sieve",
    width: W,
    height: H,
    duration: D,
    nodes,
    roots: ["map", "card", "counter", "label", "div1", ...rowIds, "div2", ...qIds],
    markers: [
      marker("start", sec(0.4), { name: "City" }),
      marker("step1", sec(2.0), { name: "Step 1 landed" }),
      marker("step2", sec(2.9), { name: "Step 2 (no change)" }),
      marker("step3", sec(4.1), { name: "Step 3" }),
      marker("step4", sec(5.3), { name: "Step 4" }),
      marker("found", sec(6.7), { name: "Survivors" }),
      marker("final", sec(7.6), { name: "Final receipt" }),
      marker("reset", sec(9.0), { name: "Reset" }),
    ],
  });
}

export const sieveCounts = () => city().lots.length;
void POP;
void constant;
