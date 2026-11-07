const KEEP_UPPER = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "PO", "II", "III"]);

export function titleAddress(a: string | null | undefined): string | null {
  if (!a) return null;
  return a
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** What to call a site: its street address, else the mapped place of worship, else its APN. */
export function siteTitle(
  site: { apn: string | null; address: string | null; signals?: { worship?: { name: string | null } } } | undefined | null,
  fallbackAddress?: string | null,
  apn?: string | null,
): string {
  const id = site?.apn ?? apn;
  const name = titleAddress(site?.address ?? fallbackAddress) ?? site?.signals?.worship?.name;
  if (name) return name;
  return id && !id.startsWith("noapn:") ? `Parcel ${displayApn(id)}` : "Unnumbered parcel";
}

/** Number with thousands separators; never throws on null/NaN from the data. */
export const n = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "–" : x.toLocaleString("en-US"));

export function acres(sqft: number | null | undefined): string | null {
  if (!sqft || !Number.isFinite(sqft)) return null;
  const a = sqft / 43560;
  return a >= 0.1 ? `${a.toFixed(a >= 10 ? 0 : 2)} ac` : `${n(Math.round(sqft))} sq ft`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "date unknown";
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function displayApn(apn: string | null | undefined): string {
  if (!apn || apn.startsWith("noapn:")) return "not on file";
  const d = apn.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : apn;
}
