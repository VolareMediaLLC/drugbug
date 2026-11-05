"""Seven bug-genre study loops for DrugBug (owner, Nov 5 2026).
Rendered from the GM SoundFont on this machine with sf2.py, plus a few synthesized parts
(wobble bass, cricket chirps, wing buzz). Each track is a seamless loop of about 50 s."""
import sys, subprocess, numpy as np
from scipy.signal import lfilter, butter
import sf2
from sf2 import SR, Mix
F = sf2.SF2('/usr/share/sounds/sf2/TimGM6mb.sf2')
rng = np.random.default_rng(7)

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'm7b5': [0, 3, 6, 10],
        '9': [0, 4, 10, 14], 'm9': [0, 3, 10, 14], 'maj9': [0, 4, 11, 14], '6': [0, 4, 7, 9], 'sus': [0, 5, 7], '5': [0, 7, 12], '13': [0, 4, 10, 21]}
def chord(name):
    r = name[:2] if len(name) > 1 and name[1] in '#b' else name[:1]
    return NOTE[r], QUAL[name[len(r):]]

class Song:
    def __init__(s, bpm, bars, beats=4, swing=0.0):
        s.bpm, s.bars, s.beats, s.sw = bpm, bars, beats, swing
        s.spb = 60.0 / bpm; s.len = bars * beats * s.spb
        s.m = Mix(s.len + 4)
    def t(s, beat):
        b = np.floor(beat); f = beat - b
        if s.sw and abs(f - 0.5) < 1e-6: f = 0.5 + s.sw / 2   # swung eighths
        return (b + f) * s.spb
    def n(s, prog, key, beat, dur, vel=90, gain=1.0, pan=0.0, bank=0, hum=True):
        if hum: beat += rng.normal(0, 0.008); vel = int(np.clip(vel + rng.normal(0, 5), 1, 127))
        s.m.add(s.t(beat), F.note(bank, prog, int(key), vel, max(0.05, dur * s.spb)), gain, pan)
    def d(s, key, beat, vel=100, gain=1.0, kit=0, pan=0.0):
        s.n(kit, key, beat, 0.25, vel, gain, pan, bank=128)
    def raw(s, beat, a, gain=1.0):
        s.m.add(s.t(beat), a, gain)
    def finish(s, name, target=-19.5):
        b = s.m.buf; L = int(s.len * SR)
        loop = b[:, :L].copy(); tail = b[:, L:]
        loop[:, :tail.shape[1]] += tail[:, :L]             # wrap the tail so the loop is seamless
        hp = butter(2, 30 / (SR / 2), 'high'); loop = lfilter(*hp, loop, axis=1)
        rms = np.sqrt(np.mean(loop ** 2)); loop *= 10 ** (target / 20) / (rms + 1e-9)
        loop = np.tanh(loop * 1.15) / 1.15                  # gentle limiter
        pk = np.abs(loop).max(); loop *= min(1.0, 0.7 / pk)
        pcm = (np.clip(loop, -1, 1).T * 32767).astype('<i2').tobytes()
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-',
                        '-codec:a', 'libmp3lame', '-b:a', '112k', name], input=pcm, check=True)
        print(name, round(s.len, 1), 's')

# ---------- synthesized bug bits ----------
def chirp(n=3, f=4300, rate=0.055):
    """a cricket: a few fast pulses of a pure high tone"""
    one = int(0.03 * SR); t = np.arange(one) / SR
    p = np.sin(2 * np.pi * f * t) * np.sin(np.pi * np.arange(one) / one) ** 2
    out = np.zeros(int((n * rate + 0.05) * SR))
    for i in range(n): k = int(i * rate * SR); out[k:k + one] += p
    return np.vstack([out, out]).astype(np.float32) * 0.18
def buzz(dur, f=180, depth=0.4):
    """wing buzz: a bright saw with a fast tremolo"""
    t = np.arange(int(dur * SR)) / SR
    w = 2 * ((t * f) % 1) - 1; w *= 1 - depth + depth * np.sin(2 * np.pi * 34 * t) ** 2
    b, a = butter(2, 2400 / (SR / 2)); w = lfilter(b, a, w) * np.sin(np.pi * t / t[-1]) ** 0.5
    return np.vstack([w, w]).astype(np.float32) * 0.12
def wobble(freq, dur, rate_hz, spb):
    """dubstep bass: detuned saws through a lowpass whose cutoff an LFO sweeps"""
    n = int(dur * SR); t = np.arange(n) / SR
    w = sum(2 * ((t * freq * d) % 1) - 1 for d in (1, 1.006, 0.994)) / 3 + 0.6 * np.sin(2 * np.pi * freq / 2 * t)
    out = np.zeros(n); blk = 256; zi = np.zeros(4)
    for i in range(0, n, blk):
        lfo = 0.5 - 0.5 * np.cos(2 * np.pi * rate_hz * t[i])
        fc = 90 + 2600 * lfo ** 1.6
        b, a = butter(4, min(fc, 15000) / (SR / 2))
        if i == 0: zi = np.zeros(max(len(a), len(b)) - 1)
        out[i:i + blk], zi = lfilter(b, a, w[i:i + blk], zi=zi)
    env = np.minimum(1, np.arange(n) / (0.01 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.03 * SR))
    out = np.tanh(out * 2.2 * env) * 0.32
    return np.vstack([out, out]).astype(np.float32)
def sub(freq, dur):
    t = np.arange(int(dur * SR)) / SR; e = np.minimum(1, (len(t) - np.arange(len(t))) / (0.05 * SR))
    w = np.sin(2 * np.pi * freq * t) * e * 0.4; return np.vstack([w, w]).astype(np.float32)
def hz(k): return 440 * 2 ** ((k - 69) / 12)

def comp(s, prog, beat, name, dur, base=52, vel=70, gain=1.0, inv=0, spread=False):
    r, q = chord(name); notes = [base + ((r - base) % 12) + i for i in q]
    for i in range(inv): notes[i] += 12
    for k in sorted(notes): s.n(prog, k, beat, dur, vel, gain)

# ================= tracks =================
def slow_bug_jazz():
    s = Song(66, 14, swing=0.34)
    prog = ['Dm9', 'G13', 'Cmaj9', 'A7', 'Dm9', 'G13', 'Em7', 'A7', 'Dm9', 'G13', 'Cmaj9', 'Fmaj7', 'Em7', 'A7']
    mel = [[(0, 69, 1.5), (1.5, 72, .5), (2, 74, 1), (3, 72, .5), (3.5, 69, .5)], [(0, 71, 2), (2.5, 67, .5), (3, 65, 1)],
           [(0, 64, 1), (1, 67, .5), (1.5, 71, 1.5), (3, 72, 1)], [(0, 73, 1.5), (1.5, 72, .5), (2, 69, 2)]]
    for b, c in enumerate(prog):
        B = b * 4; r, _ = chord(c)
        comp(s, 4, B + 0.5 + (b % 2) * 1, c, 2.6, 52, 52, 0.9)
        comp(s, 4, B + 2.5, c, 1.2, 52, 44, 0.7)
        root = 36 + r; fifth = root + 7
        for i, k in enumerate([root, fifth if b % 2 else root + 12, root + 3 + (b % 3), fifth - 1]): s.n(32, k, B + i, 0.95, 88, 1.3)
        for i in range(4):
            s.d(51, B + i, 70, 0.55, kit=40); s.d(51, B + i + 0.5, 50, 0.45, kit=40)
            if i % 2: s.d(44, B + i, 60, 0.6, kit=40)
        if b >= 2:
            for o, k, d in mel[b % 4]: s.n(66, k - 12 if b >= 8 else k, B + o, d * 0.95, 82, 0.95)
        if b % 4 == 3: s.raw(B + 3.5, chirp(3, 4100), 0.6)
    s.finish('slow-bug-jazz.mp3')
def bug_house():
    s = Song(122, 26)
    prog = ['Am7', 'Am7', 'Dm9', 'Dm9', 'Fmaj7', 'Fmaj7', 'Em7', 'E7']
    hook = [(0.5, 76), (1, 74), (1.5, 72), (2.5, 74), (3, 76), (3.5, 79)]
    for b in range(s.bars):
        B = b * 4; c = prog[b % 8]; r, _ = chord(c); intro = b < 2
        for i in range(4): s.d(36, B + i, 118, 1.1, kit=24)
        if not intro:
            s.d(39, B + 1, 100, 0.7, kit=24); s.d(39, B + 3, 100, 0.7, kit=24)
            for i in range(4): s.d(46, B + i + 0.5, 80, 0.5, kit=24); s.d(42, B + i + 0.25, 45, 0.35, kit=24); s.d(42, B + i + 0.75, 45, 0.35, kit=24)
            for i in (0.5, 1.5, 2.5, 3.5): s.n(38, 33 + r if r < 7 else 21 + r + 12, B + i, 0.4, 100, 1.0)
        for o in (0, 0.75, 1.5, 2.5, 3.0): comp(s, 0, B + o, c, 0.3, 58, 88, 0.55)
        if 6 <= b < 22 and b % 2 == 0:
            for o, k in hook: s.n(80, k - (2 if b % 8 >= 4 else 0), B + o, 0.35, 85, 0.35)
        if b % 4 == 3: s.raw(B + 3.25, chirp(4, 4600, 0.045), 0.7)
        if b % 8 == 7: s.d(49, B + 4, 90, 0.5, kit=24)
    s.finish('bug-house.mp3')
def bugstep():
    s = Song(140, 28)
    keys = [38, 38, 41, 36]   # D, D, F, C (low)
    pad = ['Dm', 'Dm', 'F', 'C']
    for b in range(s.bars):
        B = b * 4; k = keys[(b // 2) % 4]; drop = b >= 8
        if not drop:
            comp(s, 89, B, pad[(b // 2) % 4], 4, 50, 70, 0.6)
            for i in range(4): s.d(42, B + i + 0.5, 50, 0.4, kit=24)
            if b >= 4:
                for i in range(int(2 ** (b - 3))): s.d(38, B + i * 4 / 2 ** (b - 3), 70 + 6 * (b - 4), 0.5, kit=24)
            if b == 7: s.raw(B + 2, buzz(s.spb * 2, 140, 0.6), 1.2)
        else:
            s.d(36, B, 127, 1.4, kit=24); s.d(36, B + 2.75, 110, 1.1, kit=24); s.d(38, B + 2, 127, 1.2, kit=24); s.d(39, B + 2, 100, 0.6, kit=24)
            for i in range(8): s.d(42, B + i * 0.5 + (0.25 if i % 3 == 2 else 0), 60 + (i % 2) * 20, 0.45, kit=24)
            pat = [(0, 1.5, 1 / (s.spb / 2)), (1.5, 0.5, 1 / (s.spb / 4)), (2, 1.25, 1 / (s.spb / 3)), (3.25, 0.75, 1 / (s.spb / 6))]
            if b % 2: pat = [(0, 0.75, 1 / (s.spb / 4)), (0.75, 1.25, 1 / (s.spb / 2)), (2, 2, 1 / (s.spb / 8))]
            for o, d, rate in pat: s.raw(B + o, wobble(hz(k), d * s.spb, rate, s.spb), 1.0)
            s.raw(B, sub(hz(k - 12), 3.8 * s.spb), 0.8)
            if b % 4 == 3: s.raw(B + 3.5, buzz(s.spb * 0.5, 220, 0.7), 1.3)
            if b % 8 == 0: s.d(49, B, 100, 0.6, kit=24)
            if b % 4 == 1: s.raw(B + 1, chirp(5, 5200, 0.04), 0.7)
    s.finish('bugstep.mp3')
def bug_rock():
    s = Song(132, 26)
    riff = [(0, 40, .5), (0.5, 40, .5), (1, 43, .5), (1.5, 45, 1), (2.5, 40, .5), (3, 47, .5), (3.5, 45, .5)]
    prog = ['E5', 'E5', 'G5', 'A5', 'E5', 'E5', 'C5', 'D5']
    lead = [(0, 76, .75), (0.75, 79, .25), (1, 81, 1), (2, 79, .5), (2.5, 76, .5), (3, 74, 1)]
    for b in range(s.bars):
        B = b * 4; c = prog[b % 8]; r, _ = chord(c.replace('5', '')); intro = b < 4
        if intro:
            for o, k, d in riff: s.n(30, k + 12, B + o, d * 0.9, 100, 0.55)
            if b >= 2: s.d(42, B, 80, 0.6, kit=16); [s.d(42, B + i * .5, 70, 0.4, kit=16) for i in range(8)]
            continue
        for i in range(8): s.n(30, 40 + ((r - 4) % 12), B + i * .5, .45, 105, 0.5); s.n(30, 47 + ((r - 4) % 12), B + i * .5, .45, 95, 0.45)
        for i in range(8): s.n(34, 28 + ((r - 4) % 12), B + i * .5, .45, 100, 1.0)
        s.d(36, B, 120, 1.0, kit=16); s.d(36, B + 1.5, 110, 0.9, kit=16); s.d(36, B + 2.5, 110, 0.9, kit=16)
        s.d(38, B + 1, 120, 1.0, kit=16); s.d(38, B + 3, 120, 1.0, kit=16)
        for i in range(8): s.d(42, B + i * .5, 85 if i % 2 == 0 else 60, 0.5, kit=16)
        if b % 8 == 4: s.d(49, B, 110, 0.7, kit=16)
        if 8 <= b < 20 and b % 2 == 0:
            for o, k, d in lead: s.n(29, k - (3 if b % 8 >= 4 else 0), B + o, d, 100, 0.45)
        if b % 8 == 7:
            for i in range(4): s.d(48 - i * 3, B + 2 + i * .5, 110, 0.8, kit=16)
            s.raw(B + 3.5, chirp(3, 3900), 0.8)
    s.finish('bug-rock.mp3')
def banjo_bug():
    """Banjo Bug: a bluegrass breakdown. Banjo forward rolls carry it, the hammered dulcimer takes
    the tune, and an upright bass and brushed snare keep a two-step underneath."""
    s = Song(118, 26)
    prog = ['G', 'G', 'C', 'G', 'G', 'G', 'D', 'D', 'G', 'G', 'C', 'C', 'G', 'D', 'G', 'G']
    tune = [[(0, 71, .5), (.5, 74, .5), (1, 79, 1), (2, 78, .5), (2.5, 76, .5), (3, 74, 1)],
            [(0, 71, .5), (.5, 69, .5), (1, 67, .5), (1.5, 69, .5), (2, 71, 2)],
            [(0, 72, .5), (.5, 76, .5), (1, 79, 1), (2, 76, .5), (2.5, 72, .5), (3, 76, 1)],
            [(0, 74, 1.5), (1.5, 71, .5), (2, 67, 2)],
            [(0, 71, .5), (.5, 74, .5), (1, 79, .5), (1.5, 81, .5), (2, 83, 1), (3, 81, 1)],
            [(0, 79, .5), (.5, 78, .5), (1, 76, .5), (1.5, 74, .5), (2, 71, 2)],
            [(0, 69, .5), (.5, 71, .5), (1, 72, .5), (1.5, 74, .5), (2, 76, 1), (3, 78, 1)],
            [(0, 79, 2), (2, 74, 1), (3, 67, 1)]]
    roll = [0, 1, 2, 0, 1, 2, 0, 2]   # a forward roll: thumb, index, middle
    for b in range(s.bars):
        B = b * 4; c = prog[b % 16]; r, q = chord(c)
        tones = [55 + ((r + i - 55) % 12) for i in q]; tones = sorted(tones) + [62 + ((r - 62) % 12) + 12]
        for i in range(8):   # banjo, always rolling; the 5th string drone G on the offbeats
            k = tones[roll[i] % 3] + 12 if i % 4 != 3 else 79
            s.n(105, k, B + i * .5, .45, 92 if i % 2 == 0 else 78, 0.62, pan=-0.25)
        root = 36 + r if r < 5 else 24 + r; fifth = root + 7 if root + 7 < 50 else root - 5
        s.n(32, root, B, .9, 104, 1.25); s.n(32, fifth, B + 2, .9, 98, 1.2)
        if b % 2: s.n(32, fifth + 2, B + 3.5, .45, 85, 1.0)
        s.d(36, B, 80, 0.6, kit=40); s.d(36, B + 2, 76, 0.6, kit=40)
        s.d(38, B + 1, 88, 0.7, kit=40); s.d(38, B + 3, 88, 0.7, kit=40)
        for i in range(8): s.d(42, B + i * .5, 50, 0.3, kit=40)
        comp(s, 25, B + 1, c, .4, 52, 70, 0.4); comp(s, 25, B + 3, c, .4, 52, 66, 0.4)
        if b >= 2:   # hammered dulcimer melody, doubled an octave up very softly
            for o, k, d in tune[(b - 2) % 8]: s.n(15, k, B + o, d * 1.1, 98, 0.85, pan=0.2); s.n(15, k + 12, B + o, d * .6, 60, 0.2, pan=0.3)
        if b >= 18 and b % 2 == 0:
            for o, k, d in tune[(b + 1) % 8]: s.n(110, k - 12, B + o, d * .95, 80, 0.4, pan=0.35)
        if b % 4 == 3: s.raw(B + 3.5, chirp(3, 4400), 0.7)
    s.finish('banjo-bug.mp3')
def classy_bug():
    s = Song(100, 28, beats=3)      # a minuet
    prog = ['G', 'D', 'G', 'C', 'G', 'D', 'G', 'D', 'Em', 'Am', 'D', 'G', 'C', 'G', 'D', 'G']
    mel = [[(0, 74, 1), (1, 67, .5), (1.5, 69, .5), (2, 71, .5), (2.5, 72, .5)], [(0, 74, 1), (1, 67, 1), (2, 67, 1)],
           [(0, 76, 1), (1, 72, .5), (1.5, 74, .5), (2, 76, .5), (2.5, 78, .5)], [(0, 79, 1), (1, 67, 1), (2, 67, 1)],
           [(0, 72, 1), (1, 74, .5), (1.5, 72, .5), (2, 71, .5), (2.5, 69, .5)], [(0, 71, 1), (1, 72, .5), (1.5, 71, .5), (2, 69, .5), (2.5, 67, .5)],
           [(0, 69, 1), (1, 71, .5), (1.5, 69, .5), (2, 67, .5), (2.5, 66, .5)], [(0, 67, 3)]]
    for b in range(s.bars):
        B = b * 3; c = prog[b % 16]; r, q = chord(c)
        bass = 36 + r if r < 7 else 24 + r
        s.n(42, bass, B, 1.9, 80, 1.0); s.n(42, bass + 7 if r < 5 else bass + 12, B + 2, .9, 70, 0.8)
        for i in (1, 2): comp(s, 6, B + i, c, .45, 55, 70, 0.55)
        if b >= 2:
            for o, k, d in mel[b % 8]: s.n(40, k, B + o, d * .95, 88, 0.75); s.n(6, k + 12, B + o, d * .5, 60, 0.25)
        if b >= 12: comp(s, 48, B, c, 2.9, 60, 55, 0.35)
        if b % 8 == 7: s.raw(B + 2.5, chirp(2, 3800), 0.5)
    s.finish('classy-bug.mp3')
def bug_pop():
    s = Song(116, 26)
    prog = ['C', 'G', 'Am', 'F']
    hook = [[(0, 76, .5), (.5, 76, .5), (1, 79, .75), (2, 76, .5), (2.5, 74, .5), (3, 72, 1)], [(0, 74, .5), (.5, 74, .5), (1, 71, .5), (1.5, 74, .5), (2, 79, 1.5)],
            [(0, 76, .5), (.5, 77, .5), (1, 76, .5), (1.5, 72, 1), (3, 69, .5), (3.5, 72, .5)], [(0, 72, 1.5), (1.5, 74, .5), (2, 72, 1), (3, 67, 1)]]
    for b in range(s.bars):
        B = b * 4; c = prog[b % 4]; r, _ = chord(c); intro = b < 2
        comp(s, 89, B, c, 4, 55, 62, 0.5)
        for i in range(8): s.n(38, 36 + r if r < 7 else 24 + r, B + i * .5, .35, 100 if i % 2 == 0 else 80, 0.9)
        if not intro:
            s.d(36, B, 115, 1.0, kit=24); s.d(36, B + 2, 110, 0.9, kit=24); s.d(36, B + 2.5, 90, 0.7, kit=24)
            s.d(38, B + 1, 105, 0.8, kit=24); s.d(39, B + 3, 105, 0.8, kit=24); s.d(38, B + 3, 100, 0.7, kit=24)
            for i in range(8): s.d(42, B + i * .5, 70, 0.4, kit=24)
        for i in range(8): comp(s, 4, B + i * .5, c, .25, 64, 55, 0.25)
        if 4 <= b < 20:
            for o, k, d in hook[b % 4]: s.n(80, k, B + o, d * .9, 95, 0.45); s.n(11, k + 12, B + o, d * .6, 70, 0.25)
        if b % 4 == 3: s.raw(B + 3.5, chirp(3, 4800, 0.05), 0.7)
        if b % 8 == 0: s.d(49, B, 90, 0.5, kit=24)
    s.finish('bug-pop.mp3')

def house_variant(name, bpm, prog, bassprog, stab, stabpat, hook, hookprog, extra=None, kit=24, bars=26):
    s = Song(bpm, bars)
    for b in range(s.bars):
        B = b * 4; c = prog[b % len(prog)]; r, _ = chord(c); intro = b < 2
        for i in range(4): s.d(36, B + i, 120, 1.1, kit=kit)
        if not intro:
            s.d(39, B + 1, 100, 0.7, kit=kit); s.d(39, B + 3, 100, 0.7, kit=kit)
            for i in range(4): s.d(46, B + i + 0.5, 80, 0.5, kit=kit); s.d(42, B + i + 0.25, 42, 0.32, kit=kit); s.d(42, B + i + 0.75, 42, 0.32, kit=kit)
            if b % 2: s.d(54, B + 1.75, 70, 0.4, kit=kit)
            bassline(s, bassprog, r, B, b)
        for o in stabpat: comp(s, stab, B + o, c, 0.28, 58, 86, 0.5)
        if 6 <= b < bars - 4 and b % 2 == 0:
            for o, k in hook: s.n(hookprog, k, B + o, 0.35, 88, 0.38)
        if extra: extra(s, b, B, c)
        if b % 4 == 3: s.raw(B + 3.25, chirp(4, 4600, 0.045), 0.6)
        if b % 8 == 7: s.d(49, B + 4, 90, 0.5, kit=kit)
    s.finish(name)
def bassline(s, prog, r, B, b):
    root = 33 + r if r < 7 else 21 + r + 12
    if prog == 'octave':
        for i in range(8): s.n(33, root + (12 if i % 2 else 0), B + i * .5, .4, 100, 1.0)
    elif prog == 'acid':
        pat = [0, 0, 12, 0, 3, 0, 15, 10, 0, 12, 0, 7, 0, 3, 12, 10]
        for i, d in enumerate(pat):
            if i % 4 == 2 and b % 2 == 0: continue
            s.n(39, root + d, B + i * .25, .2, 110 if i % 4 == 0 else 85, 0.75)
    else:
        for i in (0.5, 1.5, 2.5, 3.5): s.n(38, root, B + i, 0.4, 100, 1.0)
        if b % 2: s.n(38, root + 7, B + 3.75, 0.2, 90, 0.8)
def house_deep():
    def pads(s, b, B, c): comp(s, 89, B, c, 4, 55, 60, 0.4)
    house_variant('bug-house-deep-hive.mp3', 120, ['Dm9', 'Dm9', 'Gm9', 'Gm9', 'Bbmaj9', 'Bbmaj9', 'A7', 'A7'], 'deep', 4, (0, 1.5, 2.75),
                  [(0.5, 74), (1, 72), (2, 69), (3, 72)], 11, pads)
def house_disco():
    def strings(s, b, B, c):
        if b % 2 == 1: comp(s, 48, B + 3.5, c, 0.4, 64, 95, 0.45)
        for i in range(8):
            if i % 2: comp(s, 27, B + i * .5, c, 0.12, 60, 70, 0.3)
    house_variant('bug-house-disco-beetle.mp3', 124, ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], 'octave', 0, (1.75, 3.5),
                  [(0, 81), (0.5, 79), (1, 77), (1.5, 76), (2, 77), (3, 72)], 56, strings)
def house_acid():
    house_variant('bug-house-acid-ant.mp3', 126, ['Am', 'Am', 'Am', 'G', 'F', 'F', 'G', 'G'], 'acid', 81, (0.75, 2.25),
                  [(0.5, 69), (1.5, 72), (2.5, 76), (3, 74)], 80, None, kit=25)
def house_piano():
    def organ(s, b, B, c):
        if b >= 10: comp(s, 16, B, c, 3.8, 55, 55, 0.25)
    house_variant('bug-house-piano-moth.mp3', 123, ['C', 'Am7', 'F', 'G', 'C', 'Em7', 'F', 'G'], 'deep', 0, (0, 0.5, 1.25, 1.75, 2.5, 3.0, 3.75),
                  [(0, 79), (0.75, 76), (1.5, 77), (2, 76), (3, 72)], 73, organ)

ALL = dict(hdeep=house_deep, hdisco=house_disco, hacid=house_acid, hpiano=house_piano, jazz=slow_bug_jazz, house=bug_house, step=bugstep, rock=bug_rock, banjo=banjo_bug, pop=bug_pop)
for k in (sys.argv[1:] or ALL): ALL[k]()
