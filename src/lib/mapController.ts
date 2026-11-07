import type { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, PolygonLayer } from "@deck.gl/layers";
import type { Layer, PickingInfo } from "@deck.gl/core";
import type { CityData } from "./data";
import type { Site } from "./types";
import { useStore } from "./store";
import { getSieve, type SieveResult } from "./useSieve";
import { scoreSite } from "./score";

/** Riso inks: the city printed in blue, survivors over-printed in coral. */
const INK: [number, number, number] = [29, 59, 168];
const CLAY: [number, number, number] = [255, 90, 78];
const DARK: [number, number, number] = [20, 27, 60];

/** Dot radius in meters: a typical Santa Ana lot is ~15 m wide, so dots scale like lots. */
const R = 6;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Owns the per-frame painting of ~58k parcel dots. Lives outside React on purpose: it mutates
 * typed arrays every frame and only runs a requestAnimationFrame loop while something moves.
 */
export class MapController {
  private n: number;
  private positions: Float32Array;
  private delay: Float32Array;
  private colors = [new Uint8Array(0), new Uint8Array(0)];
  private radii = [new Float32Array(0), new Float32Array(0)];
  private flip = 0;
  private introStart = 0;
  private doneT = 0;
  private last = 0;
  private raf: number | null = null;
  private lastLens: string | null = null;
  private unsub: () => void;
  private reduce: boolean;

  constructor(
    private overlay: MapboxOverlay,
    private data: CityData,
  ) {
    const { count, columns } = data.parcels;
    this.n = count;
    this.positions = new Float32Array(count * 2);
    this.delay = new Float32Array(count);
    const [cx, cy] = data.city.center;
    let maxD = 0;
    for (let i = 0; i < count; i++) {
      this.positions[i * 2] = columns.lng[i];
      this.positions[i * 2 + 1] = columns.lat[i];
      const d = Math.hypot(columns.lng[i] - cx, columns.lat[i] - cy);
      this.delay[i] = d;
      if (d > maxD) maxD = d;
    }
    // Ripple outward from the center, with a little grain so the wave reads as organic.
    let seed = 7;
    for (let i = 0; i < count; i++) {
      seed = (seed * 16807) % 2147483647;
      this.delay[i] = 0.82 * (this.delay[i] / maxD) + 0.18 * (seed / 2147483647);
    }
    this.colors = [new Uint8Array(count * 4), new Uint8Array(count * 4)];
    this.radii = [new Float32Array(count), new Float32Array(count)];
    this.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.unsub = useStore.subscribe(() => this.kick());
    this.kick();
  }

  destroy() {
    this.unsub();
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  kick = () => {
    if (this.raf == null) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  private failed = false;

  private frame = (now: number) => {
    this.raf = null;
    if (this.failed) return;
    try {
      this.paint(now);
    } catch (e) {
      // Never let a bad frame spin: log once, stop animating, keep the last good frame on screen.
      this.failed = true;
      console.error("[Groundwork] map frame failed:", e);
    }
  };

  private paint(now: number) {
    const st = useStore.getState();
    if (!this.introStart) this.introStart = now;
    const intro = this.reduce ? 1.4 : Math.min(1.4, (now - this.introStart) / 1400);
    if (st.lensId !== this.lastLens) {
      this.lastLens = st.lensId;
      this.doneT = 0;
    }
    const want = st.sieveDone ? 1.3 : 0;
    const dt = this.last ? (now - this.last) / 1000 : 0;
    this.last = now;
    if (this.doneT < want) this.doneT = this.reduce ? want : Math.min(want, this.doneT + dt / 0.9);
    if (this.doneT > want) this.doneT = want;

    const sieve = getSieve(this.data, st.lensId);
    const layers = [this.dots(sieve, st.sieveProgress, intro), ...this.siteLayers(sieve)];
    this.overlay.setProps({
      layers,
      getCursor: ({ isHovering }) => (isHovering ? "pointer" : "grab"),
      onHover: (info: PickingInfo<Site>) => {
        const apn = info.object?.apn ?? null;
        if (useStore.getState().hoveredApn !== apn) useStore.getState().hover(apn);
      },
      onClick: (info: PickingInfo<Site>) => {
        if (info.object) useStore.getState().openSite(info.object.apn);
      },
    });
    const moving = intro < 1.4 || this.doneT !== want || st.mode === "sieve";
    if (moving) this.raf = requestAnimationFrame(this.frame);
  }

  private dots(sieve: SieveResult | null, progress: number, intro: number): Layer {
    this.flip ^= 1;
    const col = this.colors[this.flip];
    const rad = this.radii[this.flip];
    const failAt = sieve?.failAt;
    const steps = Math.max(1, sieve?.steps.length ?? 1);
    const doneT = this.doneT;
    for (let i = 0; i < this.n; i++) {
      const d = this.delay[i];
      const it = easeOut(clamp01((intro - d * 0.6) / 0.4));
      let alpha = 0.36 * it;
      let r = R;
      let cr = INK[0],
        cg = INK[1],
        cb = INK[2];
      if (failAt) {
        const k = failAt[i];
        if (k > 0) {
          // Removed at step k (1-based): fades out while progress runs k-1 → k, rippling outward.
          const t = easeOut(clamp01((progress - (k - 1) - d * 0.55) / 0.45));
          alpha = alpha * (1 - t) + 0.045 * t;
          r = R * (1 - 0.45 * t);
        } else {
          // Survivor: heavier as the pool narrows, then hands off to the clay site markers.
          const lift = clamp01(progress / steps);
          alpha = 0.36 + 0.58 * lift;
          r = R * (1 + 1.6 * lift);
          if (doneT > 0) {
            const t = easeOut(clamp01((doneT - d * 0.3) / 0.7));
            cr = INK[0] + (CLAY[0] - INK[0]) * t;
            cg = INK[1] + (CLAY[1] - INK[1]) * t;
            cb = INK[2] + (CLAY[2] - INK[2]) * t;
            alpha *= 1 - 0.5 * t;
          }
        }
      }
      const o = i * 4;
      col[o] = cr;
      col[o + 1] = cg;
      col[o + 2] = cb;
      col[o + 3] = Math.round(alpha * 255);
      rad[i] = r;
    }
    return new ScatterplotLayer({
      id: "parcels",
      data: {
        length: this.n,
        attributes: {
          getPosition: { value: this.positions, size: 2 },
          getFillColor: { value: col, size: 4, normalized: true },
          getRadius: { value: rad, size: 1 },
        },
      },
      radiusUnits: "meters",
      radiusMinPixels: 1.05,
      radiusMaxPixels: 7,
      stroked: false,
      pickable: false,
    });
  }

  private siteLayers(sieve: SieveResult | null): Layer[] {
    const st = useStore.getState();
    const layers: Layer[] = [];
    if (sieve && this.doneT > 0) {
      const t = easeOut(clamp01(this.doneT));
      const sites = sieve.survivorApns.map((a) => this.data.siteByApn.get(a)).filter((s): s is Site => !!s);
      // Fewer survivors get bigger stamps; thousands stay small enough to read the city through.
      const base = Math.max(2.6, Math.min(6.5, 9.2 - Math.log10(Math.max(10, sites.length)) * 1.9));
      layers.push(
        new ScatterplotLayer<Site>({
          id: "sites",
          data: sites,
          getPosition: (s) => [s.lng, s.lat],
          getRadius: (s) =>
            (s.apn === st.selectedApn ? 10 : s.apn === st.hoveredApn ? 9 : base + (scoreSite(s, st.lensId).score - 6) * 0.35) * t,
          getFillColor: (s) => (s.apn === st.selectedApn || s.apn === st.hoveredApn ? [...DARK, 255] : [...CLAY, 240]),
          getLineColor: [251, 251, 248, 255],
          lineWidthMinPixels: 1,
          stroked: true,
          radiusUnits: "pixels",
          pickable: true,
          updateTriggers: {
            getRadius: [st.selectedApn, st.hoveredApn, t, st.lensId],
            getFillColor: [st.selectedApn, st.hoveredApn],
          },
        }),
      );
    }
    const target = st.selectedApn ? this.data.siteByApn.get(st.selectedApn) : null;
    if (target?.outline?.length && target.outline.length > 2) {
      layers.push(
        new PolygonLayer<Site>({
          id: "outline",
          data: [target],
          getPolygon: (s) => s.outline,
          getFillColor: [...CLAY, 46],
          getLineColor: [...CLAY, 255],
          lineWidthMinPixels: 2,
          stroked: true,
          filled: true,
        }),
      );
    }
    return layers;
  }
}
