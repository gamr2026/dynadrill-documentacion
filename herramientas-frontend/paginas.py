import os, re, json
sp = os.path.dirname(os.path.abspath(__file__))  # junto a grafo.py y a viejos.json
src = open(os.path.join(sp, 'grafo.py'), encoding='utf-8').read().split('# raíces')[0]
exec(src)
viejos = json.load(open(os.path.join(sp, 'viejos.json'), encoding='utf-8'))
pag = {}
for p in archivos:
    if not p.endswith('.routes.ts'):
        continue
    s = open(p, encoding='utf-8').read()
    modulo = os.path.dirname(os.path.relpath(p, root)).replace(chr(92), '/') or 'raiz'
    for m in re.finditer(r"path:\s*'([^']*)'", s):
        seg = s[m.end():m.end() + 800]
        n = re.search(r"import\(\s*'(\.[^']+)'", seg)
        if n and 'path:' not in seg[:n.start()]:
            b = os.path.normpath(os.path.join(os.path.dirname(p), n.group(1))) + '.ts'
            if b in archivos:
                pag[b] = (modulo, m.group(1))


def alcance(x):
    v = set()
    st = [x]
    while st:
        y = st.pop()
        if y in v:
            continue
        v.add(y)
        st.extend(grafo.get(y, ()))
    return v


res = {}
for pg, (mod, path) in pag.items():
    a = alcance(pg)
    for x in viejos:
        f = os.path.normpath(os.path.join(root, x['archivo']))
        if f in a:
            res.setdefault(x['archivo'], set()).add(f'{mod}/{path}')
for k, v in sorted(res.items()):
    print(k, '<-', sorted(v)[:10])
print('páginas enrutadas', len(pag))
sin = [x['archivo'] for x in viejos if x['archivo'] not in res]
print('API vieja sin página enrutada que la alcance:', sin)

print('=== por página (solo hojas) ===')
leg = {os.path.normpath(os.path.join(root, x['archivo'])): x['archivo'].split('/')[-1] for x in viejos}
for pg, (mod, path) in sorted(pag.items(), key=lambda kv: kv[1]):
    if pg.endswith('.routes.ts'):
        continue
    a = alcance(pg)
    usa = sorted({leg[f] for f in leg if f in a})
    if usa:
        print(f"{mod}/{path} -> {os.path.relpath(pg, root).replace(chr(92), '/')} :: {', '.join(usa)}")
