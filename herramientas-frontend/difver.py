import os, re, sys, difflib

demo = os.path.join(os.environ['TEMP'], 'demo-src', 'src', 'app')
nuevo = r'C:\Users\Digitec\Documents\proyectos\dynadrill\dynadrill-frontend-int\src\app'


def norm(s):
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s*([{};:,>()=])\s*', r'\1', s)
    s = s.replace('"', "'")
    return s


def trozos(s):
    # separa por etiquetas/bloques para que el diff sea legible
    return re.split(r'(?<=[>;}])', s)


for rel in sys.argv[1:]:
    a = trozos(norm(open(os.path.join(demo, rel), encoding='utf-8', errors='ignore').read()))
    b = trozos(norm(open(os.path.join(nuevo, rel), encoding='utf-8', errors='ignore').read()))
    print('=====', rel)
    for linea in difflib.unified_diff(a, b, lineterm='', n=0):
        if linea.startswith(('---', '+++', '@@')):
            continue
        print(linea[:230])
