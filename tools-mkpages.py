#!/usr/bin/env python3
"""Build the two artifact pages from the repo.

The app script is published under a content-hashed name (app-<hash>.js). The artifact serves
every publish at the same path otherwise, so a browser that cached app.js keeps running an old
build and new work appears to do nothing. The project hit this before, which is why the earlier
builds used app-vNNN.js. The hash does the same job automatically.
"""
import hashlib, io, json, os

REPO = "/home/claude/repo/app"
PUB, BUYER = "/home/claude/work/pub", "/home/claude/work/buyer"
STATE = "/home/claude/work/pagestate.json"

app = io.open(os.path.join(REPO, "app.js"), "rb").read()
h = hashlib.md5(app).hexdigest()[:10]
name = "app-%s.js" % h

src = io.open(os.path.join(REPO, "index.html"), encoding="utf-8").read()
body = src[src.index('<meta name="theme-color"'):src.rindex("</body>")].rstrip()

tag = '<script defer src="data4.js"></script>'
assert body.count(tag) == 1
body = body.replace(tag, tag + '\n<script defer src="deep.js"></script>', 1)

old_tag = '<script defer src="app.js"></script>'
assert body.count(old_tag) == 1, body.count(old_tag)
body = body.replace(old_tag, '<script defer src="%s"></script>' % name, 1)

io.open(os.path.join(PUB, "index.html"), "w", encoding="utf-8").write(body + "\n")
io.open(os.path.join(BUYER, "index.html"), "w", encoding="utf-8").write(
    body.replace("<title>DrugBug</title>", "<title>DrugBug — buyer's view</title>", 1) + "\n")

prev = {}
if os.path.exists(STATE):
    prev = json.load(io.open(STATE))
old_name = prev.get("app")
json.dump({"app": name}, io.open(STATE, "w"))

files = {name: "app.js"}
if old_name and old_name != name:
    files[old_name] = None          # drop the previous build so versions do not pile up
print(json.dumps({"script": name, "replaces": old_name, "files": files}, indent=1))
