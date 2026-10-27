import os, re, json, sys
root = r'C:\Users\Digitec\Documents\proyectos\dynadrill\dynadrill-frontend-int\src\app'
archivos = {}
for d, _, fs in os.walk(root):
    for f in fs:
        if f.endswith('.ts') and not f.endswith('.spec.ts'):
            archivos[os.path.normpath(os.path.join(d, f))] = None
imp = re.compile(r"""(?:from\s+|import\s*\(\s*)['"](\.{1,2}/[^'"]+)['"]""")
alias = re.compile(r"""from\s+['"]@env['"]""")
grafo = {}
for p in archivos:
    s = open(p, encoding='utf-8', errors='ignore').read()
    deps = set()
    for m in imp.finditer(s):
        base = os.path.normpath(os.path.join(os.path.dirname(p), m.group(1)))
        for cand in (base + '.ts', os.path.join(base, 'index.ts')):
            if cand in archivos:
                deps.add(cand)
                break
    # plantillas / estilos: templateUrl no aporta imports TS, pero los componentes usados en la plantilla se importan en `imports: [..]` (ya cubierto)
    grafo[p] = deps
# raíces: main.ts, app.* y todos los *.routes.ts
raices = [p for p in archivos if os.path.basename(p) in ('app.ts', 'app.config.ts', 'app.routes.ts') or p.endswith('.routes.ts')]
vistos = set()
pila = list(raices)
while pila:
    x = pila.pop()
    if x in vistos:
        continue
    vistos.add(x)
    pila.extend(grafo.get(x, ()))
# servicios/archivos que apuntan a una API vieja (no v2, no comercial, no operaciones, no firmas, no encuestas, no users/roles...)
nuevo = ('v2/', 'comercial', 'operaciones', 'firmas', 'encuestas', 'users', 'roles', 'auditoria', 'archivos', 'auth', 'avisos', 'integraciones', 'catalogos', 'as2', 'permisos')
url = re.compile(r"environment\.apiUrl\}/([a-zA-Z0-9_/\-]*)")
viejos = {}
for p in archivos:
    s = open(p, encoding='utf-8', errors='ignore').read()
    for m in url.finditer(s):
        ruta = m.group(1)
        if ruta.startswith(nuevo):
            continue
        viejos.setdefault(p, set()).add(ruta)
sal = []
for p, rutas in sorted(viejos.items()):
    rel = os.path.relpath(p, root).replace('\\', '/')
    # quién lo importa (directo) y si es alcanzable desde las rutas
    importadores = [os.path.relpath(q, root).replace('\\', '/') for q, ds in grafo.items() if p in ds]
    sal.append({'archivo': rel, 'rutas': sorted(rutas), 'alcanzable': p in vistos, 'importadores': sorted(importadores)[:6]})
json.dump(sal, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(sal), 'archivos con API vieja;', sum(1 for x in sal if x['alcanzable']), 'alcanzables desde las rutas')
