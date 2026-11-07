"""
The demo video's score: 30 s of 120 BPM house in A minor, synthesised from scratch and cut to
the picture. One bar is 2 s, so every visual beat in demo.ts sits on the grid.

    python3 clayzo/demo/music.py      (numpy + scipy)  ->  clayzo/demo/out/assets/score.wav

  bars 1-2   0-4 s    pads and a filtered pluck arpeggio under the painting; hats join
  bars 3-4   4-8 s    kick and bass creep in, the filter opens, a riser and a snare roll;
                      one beat of silence before the drop
  bars 5-8   8-16 s   DROP on the cut to the product: four-on-the-floor, offbeat bass, claps,
                      a blip on every sieve step (11.5, 13, 14, 15)
  bars 9-12  16-24 s  crash and a sparkle as the 90 lots stamp coral; whoosh into the zoom;
                      the lead hook enters; soft key-clicks while the letter writes itself
  bars 13-15 24-30 s  impact on the lockup, drums fall away, F - G - C rings out
"""
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
BPM = 120
BEAT = 60 / BPM  # 0.5 s
BAR = 4 * BEAT  # 2 s
DUR = 30.0
N = int(DUR * SR)
rng = np.random.default_rng(7)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out", "assets", "score.wav")


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def buf():
    return np.zeros((N, 2))


def place(bus, sig, t, gain=1.0, pan=0.0):
    """Add a mono or stereo signal into a stereo bus at time t (s), with constant-power pan."""
    i = int(round(t * SR))
    if i >= N:
        return
    if sig.ndim == 1:
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], axis=1)
    n = min(len(sig), N - i)
    bus[i : i + n] += sig[:n] * gain


def env(n, a, d, s, r, length):
    """ADSR in seconds; `length` is the time the note is held before release."""
    t = np.arange(n) / SR
    e = np.zeros(n)
    a = max(a, 1e-4)
    att = t < a
    e[att] = t[att] / a
    dec = (t >= a) & (t < a + d)
    e[dec] = 1 - (1 - s) * (t[dec] - a) / max(d, 1e-4)
    sus = (t >= a + d) & (t < length)
    e[sus] = s
    rel = t >= length
    level = s if length >= a + d else (min(1, length / a) if length < a else 1 - (1 - s) * (length - a) / max(d, 1e-4))
    e[rel] = level * np.exp(-(t[rel] - length) / max(r, 1e-4))
    return e


def saw(freq, n, phase=0.0):
    """Band-limited (polyBLEP) sawtooth."""
    dt = freq / SR
    ph = (phase + np.arange(n) * dt) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt
    y[m] -= x * x + x + x + 1
    return y


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos"), x, axis=0)


def tv_lp(x, cutoff, block=256):
    """A low-pass whose cutoff follows `cutoff(t)`, updated every block (state carried over)."""
    y = np.zeros_like(x)
    zi = None
    for s in range(0, len(x), block):
        fc = cutoff((s + block / 2) / SR)
        sos = butter(2, min(max(fc, 40), SR * 0.45), "low", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        y[s : s + block], zi = sosfilt(sos, x[s : s + block], axis=0, zi=zi)
    return y


def tv_bp(x, centre, q=1.2, block=256):
    y = np.zeros_like(x)
    zi = None
    for s in range(0, len(x), block):
        fc = centre((s + block / 2) / SR)
        lo, hi = fc / (1 + 1 / q), fc * (1 + 1 / q)
        sos = butter(1, [max(lo, 30), min(hi, SR * 0.45)], "band", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        y[s : s + block], zi = sosfilt(sos, x[s : s + block], axis=0, zi=zi)
    return y


def lerp_env(points):
    """Piecewise-linear automation from [(t, v), ...]."""
    ts = np.array([p[0] for p in points])
    vs = np.array([p[1] for p in points])
    return lambda t: float(np.interp(t, ts, vs))


def bar_t(b, beat=0.0, step=0):
    return b * BAR + beat * BEAT + step * BEAT / 4


# ------------------------------------------------------------------ harmony
CHORDS = {
    "Am": {"pad": [57, 60, 64, 67, 71], "root": 33},
    "F": {"pad": [53, 57, 60, 64, 67], "root": 29},
    "C": {"pad": [55, 60, 62, 64, 67], "root": 36},
    "G": {"pad": [55, 59, 62, 64, 67], "root": 31},
}
PROG = ["Am", "F", "C", "G", "Am", "F", "C", "G", "Am", "F", "C", "G", "F", "G", "C"]

DROP = 8.0
OUTRO = 24.0
GAP = (7.75, 8.0)  # one beat of air before the drop

# ------------------------------------------------------------------ instruments
def kick():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 44 + 120 * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.26)
    click = lp(rng.standard_normal(n) * np.exp(-t / 0.0025), 4000) * 0.5
    return np.tanh(1.6 * (body + click)) * 0.9


def clap():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    e = sum(np.where(t >= o, np.exp(-(t - o) / 0.006), 0) for o in (0, 0.011, 0.023))
    e = e + np.where(t >= 0.03, 0.8 * np.exp(-(t - 0.03) / 0.13), 0)
    return bp(rng.standard_normal(n), 900, 3200) * e * 1.4


def hat(open_=False):
    n = int((0.35 if open_ else 0.08) * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal(n), 7500, 3)
    return x * np.exp(-t / (0.12 if open_ else 0.022))


def crash(length=2.4):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = hp(rng.standard_normal((n, 2)), 3500, 2)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (3120, 4260, 5370, 6790)) / 4
    x[:, 0] += 0.25 * hp(metal, 3000)
    x[:, 1] += 0.25 * hp(np.roll(metal, 31), 3000)
    return x * np.exp(-t / 0.75)[:, None]


def boom():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    f = 38 + 70 * np.exp(-t / 0.08)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    rumble = lp(rng.standard_normal(n), 180) * np.exp(-t / 0.5) * 0.6
    return np.tanh(1.4 * (y + rumble))


def supersaw(m, n, detune=(-14, -7, 0, 7, 14), pans=(-0.7, -0.35, 0, 0.35, 0.7)):
    out = np.zeros((n, 2))
    for c, p in zip(detune, pans):
        v = saw(mtof(m) * 2 ** (c / 1200), n, rng.random())
        out[:, 0] += v * np.cos((p + 1) * np.pi / 4)
        out[:, 1] += v * np.sin((p + 1) * np.pi / 4)
    return out / len(detune)


def pluck(m, length=0.22, bright=1.0):
    n = int((length + 0.3) * SR)
    t = np.arange(n) / SR
    x = 0.6 * saw(mtof(m), n) + 0.4 * saw(mtof(m) * 1.003, n, 0.3)
    # A fast filter envelope: bright attack, closing quickly.
    y = np.zeros(n)
    edges = [0, 0.01, 0.03, 0.07, 0.15, n / SR]
    cuts = [7000 * bright, 4500 * bright, 2600 * bright, 1500 * bright, 900 * bright]
    for k in range(len(cuts)):
        a, b = int(edges[k] * SR), int(edges[k + 1] * SR)
        y[a:b] = lp(x, cuts[k])[a:b]
    return y * env(n, 0.002, 0.12, 0.25, 0.08, length)


def lead(m, length):
    n = int((length + 0.35) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.12) / 0.2, 0, 1)
    ph = np.cumsum(mtof(m) * vib) / SR
    sq = np.sign(np.sin(2 * np.pi * ph)) * 0.5 + 0.5 * (2 * (ph % 1) - 1)
    return lp(sq, 3200) * env(n, 0.008, 0.1, 0.7, 0.12, length)


def blip(m, length=0.5):
    n = int(length * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * mtof(m) * t) + 0.3 * np.sin(4 * np.pi * mtof(m) * t)) * np.exp(-t / 0.09)


def click():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 2500, 6000) * np.exp(-t / 0.004)


# ------------------------------------------------------------------ buses
drums = buf()
bass = buf()
pads = buf()
arp = buf()
leadb = buf()
fx = buf()

K = kick()
for b in range(15):
    for beat in range(4):
        t = bar_t(b, beat)
        if DROP <= t < OUTRO:
            place(drums, K, t, 1.0)
        elif 4.0 <= t < DROP:
            # bar 3: kick on 1 and 3, bar 4: every beat, growing
            if b == 2 and beat in (0, 2):
                place(drums, K, t, 0.55)
            if b == 3 and t < GAP[0]:
                place(drums, K, t, 0.6 + 0.1 * beat)
        elif OUTRO <= t < 28.0 and beat in (0, 2):
            place(drums, K, t, 0.5 if t > OUTRO else 0.0)

CL = clap()
for b in range(4, 12):
    for beat in (1, 3):
        place(drums, CL, bar_t(b, beat), 0.55, 0.05)

HC, HO = hat(), hat(True)
for b in range(15):
    for st in range(16):
        t = bar_t(b, step=st)
        if GAP[0] <= t < GAP[1] or t >= 28.0:
            continue
        if 2.0 <= t < DROP and st % 2 == 0:
            place(drums, HC, t, 0.18 + 0.1 * (t - 2) / 6, 0.25)
        elif DROP <= t < OUTRO:
            vel = [0.5, 0.25, 0.32, 0.25][st % 4]
            place(drums, HC, t, vel * 0.5, 0.3)
            if st % 4 == 2:
                place(drums, HO, t, 0.22, -0.2)
        elif OUTRO <= t < 28.0 and st % 4 == 2:
            place(drums, HC, t, 0.12, 0.3)

# Snare roll into the drop: 16ths over beats 3-4 of bar 4, rising.
for k in range(7):
    t = bar_t(3, 2, k)
    if t < GAP[0]:
        place(drums, CL, t, 0.12 + 0.07 * k, 0)
place(drums, CL, bar_t(3, 0), 0.25, 0)

# Bass: offbeat eighths in the drop, held roots in the outro.
for b, ch in enumerate(PROG):
    root = CHORDS[ch]["root"]
    for beat in range(4):
        t = bar_t(b, beat + 0.5)
        if DROP <= t < OUTRO or (6.0 <= t < GAP[0]):
            n = int(0.42 * SR)
            x = 0.7 * saw(mtof(root + 12), n) + 0.6 * np.sin(2 * np.pi * mtof(root + 12) * np.arange(n) / SR)
            x = lp(x, 520) * env(n, 0.004, 0.08, 0.6, 0.06, 0.2)
            place(bass, x, t, 0.75 if t >= DROP else 0.45)
    if b >= 12:
        n = int((2.6 if b < 14 else 2.0) * SR)
        x = lp(0.6 * saw(mtof(root + 12), n) + 0.8 * np.sin(2 * np.pi * mtof(root + 12) * np.arange(n) / SR), 300)
        place(bass, x * env(n, 0.03, 0.3, 0.7, 0.5, 1.9), bar_t(b), 0.6)

# Pads: one chord per bar.
for b, ch in enumerate(PROG):
    length = BAR if b < 14 else 2.0
    n = int((length + 1.2) * SR)
    chord = np.zeros((n, 2))
    for m in CHORDS[ch]["pad"]:
        chord += supersaw(m, n)
    a = 0.6 if b < 4 else (0.03 if b < 12 else 0.25)
    e = env(n, a, 0.4, 0.75, 0.6 if b < 14 else 1.0, length)
    place(pads, chord * e[:, None], bar_t(b), 0.5)
pad_cut = lerp_env([(0, 500), (4, 900), (7.6, 2600), (8, 3200), (24, 3200), (24.01, 2200), (30, 900)])
pads = tv_lp(pads, pad_cut)

# Pluck arpeggio: sixteenths over the chord tones, two octaves.
ARP = [0, 2, 4, 1, 3, 5, 2, 4]
for b, ch in enumerate(PROG):
    tones = CHORDS[ch]["pad"] + [m + 12 for m in CHORDS[ch]["pad"]]
    for st in range(16):
        t = bar_t(b, step=st)
        if GAP[0] <= t < GAP[1] or t >= 28.5:
            continue
        m = tones[ARP[(st + b * 3) % len(ARP)] + (st // 8)] + 12
        bright = 0.35 if t < 4 else (0.55 if t < DROP else (1.0 if t < OUTRO else 0.6))
        vel = [0.9, 0.55, 0.7, 0.55][st % 4]
        place(arp, pluck(m, 0.16, bright), t, 0.22 * vel, 0.35 if st % 2 else -0.35)
# Ping-pong delay at a dotted eighth.
d = int(0.375 * SR)
wet = np.zeros_like(arp)
for k in range(1, 5):
    g = 0.38**k
    sh = arp[: N - k * d] * g
    if k % 2:
        sh = sh[:, ::-1]
    wet[k * d :] += sh
arp = arp + lp(wet, 4000)

# Lead hook in the second half of the drop: (step, note, length in 16ths) per bar.
HOOK = {
    "Am": [(0, 76, 2), (3, 79, 1), (4, 76, 2), (6, 74, 2), (8, 72, 3), (11, 74, 1), (12, 76, 4)],
    "F": [(0, 72, 2), (3, 74, 1), (4, 72, 2), (6, 69, 2), (8, 72, 6)],
    "C": [(0, 79, 2), (3, 76, 1), (4, 79, 2), (6, 81, 2), (8, 79, 3), (11, 76, 1), (12, 74, 4)],
    "G": [(0, 74, 2), (2, 76, 2), (4, 74, 2), (6, 71, 2), (8, 74, 8)],
}
for b in range(8, 12):
    for st, m, ln in HOOK[PROG[b]]:
        t = bar_t(b, step=st)
        place(leadb, lead(m, ln * BEAT / 4), t, 0.28, 0.1)
        place(leadb, lead(m - 12, ln * BEAT / 4), t, 0.12, -0.1)

# ------------------------------------------------------------------ cues on the picture
# Riser into the drop: noise through a band sweeping up, swelling.
n = int(2.6 * SR)
noise = rng.standard_normal((n, 2))
rise = tv_bp(noise, lambda t: 300 * (8000 / 300) ** min(1, t / 2.5), q=2.5)
tt = np.arange(n) / SR
swell = (tt / 2.3) ** 2.2 * np.clip((7.75 - 5.4 - tt) / 0.04, 0, 1)  # cut dead on the breath before the drop
place(fx, rise * swell[:, None], 5.4, 0.55)
place(fx, boom(), DROP, 0.9)
place(fx, crash(), DROP, 0.35)
# A blip on each sieve step (A minor, climbing), and a sparkle as the 90 lots stamp coral.
for t, m in ((11.5, 81), (13.0, 84), (14.0, 86), (15.0, 88)):
    place(fx, blip(m), t, 0.22, 0.2)
    place(fx, blip(m + 12), t + 0.375, 0.08, -0.3)
place(fx, crash(), 16.0, 0.3)
for k, m in enumerate([69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96]):
    place(fx, pluck(m, 0.08, 1.2), 16.0 + k * 0.05, 0.14, -0.6 + k * 0.1)
# Whoosh into the zoom.
n = int(1.3 * SR)
wh = tv_bp(rng.standard_normal((n, 2)), lambda t: 400 * (5000 / 400) ** min(1, t / 1.1), q=1.6)
tt = np.arange(n) / SR
place(fx, wh * (np.sin(np.pi * np.clip(tt / 1.3, 0, 1)) ** 2)[:, None], 16.95, 0.35)
# Key clicks while the letter writes itself (one per line, as demo.ts types them).
for i, line in enumerate([1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1]):
    if line:
        for j in range(3):
            place(fx, click(), 21.75 + i * 0.13 + j * 0.035, 0.05, rng.uniform(-0.4, 0.4))
# Impact on the lockup, and a chime as the wordmark lands.
place(fx, boom(), OUTRO, 0.8)
place(fx, crash(3.5), OUTRO, 0.3)
for k, m in enumerate([72, 76, 79, 84]):
    place(fx, blip(m, 1.2), 24.75 + k * 0.06, 0.1, -0.3 + k * 0.2)

# ------------------------------------------------------------------ sidechain, space, master
t = np.arange(N) / SR
duck = np.ones(N)
for b in range(15):
    for beat in range(4):
        k0 = bar_t(b, beat)
        if DROP <= k0 < OUTRO:
            i = int(k0 * SR)
            seg = np.arange(N - i) / SR
            duck[i:] *= 1 - 0.55 * np.exp(-seg / 0.11)
duck = np.clip(duck, 0.35, 1)[:, None]
pads *= duck
bass *= np.clip(duck * 1.1, 0, 1)
arp *= np.clip(duck * 1.3, 0, 1)

# Silence the gap before the drop (everything but the riser).
g0, g1 = int(GAP[0] * SR), int(GAP[1] * SR)
for bus in (drums, bass, pads, arp, leadb):
    fade = np.linspace(1, 0, int(0.03 * SR))
    bus[g0 : g0 + len(fade)] *= fade[:, None]
    bus[g0 + len(fade) : g1] = 0

# Reverb: a decaying stereo noise impulse.
ir_n = int(2.2 * SR)
ir_t = np.arange(ir_n) / SR
ir = lp(rng.standard_normal((ir_n, 2)), 6500) * np.exp(-ir_t / 0.45)[:, None]
ir /= np.sqrt((ir**2).sum(axis=0))
send = pads * 0.35 + arp * 0.3 + leadb * 0.35 + fx * 0.4 + drums * 0.06
verb = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)

mix = drums * 0.9 + bass * 0.85 + pads * 0.55 + arp * 0.8 + leadb * 0.8 + fx * 0.9 + verb * 0.5
mix = hp(mix, 28)
# Glue: gentle saturation, then normalise to -3.5 dBFS sample peak (about -14 LUFS, true peak under -1).
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix /= np.max(np.abs(mix)) / 10 ** (-3.5 / 20)
# Fades: 20 ms in; the last chord rings and fades over the final 1.6 s.
mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
fo = int(1.6 * SR)
mix[-fo:] *= (np.linspace(1, 0, fo) ** 1.5)[:, None]

os.makedirs(os.path.dirname(OUT), exist_ok=True)
wavfile.write(OUT, SR, (mix * 32767).astype(np.int16))
rms = 20 * np.log10(np.sqrt(np.mean(mix**2)))
print(f"wrote {OUT}: {DUR:.1f} s, peak -3.5 dBFS, rms {rms:.1f} dBFS")
