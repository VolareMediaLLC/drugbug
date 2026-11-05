"""Minimal SoundFont 2 reader + note renderer (numpy)."""
import struct, numpy as np
SR = 44100
class SF2:
    def __init__(s, path):
        d = open(path, 'rb').read(); s.d = d
        def chunks(off, end):
            while off < end:
                cid = d[off:off+4]; ln = struct.unpack('<I', d[off+4:off+8])[0]
                yield cid, off+8, ln
                off += 8 + ln + (ln & 1)
        assert d[:4] == b'RIFF'
        for cid, o, ln in chunks(12, len(d)):
            if cid == b'LIST':
                typ = d[o:o+4]
                for c2, o2, l2 in chunks(o+4, o+ln):
                    if typ == b'sdta' and c2 == b'smpl': s.smpl = np.frombuffer(d[o2:o2+l2], dtype='<i2').astype(np.float32) / 32768.0
                    if typ == b'pdta': setattr(s, c2.decode(), (o2, l2))
        def recs(name, fmt):
            o, l = getattr(s, name); sz = struct.calcsize(fmt)
            return [struct.unpack(fmt, d[o+i*sz:o+(i+1)*sz]) for i in range(l // sz)]
        s.phdr = recs('phdr', '<20sHHHIII'); s.pbag = recs('pbag', '<HH'); s.pgen = recs('pgen', '<HH')
        s.inst = recs('inst', '<20sH'); s.ibag = recs('ibag', '<HH'); s.igen = recs('igen', '<HH')
        s.shdr = recs('shdr', '<20sIIIIIbbHH')
        s.cache = {}
    def gens(s, gl, bags, i):
        out = {}
        for g in range(bags[i][0], bags[i+1][0]):
            op, amt = gl[g]; out[op] = amt
        return out
    def zones(s, bank, prog):
        key = (bank, prog)
        if key in s.cache: return s.cache[key]
        pi = None
        for i, p in enumerate(s.phdr[:-1]):
            if p[2] == bank and p[1] == prog: pi = i; break
        if pi is None:
            for i, p in enumerate(s.phdr[:-1]):
                if p[2] == bank: pi = i; break
        res = []
        pz = range(s.phdr[pi][3], s.phdr[pi+1][3])
        pglob = {}
        for zi, b in enumerate(pz):
            pg = s.gens(s.pgen, s.pbag, b)
            if 41 not in pg:
                if zi == 0: pglob = pg
                continue
            pg = {**pglob, **pg}
            ii = pg[41]; iz = range(s.inst[ii][1], s.inst[ii+1][1]); iglob = {}
            for zj, ib in enumerate(iz):
                ig = s.gens(s.igen, s.ibag, ib)
                if 53 not in ig:
                    if zj == 0: iglob = ig
                    continue
                ig = {**iglob, **ig}
                kr = ig.get(43, pg.get(43, 0x7F00)); lo, hi = kr & 255, kr >> 8
                pk = pg.get(43); 
                if pk is not None:
                    plo, phi = pk & 255, pk >> 8; lo, hi = max(lo, plo), min(hi, phi)
                sh = s.shdr[ig[53]]
                name, st, en, ls, le, rate, opk, corr, link, typ = sh
                st += ig.get(0, 0) + 32768 * ig.get(4, 0); en += ig.get(1, 0) + 32768 * ig.get(12, 0)
                ls += ig.get(2, 0) + 32768 * ig.get(45, 0); le += ig.get(3, 0) + 32768 * ig.get(50, 0)
                root = ig.get(58, opk) if ig.get(58, 0xFFFF) != 0xFFFF and 58 in ig else opk
                def s16(v): return v - 65536 if v > 32767 else v
                tune = s16(ig.get(51, 0)) + s16(pg.get(51, 0)) + (s16(ig.get(52, 0)) + s16(pg.get(52, 0))) / 100.0 + corr / 100.0
                att = (ig.get(48, 0) + pg.get(48, 0)) / 10.0
                rel = s16(ig.get(38, -12000)) ; rel = 2 ** (rel / 1200.0)
                mode = ig.get(54, 0) & 3
                pan = s16(ig.get(17, 0)) / 500.0
                res.append(dict(lo=lo, hi=hi, st=st, en=en, ls=ls, le=le, rate=rate, root=root, tune=tune, att=att, rel=min(max(rel, 0.03), 3.0), loop=mode in (1, 3), pan=pan))
        s.cache[key] = res
        return res
    def note(s, bank, prog, key, vel, dur, rel=None):
        Z = [z for z in s.zones(bank, prog) if z['lo'] <= key <= z['hi']]
        if not Z: return np.zeros((2, 1), np.float32)
        out = None
        for z in Z[:2]:
            ratio = 2 ** ((key - z['root'] + z['tune']) / 12.0) * z['rate'] / SR
            r = z['rel'] if rel is None else rel
            n = int((dur + r) * SR)
            pos = np.arange(n) * ratio
            seg = s.smpl[z['st']:z['en']]
            if z['loop'] and z['le'] > z['ls']:
                a, b = z['ls'] - z['st'], z['le'] - z['st']; L = b - a
                over = pos >= b; pos[over] = a + np.mod(pos[over] - a, L)
            else:
                pos = pos[pos < len(seg) - 1]; n = len(pos)
                if n == 0: continue
            i0 = pos.astype(np.int64); fr = pos - i0
            i1 = np.minimum(i0 + 1, len(seg) - 1)
            w = seg[i0] * (1 - fr) + seg[i1] * fr
            env = np.ones(n, np.float32)
            atk = min(n, int(0.004 * SR)); env[:atk] = np.linspace(0, 1, atk)
            ds = int(dur * SR)
            if ds < n:
                env[ds:] *= np.exp(-np.arange(n - ds) / (max(r, 0.02) * SR / 4.6))
            g = (vel / 127.0) ** 2 * 10 ** (-z['att'] / 20.0)
            w = w * env * g
            pl = 0.5 - z['pan'] * 0.5
            st = np.vstack([w * np.sqrt(pl), w * np.sqrt(1 - pl)])
            if out is None: out = st
            else:
                m = max(out.shape[1], st.shape[1]); o2 = np.zeros((2, m), np.float32); o2[:, :out.shape[1]] += out; o2[:, :st.shape[1]] += st; out = o2
        return out if out is not None else np.zeros((2, 1), np.float32)

class Mix:
    def __init__(s, sec): s.buf = np.zeros((2, int(sec * SR) + SR * 4), np.float32)
    def add(s, t, a, gain=1.0, pan=0.0):
        i = int(t * SR); a = a * gain
        if i < 0: a = a[:, -i:]; i = 0
        if pan: a = np.vstack([a[0] * min(1, 1 - pan), a[1] * min(1, 1 + pan)])
        e = min(s.buf.shape[1], i + a.shape[1]); s.buf[:, i:e] += a[:, :e - i]
