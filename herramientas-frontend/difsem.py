import os, re, difflib

demo = os.path.join(os.environ['TEMP'], 'demo-src', 'src', 'app')
nuevo = r'C:\Users\Digitec\Documents\proyectos\dynadrill\dynadrill-frontend-int\src\app'


def norm(s):
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'(?m)//.*$', '', s) if False else s
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s*([{};:,>()=])\s*', r'\1', s)
    s = s.replace('"', "'")
    return s.strip()


res = []
for ext in ('.html', '.scss'):
    for d, _, fs in os.walk(demo):
        for f in fs:
            if not f.endswith(ext):
                continue
            p = os.path.join(d, f)
            rel = os.path.relpath(p, demo)
            q = os.path.join(nuevo, rel)
            if not os.path.exists(q):
                res.append((10**6, rel, 'NO EXISTE'))
                continue
            a = norm(open(p, encoding='utf-8', errors='ignore').read())
            b = norm(open(q, encoding='utf-8', errors='ignore').read())
            if a != b:
                r = difflib.SequenceMatcher(None, a, b, autojunk=False).quick_ratio()
                # tamaño del cambio en caracteres (aprox.)
                cambio = abs(len(a) - len(b)) + int((1 - r) * max(len(a), len(b)))
                res.append((cambio, rel.replace('\\', '/'), f'{len(a)} -> {len(b)} caracteres'))
res.sort(reverse=True)
print('archivos con diferencia real (tras normalizar el formato):', len(res))
for c, rel, info in res[:40]:
    print(c, rel, info)
