"""
Draws the Santa Ana parcel map for the demo video from the real data.

    python3 clayzo/demo/map.py          (after extract.ts wrote clayzo/demo/out/map.json)

57,926 parcel centroids are too many for vector nodes, so the parcels the SB 4 sieve cuts at
its first step are drawn as images, split into rings around the city centre so the cut can
travel outward as a wave. The ~200 parcels that survive step 1 stay vector (demo.ts draws them
from mapdata.json), so they can grow, fall away and stamp coral one by one. A second image is
the neighbourhood around the hero lot at the final zoom, drawn at screen resolution.

Writes clayzo/demo/out/assets/ring<i>.png, zoom.png and clayzo/demo/out/mapdata.json.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

# ---------------------------------------------------------------- layout (canvas px, 1920x1080)
MCX, MCY = 1340.0, 548.0  # where the city centre sits
PXKM = 96.0  # canvas px per km at zoom 1
LAT0 = 33.73703
LNG0 = -117.88763
KX = 111.32 * math.cos(math.radians(LAT0))  # km per degree of longitude
KY = 110.95  # km per degree of latitude
DOT = 2.7  # parcel dot diameter at zoom 1 (canvas px)
RES = 2  # ring images are drawn at 2x canvas resolution
RINGS = 8
ZOOM = 10.0  # final zoom on the hero lot
HERO_APN = "396-191-44"
HERO_SCREEN = (1340.0, 600.0)  # where the hero lot lands on screen at the final zoom
VIEW = (760.0, 0.0, 1920.0, 1080.0)  # the map's visible frame on screen (right of the sheet)

BLUE = (0x1D, 0x3B, 0xA8)
INK = (0x14, 0x1B, 0x3C)


def proj(lng, lat):
    return (MCX + (lng - LNG0) * KX * PXKM, MCY - (lat - LAT0) * KY * PXKM)


def disc_layer(w, h, pts, diameter, ss=3):
    """An RGBA image of blue discs at pts (image px), antialiased by supersampling."""
    big = Image.new("L", (w * ss, h * ss), 0)
    d = ImageDraw.Draw(big)
    r = diameter * ss / 2
    for x, y in pts:
        cx, cy = x * ss, y * ss
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    alpha = big.resize((w, h), Image.BOX)
    img = Image.new("RGBA", (w, h), BLUE + (0,))
    img.putalpha(alpha)
    return img


def main():
    m = json.load(open(os.path.join(OUT, "map.json")))
    sites = json.load(open(os.path.join(ROOT, "public", "data", "santa-ana", "sites.json")))
    lng, lat, fail, apns = m["lng"], m["lat"], m["failAt"], m["apn"]
    n = len(lng)
    pts = [proj(lng[i], lat[i]) for i in range(n)]

    # ------------------------------------------------------------ image frame
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    pad = 8
    x0, y0 = math.floor(min(xs) - pad), math.floor(min(ys) - pad)
    x1, y1 = math.ceil(max(xs) + pad), math.ceil(max(ys) + pad)
    W, H = (x1 - x0) * RES, (y1 - y0) * RES

    # ------------------------------------------------------------ rings of step-1 cuts
    cx = sum(xs) / n
    cy = sum(ys) / n
    cut1 = [i for i in range(n) if fail[i] == 1]
    dist = {i: math.hypot(pts[i][0] - cx, pts[i][1] - cy) for i in range(n)}
    maxd = max(dist.values())
    rings = [[] for _ in range(RINGS)]
    for i in cut1:
        k = min(RINGS - 1, int((dist[i] / maxd) ** 1.15 * RINGS))
        rings[k].append(i)
    os.makedirs(os.path.join(OUT, "assets"), exist_ok=True)
    ring_meta = []
    for k, idx in enumerate(rings):
        img = disc_layer(W, H, [((pts[i][0] - x0) * RES, (pts[i][1] - y0) * RES) for i in idx], DOT * RES)
        f = f"ring{k}.png"
        img.save(os.path.join(OUT, "assets", f), optimize=True)
        ring_meta.append({"file": f, "count": len(idx), "r": (k + 0.5) / RINGS})
        print(f"ring {k}: {len(idx)} dots", file=sys.stderr)

    # ------------------------------------------------------------ vector survivors of step 1
    # The engine lists a lot once even when several assessor records share it: the listed record
    # is the first survivor with each listed APN. Every other survivor is drawn but never stamped.
    listed = set()
    first = {}
    for i in range(n):
        if fail[i] == -1 and apns[i] not in first:
            first[apns[i]] = i
    for a in m["survivors"]:
        listed.add(first[a])
    vec = []
    for i in range(n):
        if fail[i] == 1:
            continue
        vec.append({"x": round(pts[i][0], 2), "y": round(pts[i][1], 2), "step": fail[i], "d": round(dist[i] / maxd, 4), "dup": fail[i] == -1 and i not in listed, "apn": apns[i]})

    # ------------------------------------------------------------ the hero lot and its neighbourhood
    hero = next(s for s in sites if s["apn"] == HERO_APN)
    hx, hy = proj(hero["lng"], hero["lat"])
    outline = [proj(a, b) for a, b in hero["outline"]]
    # What the screen shows at the final zoom, in canvas coordinates before zooming.
    vx0 = hx + (VIEW[0] - HERO_SCREEN[0]) / ZOOM
    vx1 = hx + (VIEW[2] - HERO_SCREEN[0]) / ZOOM
    vy0 = hy + (VIEW[1] - HERO_SCREEN[1]) / ZOOM
    vy1 = hy + (VIEW[3] - HERO_SCREEN[1]) / ZOOM
    ZW, ZH = int(VIEW[2] - VIEW[0]), int(VIEW[3] - VIEW[1])

    def to_zoom(p):
        return ((p[0] - vx0) * ZOOM, (p[1] - vy0) * ZOOM)

    near = [i for i in range(n) if vx0 - 4 <= pts[i][0] <= vx1 + 4 and vy0 - 4 <= pts[i][1] <= vy1 + 4 and fail[i] == 1]
    zimg = disc_layer(ZW, ZH, [to_zoom(pts[i]) for i in near], DOT * ZOOM, ss=2)
    # Outlines of the other candidate sites in view: hairlines in ink.
    lines = Image.new("L", (ZW * 2, ZH * 2), 0)
    ld = ImageDraw.Draw(lines)
    count_outlines = 0
    for s in sites:
        if s["apn"] == HERO_APN or not s.get("outline"):
            continue
        if not (vx0 - 20 <= proj(s["lng"], s["lat"])[0] <= vx1 + 20 and vy0 - 20 <= proj(s["lng"], s["lat"])[1] <= vy1 + 20):
            continue
        poly = [to_zoom(proj(a, b)) for a, b in s["outline"]]
        ld.line([(x * 2, y * 2) for x, y in poly] + [(poly[0][0] * 2, poly[0][1] * 2)], fill=255, width=3)
        count_outlines += 1
    lines = lines.resize((ZW, ZH), Image.BOX)
    ink = Image.new("RGBA", (ZW, ZH), INK + (0,))
    ink.putalpha(lines.point(lambda v: int(v * 0.35)))
    zimg = Image.alpha_composite(zimg, ink)
    zimg.save(os.path.join(OUT, "assets", "zoom.png"), optimize=True)
    print(f"zoom: {len(near)} dots, {count_outlines} outlines", file=sys.stderr)

    data = {
        "layout": {"mcx": MCX, "mcy": MCY, "pxkm": PXKM, "dot": DOT, "zoom": ZOOM, "heroScreen": HERO_SCREEN, "view": VIEW},
        "image": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0, "pxW": W, "pxH": H},
        "centre": [cx, cy],
        "rings": ring_meta,
        "survivors": vec,
        "hero": {"x": hx, "y": hy, "outline": [[round(a, 3), round(b, 3)] for a, b in outline]},
        "zoomImage": {"file": "zoom.png", "x": vx0, "y": vy0, "w": (vx1 - vx0), "h": (vy1 - vy0), "pxW": ZW, "pxH": ZH},
    }
    json.dump(data, open(os.path.join(OUT, "mapdata.json"), "w"))
    print(f"survivors(vector): {len(vec)}, final unique: {sum(1 for v in vec if v['step'] == -1 and not v['dup'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
