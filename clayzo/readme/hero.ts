/**
 * hero — 1600×560, 7.2 s loop.
 *
 * Art direction
 *   Verb: build, then sieve. Geometry: the Foundation mark and small rounded
 *   lot squares (r 2) on a city grid. Palette: stock, ink, blue (what exists),
 *   coral (the found thing), muted. Words: the wordmark and one tagline.
 *
 * Beats (s)
 *   0.00–0.10  still stock
 *   0.10–0.70  coral slab wipes in left→right
 *   0.42–1.02  blue house rises onto it
 *   0.86–1.42  coral doorway rises through it
 *   1.06–1.56  wordmark fades and settles; tagline 60 ms later
 *   1.30–2.30  parcel field fades in on a diagonal wave
 *   3.00–3.95  filter: most lots fade to a hairline tint, centre outward
 *   3.85–4.55  12 lots turn coral and lift (stamp, tiny overshoot)
 *   4.55–6.30  hold
 *   6.30–6.80  everything fades to stock; 6.80–7.20 still stock (= tick 0)
 */
import { C, FRAME, marker, IN, OUT, POP, buildDoc, constant, group, path, rect, rng, run, s, sec, solid, text, tr, v3, type Nodes } from "./kit";
import { STEM_D, SLAB_D, gridMap, houseContours, svgToContours } from "./logo";

export const W = 1600;
export const H = 560;
const D = sec(7.2);

export function hero() {
  const nodes: Nodes = {};
  const roots: string[] = [];
  const scene: string[] = [];

  // ---------------------------------------------------------------- the mark
  const K = 6; // 32 grid → 6 px per unit
  const LEFT = 128; // grid x 2 lands here
  const MARK_TOP = 112; // grid y 4.62 lands near here
  const ox = LEFT - 2 * K;
  const oy = MARK_TOP - 4.62 * K;
  const g = gridMap(K, ox, oy);
  const [, slabTop] = g(0, 24.25);
  const [, slabBottom] = g(0, 28.5);

  // House: rises onto the slab, scaled about its sill.
  const [sillX, sillY] = g(16, 23);
  nodes.house = path("house", D, {
    contours: houseContours(g),
    style: solid(C.blue, tr("house.op", [[sec(0.42), 0, OUT], [sec(0.82), 1]])),
    anchor: { x: sillX, y: sillY },
    position: tr("house.pos", [[sec(0.42), v3(sillX, sillY + 22), OUT], [sec(1.02), v3(sillX, sillY)]]),
    scale: tr("house.sc", [[sec(0.42), s(0.94), OUT], [sec(1.02), s(1)]]),
  });

  // Doorway stem: hidden under the slab, rises through the doorway. Clipped to above the slab's bottom.
  nodes.stemClip = rect("stemClip", D, { x: sillX, y: (g(0, 12)[1] + slabTop + 6) / 2, w: 10 * K, h: slabTop + 6 - g(0, 12)[1], r: 0, style: {} });
  nodes.stem = path("stem", D, {
    contours: svgToContours(STEM_D, g),
    style: solid(C.coral),
    position: tr("stem.pos", [[sec(0.86), v3(0, 8.6 * K), OUT], [sec(1.42), v3(0, 0)]]),
  });
  nodes.stemG = group("stemG", D, ["stem"], { clipPathId: "stemClip" });

  // Slab: wipes in from its left end.
  const [slabL] = g(2, 0);
  const [slabR] = g(30, 0);
  nodes.slabClip = rect("slabClip", D, {
    x: slabL - 4,
    y: (slabTop + slabBottom) / 2,
    anchor: { x: -(slabR - slabL + 8) / 2, y: 0 },
    w: slabR - slabL + 8,
    h: slabBottom - slabTop + 8,
    r: 0,
    scale: tr("slabClip.sc", [[sec(0.1), s(0.001, 1), OUT], [sec(0.7), s(1)]]),
    style: {},
  });
  nodes.slab = path("slab", D, { contours: svgToContours(SLAB_D, g), style: solid(C.coral) });
  nodes.slabG = group("slabG", D, ["slab"], { clipPathId: "slabClip" });
  scene.push("house", "stemG", "slabG");

  // ---------------------------------------------------------------- words
  const WM = 100; // wordmark size; Bricolage 800 caps ≈ 0.70 × size
  const wmTop = slabBottom + 26;
  const settle = (id: string, t0: number, dy: number) => ({
    opacity: tr(`${id}.op`, [[sec(t0), 0, OUT], [sec(t0 + 0.4), 1]]),
    position: tr(`${id}.pos`, [[sec(t0), v3(LEFT - 4, 0 + dy), OUT], [sec(t0 + 0.5), v3(LEFT - 4, 0)]]),
  });
  const wm = text("wordmark", D, {
    ...settle("wordmark", 1.06, 10),
    y: 0,
    w: 900,
    runs: [run({ text: "Groundwork", font: "display", size: WM, weight: 800, color: C.ink, lineHeight: 110 })],
  }) as unknown as Record<string, unknown>;
  // Translate the whole text node by its box top via a parent group (position is animated above).
  wm.animators = [{ id: "wordmark.trk", selector: { start: 0, end: 10, units: "characters" }, tracking: constant(-0.035 * WM) }];
  nodes.wordmark = wm as never;
  nodes.wordmarkG = group("wordmarkG", D, ["wordmark"], { x: 0, y: wmTop });
  nodes.tagline = text("tagline", D, {
    ...settle("tagline", 1.18, 8),
    w: 900,
    runs: [run({ text: "Find the land California’s new housing laws opened.", font: "ui", size: 28, weight: 500, color: C.muted, lineHeight: 34 })],
  });
  nodes.taglineG = group("taglineG", D, ["tagline"], { x: 2, y: wmTop + 124 });
  scene.push("wordmarkG", "taglineG");

  // ---------------------------------------------------------------- the field
  const LOT = 13;
  const GAP = 5;
  const STREET = 19;
  const FX0 = 812;
  const FX1 = 1488;
  const FY0 = 84;
  const FY1 = 476;
  const rand = rng(7);
  // Block columns and rows of varying size, like a real street grid.
  const colSizes: number[] = [];
  {
    let x = 0;
    const pattern = [5, 4, 6, 5, 4, 5, 6, 4];
    for (let i = 0; ; i++) {
      const c = pattern[i % pattern.length];
      const w = c * LOT + (c - 1) * GAP;
      if (x + w > FX1 - FX0) break;
      colSizes.push(c);
      x += w + STREET;
    }
  }
  const rowSizes: number[] = [];
  {
    let y = 0;
    const pattern = [3, 2, 3, 3, 2, 3];
    for (let i = 0; ; i++) {
      const r = pattern[i % pattern.length];
      const h = r * LOT + (r - 1) * GAP;
      if (y + h > FY1 - FY0) break;
      rowSizes.push(r);
      y += h + STREET;
    }
  }
  const totalW = colSizes.reduce((a, c) => a + c * LOT + (c - 1) * GAP, 0) + STREET * (colSizes.length - 1);
  const totalH = rowSizes.reduce((a, r) => a + r * LOT + (r - 1) * GAP, 0) + STREET * (rowSizes.length - 1);
  const x0 = Math.round(FX1 - totalW);
  const y0 = Math.round((H - totalH) / 2);
  const lots: { x: number; y: number }[] = [];
  const park = { bc: 3, br: 2 };
  let by = y0;
  rowSizes.forEach((r, br) => {
    let bx = x0;
    colSizes.forEach((c, bc) => {
      if (!(bc === park.bc && br === park.br)) {
        for (let j = 0; j < r; j++)
          for (let i = 0; i < c; i++) {
            if (rand() < 0.07) continue; // a few empty lots
            lots.push({ x: bx + i * (LOT + GAP) + LOT / 2, y: by + j * (LOT + GAP) + LOT / 2 });
          }
      }
      bx += c * LOT + (c - 1) * GAP + STREET;
    });
    by += r * LOT + (r - 1) * GAP + STREET;
  });

  // The found ones: 12 lots spread across the field, picked deterministically.
  const found = new Set<number>();
  const pick = rng(31);
  while (found.size < 12) {
    const i = Math.floor(pick() * lots.length);
    const p = lots[i];
    // keep them apart so each reads on its own
    if ([...found].every((j) => Math.hypot(lots[j].x - p.x, lots[j].y - p.y) > 70)) found.add(i);
  }

  const cx = (x0 + x0 + totalW) / 2;
  const cy = (y0 + y0 + totalH) / 2;
  const maxD = Math.hypot(totalW / 2, totalH / 2);
  const snap = (t: number) => Math.round(t / FRAME) * FRAME;
  const foundOrder = [...found].sort((a, b) => ((lots[a].x * 7 + lots[a].y * 13) % 97) - ((lots[b].x * 7 + lots[b].y * 13) % 97));

  const fieldIds: string[] = [];
  lots.forEach((p, i) => {
    const id = `lot${i}`;
    // Appear: diagonal wave from top-left.
    const tIn = snap(sec(1.3) + ((p.x - x0 + (p.y - y0) * 1.2) / (totalW + totalH * 1.2)) * sec(0.62));
    const isFound = found.has(i);
    const k = foundOrder.indexOf(i);
    // Filter: centre outward; found lots dim as their coral copy lifts off them.
    const tOut = isFound ? snap(sec(3.85) + k * sec(0.05)) : snap(sec(3.0) + (Math.hypot(p.x - cx, p.y - cy) / maxD) * sec(0.6));
    nodes[id] = rect(id, D, {
      x: p.x,
      y: p.y,
      w: LOT,
      h: LOT,
      r: 2,
      style: solid(C.blue, tr(`${id}.op`, [[tIn, 0, OUT], [tIn + sec(0.4), 1, "hold"], [tOut, 1, OUT], [tOut + sec(0.36), 0.12]])),
    });
    fieldIds.push(id);
    if (isFound) {
      const fid = `found${k}`;
      const t = snap(sec(3.85) + k * sec(0.05));
      nodes[fid] = rect(fid, D, {
        w: LOT,
        h: LOT,
        r: 2,
        position: tr(`${fid}.pos`, [[t, v3(p.x, p.y), OUT], [t + sec(0.45), v3(p.x, p.y - 5)]]),
        scale: tr(`${fid}.sc`, [[t, s(0.9), POP], [t + sec(0.4), s(1.12)]]),
        style: solid(C.coral, tr(`${fid}.op`, [[t, 0, OUT], [t + sec(0.2), 1]])),
      });
      fieldIds.push(fid);
    }
  });
  // Coral copies draw above every blue lot.
  const ordered = [...fieldIds.filter((i) => i.startsWith("lot")), ...fieldIds.filter((i) => i.startsWith("found"))];
  scene.push(...ordered);

  // ---------------------------------------------------------------- reset
  nodes.scene = group("scene", D, scene, {
    isolation: true,
    opacity: tr("scene.op", [[0, 1, "hold"], [sec(6.3), 1, IN], [sec(6.8), 0]]),
  });
  roots.push("scene");

  return buildDoc({
    id: "hero",
    name: "Groundwork hero",
    width: W,
    height: H,
    duration: D,
    nodes,
    roots,
    markers: [
      marker("mark", sec(1.0), { name: "Mark built" }),
      marker("words", sec(1.6), { name: "Lockup" }),
      marker("field", sec(2.4), { name: "Field in" }),
      marker("filter", sec(3.4), { name: "Filtering" }),
      marker("found", sec(4.6), { name: "Found" }),
      marker("reset", sec(6.55), { name: "Reset" }),
    ],
  });
}

