"""Make one-time gift codes compatible with app.js giftFind()/agpDecrypt() (owner, Nov 5 2026).
Usage: python3 tools/gifts_once.py N DAYS LABEL  -> appends N items to DB.GIFTS in app/data4.js and
writes the plaintext codes to tools/gift-codes-once.json (never shipped)."""
import base64, hashlib, json, os, re, secrets, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "data4.js")
ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
def sha(b): return hashlib.sha256(b).digest()
def norm(c): return re.sub(r"[^A-Z0-9]", "", c.upper())
def key(code, salt, n):
    k = sha(salt + norm(code).encode())
    for _ in range(1, n): k = sha(k + salt)
    return k
def encrypt(obj, k0):
    nonce = secrets.token_bytes(16); k = sha(k0 + nonce); pt = json.dumps(obj, separators=(",", ":")).encode()
    ct = bytearray(len(pt))
    for o in range(0, len(pt), 32):
        ks = sha(k + (o // 32).to_bytes(4, "big"))
        for j in range(min(32, len(pt) - o)): ct[o + j] = pt[o + j] ^ ks[j]
    tag = sha(k + b"tag" + bytes(ct))[:16]
    b = lambda x: base64.b64encode(x).decode()
    return {"nonce": b(nonce), "ct": b(bytes(ct)), "tag": b(tag)}
def main():
    n, days, label = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    src = open(DATA, encoding="utf-8").read()
    m = re.search(r"DB\.GIFTS = (\{.*?\});\s*$", src, re.M | re.S)
    G = json.loads(m.group(1)); salt = base64.b64decode(G["salt"])
    out = []
    for i in range(n):
        code = "TRY%d-" % days + "".join(secrets.choice(ALPH) for _ in range(6))
        gid = "once-%s-%s" % (label, secrets.token_hex(4))
        G["items"].append(encrypt({"id": gid, "pro": days, "once": True}, key(code, salt, G["n"])))
        out.append({"code": code, "id": gid, "pro_days": days})
    src = src[:m.start(1)] + json.dumps(G) + src[m.end(1):]
    open(DATA, "w", encoding="utf-8").write(src)
    p = os.path.join(ROOT, "tools", "gift-codes-once.json")
    old = json.load(open(p)) if os.path.exists(p) else []
    json.dump(old + out, open(p, "w"), indent=1)
    for o in out: print(o["code"])
main()
