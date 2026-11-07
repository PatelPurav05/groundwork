"use client";

import { useEffect, useRef, useState } from "react";
import MapGL, { useControl, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { useStore } from "@/lib/store";
import { MapController } from "@/lib/mapController";
import { rowForApn } from "@/lib/rules/engine";

// Turbopack can't bundle MapLibre's module worker; serve the prebuilt one from /public (see postinstall).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const BASEMAP = "https://tiles.openfreemap.org/styles/positron";
const PANEL_PAD = { left: 460, top: 24, right: 24, bottom: 24 };

function Overlay({ onReady }: { onReady: (o: MapboxOverlay) => void }) {
  const overlay = useControl(() => new MapboxOverlay({ interleaved: false }));
  useEffect(() => onReady(overlay), [overlay, onReady]);
  return null;
}

function padding() {
  if (typeof window !== "undefined" && window.innerWidth < 768)
    return { left: 16, top: 16, right: 16, bottom: Math.round(window.innerHeight * 0.64) };
  return PANEL_PAD;
}

function initialPad() {
  const p = padding();
  return p === PANEL_PAD ? { ...PANEL_PAD, left: 480 } : p;
}

export function CityMap() {
  const data = useStore((s) => s.data)!;
  const mode = useStore((s) => s.mode);
  const selectedApn = useStore((s) => s.selectedApn);
  const mapRef = useRef<MapRef>(null);
  const [overlay, setOverlay] = useState<MapboxOverlay | null>(null);

  useEffect(() => {
    if (!overlay) return;
    const c = new MapController(overlay, data);
    return () => c.destroy();
  }, [overlay, data]);

  // Camera: fly to a site, or frame the whole city.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pad = padding();
    const s = selectedApn ? data.siteByApn.get(selectedApn) : null;
    if (selectedApn) {
      const at = s ? [s.lng, s.lat] : (() => {
        const r = rowForApn(data, selectedApn);
        const i = r ? data.parcels.columns.apn.indexOf(r.apn) : -1;
        return i >= 0 ? [data.parcels.columns.lng[i], data.parcels.columns.lat[i]] : null;
      })();
      if (at) map.flyTo({ center: at as [number, number], zoom: 17.2, duration: reduce ? 0 : 1400, padding: pad, essential: true });
    } else if (mode === "home" || mode === "sieve") {
      const [w, so, e, n] = data.city.bbox;
      map.fitBounds([w, so, e, n], { padding: { ...pad, left: pad.left + 20, top: pad.top + 30, right: pad.right + 30 }, duration: reduce ? 0 : 1100 });
    }
  }, [selectedApn, mode, data]);

  const [w, s, e, n] = data.city.bbox;
  return (
    <div className="absolute inset-0 basemap-muted">
      <MapGL
        ref={mapRef}
        initialViewState={{ bounds: [w, s, e, n], fitBoundsOptions: { padding: initialPad() } }}
        mapStyle={BASEMAP}
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        maxBounds={[w - 0.15, s - 0.12, e + 0.15, n + 0.12]}
        style={{ width: "100%", height: "100%" }}
      >
        <Overlay onReady={setOverlay} />
      </MapGL>
    </div>
  );
}
