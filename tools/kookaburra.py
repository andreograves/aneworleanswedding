"""Synthesize an original kookaburra 'laugh' (no recordings used) -> WAV.
Structure of a real call: low chuckles that accelerate and rise into a loud
'ka-ka-ka' cackle, then slow and fall away. Each note is a harsh, harmonic-rich
yelp with a quick pitch rise-and-fall, plus a little breath noise."""
import sys, wave, numpy as np
SR = 44100
rng = np.random.default_rng(11)
out = []

def note(f0, dur, amp, rise=1.35, rasp=0.25, bright=1.0):
    n = int(SR * dur); t = np.arange(n) / SR; x = t / dur
    # pitch: quick rise then fall (inverted V), slight jitter
    contour = np.where(x < 0.3, 1 + (rise - 1) * (x / 0.3), rise - (rise - 0.85) * ((x - 0.3) / 0.7))
    f = f0 * contour * (1 + 0.012 * rng.standard_normal(n).cumsum() / np.sqrt(n))
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.zeros(n)
    for h in range(1, 14):
        sig += (bright ** (h - 1)) * (1 / h ** 0.9) * np.sin(h * ph + rng.uniform(0, 6.28))
    # raspiness: amplitude roughness ~ 90 Hz + noise
    rough = 1 + rasp * np.sin(2 * np.pi * rng.uniform(70, 110) * t) * rng.uniform(0.6, 1)
    sig = sig * rough + rasp * 0.6 * rng.standard_normal(n) * np.abs(np.sin(ph / 2))
    env = np.minimum(1, x / 0.08) * np.exp(-3.2 * np.maximum(0, x - 0.15))
    return amp * sig * env

def silence(d): return np.zeros(int(SR * d))

# phrase plan: (count, f0 start->end, note dur, gap, amp start->end, rise, bright)
plan = [
    (5,  (330, 380), 0.085, 0.085, (0.25, 0.4), 1.15, 0.55),   # low 'hoo-hoo' chuckles
    (7,  (420, 620), 0.070, 0.050, (0.4, 0.7),  1.30, 0.70),   # building
    (12, (720, 980), 0.060, 0.030, (0.85, 1.0), 1.45, 0.82),   # the cackle: 'ka-ka-ka'
    (7,  (900, 640), 0.065, 0.045, (0.9, 0.6),  1.40, 0.78),   # falling
    (4,  (520, 400), 0.080, 0.080, (0.5, 0.25), 1.20, 0.62),   # winding down
]
for count, (fa, fb), d, gap, (aa, ab), rise, bright in plan:
    for i in range(count):
        k = i / max(1, count - 1)
        f0 = fa + (fb - fa) * k + rng.uniform(-25, 25)
        amp = aa + (ab - aa) * k
        out.append(note(f0, d * rng.uniform(0.9, 1.15), amp, rise * rng.uniform(0.96, 1.04), 0.28, bright))
        out.append(silence(gap * rng.uniform(0.8, 1.25)))
sig = np.concatenate([silence(0.03)] + out + [silence(0.25)])
# gentle 'outdoor' space: two short echoes
for delay, g in ((0.045, 0.22), (0.11, 0.12)):
    d = int(SR * delay); sig[d:] += g * sig[:-d]
sig = sig / np.max(np.abs(sig)) * 0.89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((sig * 32767).astype(np.int16).tobytes())
print("seconds:", round(len(sig) / SR, 2))
