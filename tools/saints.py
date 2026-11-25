"""Brass-band arrangement of 'When the Saints Go Marching In' (public domain tune), written to MIDI."""
import random, sys
import mido

random.seed(7)
TPB = 480
BPM = 116
OUT = sys.argv[1]

# --- tune, written in C, transposed to Bb (brass band key) ---
T = -2
NOTE = {"C": 72, "D": 74, "E": 76, "F": 77, "G": 79}
MEL = [  # (name, beat, dur) relative to chorus start; pickup at beats 1-3
    ("C", 1, 1), ("E", 2, 1), ("F", 3, 1), ("G", 4, 4),
    ("C", 9, 1), ("E", 10, 1), ("F", 11, 1), ("G", 12, 4),
    ("C", 17, 1), ("E", 18, 1), ("F", 19, 1), ("G", 20, 2), ("E", 22, 2),
    ("C", 24, 2), ("E", 26, 2), ("D", 28, 4),
    ("E", 33, 1), ("E", 34, 1), ("D", 35, 1), ("C", 36, 3), ("C", 39, 1),
    ("E", 40, 2), ("G", 42, 1), ("G", 43, 1), ("F", 44, 4),
    ("E", 49, 1), ("F", 50, 1), ("G", 51, 1), ("E", 52, 2), ("C", 54, 2),
    ("D", 56, 4), ("C", 60, 1),
]
# chord per bar (bar 0 = pickup bar)
CH = ["C", "C", "C", "C", "C", "C", "C", "G7", "G7", "C", "C7", "F", "F", "C", "G7", "C"]
CHORD = {  # pitch classes relative to C (root first)
    "C": [0, 4, 7], "C7": [0, 4, 7, 10], "F": [5, 9, 0], "G7": [7, 11, 2, 5],
}
CHORUS = 60  # beats

tracks = {}
def trk(name, ch, prog):
    t = mido.MidiTrack(); t.name = name; tracks[name] = (t, ch, [])
    if ch != 9:
        t.append(mido.Message("program_change", program=prog, channel=ch, time=0))
    return name
def note(name, pitch, beat, dur, vel):
    _, ch, ev = tracks[name]
    jitter = random.uniform(-0.015, 0.015) if ch != 9 else random.uniform(-0.01, 0.01)
    s = max(0, beat + jitter)
    vel = max(1, min(127, int(vel + random.uniform(-7, 7))))
    ev.append((int(s * TPB), "on", pitch, vel))
    ev.append((int((s + dur) * TPB), "off", pitch, 0))

trk("trumpet", 0, 56); trk("trombone", 1, 57); trk("tuba", 2, 58)
trk("clarinet", 3, 71); trk("banjo", 4, 105); trk("drums", 9, 0)

def bass(pc): return 33 + ((pc - 33) % 12)
def chord_pcs(c): return [(p + T) % 12 for p in CHORD[c]]
def below(pitch, pcs, min_gap=3):
    p = pitch - min_gap
    while p % 12 not in pcs: p -= 1
    return p

def chorus(S, n, last=False):
    # melody (trumpet), harmony (trombone)
    for nm, b, d in MEL:
        if last and b == 60: d = 6
        p = NOTE[nm] + T
        dd = d * 0.92 if d <= 1 else d - 0.15
        note("trumpet", p, S + b, dd, 92 if n == 0 else 100)
        bar = min(int(b // 4), 15)
        h = below(p, chord_pcs(CH[bar]))
        note("trombone", h - 12 if h > 64 else h, S + b, dd, 74 if n == 0 else 84)
    # trumpet fills in held notes on chorus 2
    if n == 1:
        for fb in (6, 14):
            for k, iv in enumerate([7, 9, 10]):
                note("trumpet", NOTE["G"] + T + iv - 12, S + fb + k * 0.667, 0.5, 70)
    # tuba, banjo, clarinet per bar
    for bar in range(1, 16):
        c = CH[bar]; pcs = chord_pcs(c); root = bass(pcs[0])
        b0 = S + bar * 4
        if bar == 15 and last:
            note("tuba", root, b0, 5.5, 96); note("banjo", 55 + (pcs[0] - 7) % 12, b0, 4, 70)
            continue
        if n == 0:   # two-beat
            note("tuba", root, b0, 1.6, 98); note("tuba", root + 7, b0 + 2, 1.6, 90)
        else:        # walking
            nxt = chord_pcs(CH[min(bar + 1, 15)])[0]
            third = root + (CHORD[c][1] - CHORD[c][0]) % 12
            approach = bass(nxt) + (1 if bass(nxt) <= root else -1)
            for k, p in enumerate([root, third, root + 7, approach if bar < 15 else root + 7]):
                note("tuba", p, b0 + k, 0.85, 100 if k % 2 == 0 else 88)
        # banjo chunks on 2 and 4
        voicing = sorted(55 + ((pc - 7) % 12) for pc in pcs)
        for bb in (1, 3):
            for i, p in enumerate(voicing):
                note("banjo", p, b0 + bb + i * 0.012, 0.35, 62)
        # clarinet obbligato (swung eighths arpeggio) on chorus 2
        if n == 1:
            arp = sorted(77 + ((pc - 5) % 12) for pc in pcs)
            seq = arp + arp[::-1][1:-1] if len(arp) > 2 else arp
            for k in range(8):
                pos = (k // 2) + (0 if k % 2 == 0 else 0.667)
                note("clarinet", seq[k % len(seq)] + (12 if k in (3, 4) else 0), b0 + pos, 0.3, 58)

def drums(S, beats, roll_end=True):
    for i in range(beats):
        b = S + i; beat = i % 4
        # bass drum: 1 and 3, push on the trip-let before 3
        if beat in (0, 2): note("drums", 36, b, 0.2, 100)
        if beat == 1 and random.random() < 0.6: note("drums", 36, b + 0.667, 0.2, 80)
        # cymbal on 2 and 4 (brass band bass-drum cymbal)
        if beat in (1, 3): note("drums", 55, b, 0.2, 58)
        # snare: accents on 2 & 4, swung ghost notes
        note("drums", 38, b, 0.1, 96 if beat in (1, 3) else 40)
        note("drums", 38, b + 0.667, 0.1, 50 if random.random() < 0.7 else 70)
        if random.random() < 0.25: note("drums", 38, b + 0.333, 0.1, 34)
    if roll_end:  # press roll into the next chorus
        for k in range(12):
            note("drums", 38, S + beats - 2 + k / 6, 0.1, 50 + k * 4)

# ---------- form ----------
t = 0
# intro: 4-beat snare roll + bass drum
for k in range(24): note("drums", 38, t + k / 6, 0.1, 35 + k * 2)
note("drums", 36, t, 0.2, 90); note("drums", 36, t + 2, 0.2, 90)
S1 = 4 - 1  # pickup notes land at beats 4,5,6 → chorus "beat 0" = 3
chorus(S1, 0); drums(S1 + 4, CHORUS - 4)
note("drums", 49, S1 + 4, 1, 90)
S2 = S1 + CHORUS
chorus(S2, 1, last=True); drums(S2 + 4, CHORUS - 4, roll_end=False)
note("drums", 49, S2 + 4, 1, 100)
end = S2 + 60
for k in range(30): note("drums", 38, end + k / 6, 0.1, 40 + k * 2)
note("drums", 49, end + 5, 3, 110); note("drums", 36, end + 5, 0.3, 115)
for nm, p in (("trumpet", NOTE["C"] + T + 12), ("trombone", NOTE["C"] + T - 8), ("clarinet", NOTE["G"] + T + 12)):
    note(nm, p, end + 5, 3, 104)
note("tuba", 34, end + 5, 3, 104)

# ---------- write ----------
mid = mido.MidiFile(ticks_per_beat=TPB)
meta = mido.MidiTrack()
meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(BPM), time=0))
mid.tracks.append(meta)
for name, (track, ch, ev) in tracks.items():
    if ch != 9:
        track.append(mido.Message("control_change", control=91, value=55, channel=ch, time=0))
        pan = {0: 70, 1: 50, 2: 64, 3: 84, 4: 40}[ch]
        track.append(mido.Message("control_change", control=10, value=pan, channel=ch, time=0))
    ev.sort(key=lambda e: (e[0], 0 if e[1] == "off" else 1))
    last = 0
    for tick, kind, p, v in ev:
        track.append(mido.Message("note_on" if kind == "on" else "note_off", note=p, velocity=v, channel=ch, time=tick - last))
        last = tick
    mid.tracks.append(track)
mid.save(OUT)
print("beats:", end + 9, "seconds:", round((end + 9) * 60 / BPM, 1))
