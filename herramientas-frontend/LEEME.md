# Herramientas del frontend (scripts de apoyo)

Scripts de Python (sin dependencias externas) que se usaron para comparar el frontend nuevo con la demo y para saber qué pantallas siguen
usando la API vieja. Tienen rutas de la máquina de trabajo escritas al inicio (`C:\Users\Digitec\Documents\proyectos\...`); ajústelas si
trabaja en otra. Ejecútelos con `python <script>`; ninguno modifica archivos del proyecto.

| Script | Para qué sirve |
|---|---|
| `difsem.py` | Compara cada `.html` y `.scss` de la demo con el del frontend nuevo **normalizando el formato** (espacios, saltos de línea, comentarios) y lista los archivos que difieren de verdad, de mayor a menor diferencia. Es el punto de partida de la paridad visual. |
| `difver.py <ruta relativa> ...` | Muestra el diff legible de uno o varios archivos concretos (por ejemplo `features/maintenance/components/order-detail-panel.html`). |
| `grafo.py <salida.json>` | Recorre los imports de `src/app` y guarda qué archivos llaman a una API **vieja** (la de la demo: ids numéricos, prefijos como `/api/qhse`, `/api/unidades`, `/api/facturacion`, `/api/operations`). |
| `paginas.py` | Usa lo anterior y dice **qué páginas con ruta** (las que el usuario puede abrir) alcanzan esos servicios viejos. Es el inventario de lo que falta migrar. Necesita haber corrido `grafo.py` antes y que su salida se llame `viejos.json` junto a los scripts (`python grafo.py viejos.json`). |

## Cómo sacar el código de la demo para comparar

La demo es la rama `main` del remoto `origin` del repositorio del frontend
(`https://github.com/DIGITEC-IT-PROJECTS/dynadrill-frontend.git`). El remoto `respaldo` es el frontend nuevo
(`https://github.com/gamr2026/dynadrill-frontend-platform.git`).

```bash
cd <copia de trabajo del frontend>
git fetch origin
mkdir -p "$TEMP/demo-src" && git archive origin/main | tar -x -C "$TEMP/demo-src"
```

Los scripts `difsem.py` y `difver.py` leen la demo de `%TEMP%\demo-src\src\app`.

## Qué dejan ver y qué no

- Miden **estructura** (HTML) y **estilos** (SCSS). No miden datos ni comportamiento: eso se prueba en el navegador.
- Una diferencia que ellos marcan puede ser buena (un diálogo más completo, un botón que depende de un permiso). Cada una se decide a mano.
- `paginas.py` atribuye a una página todo lo que alcanza por imports; si un servicio viejo aparece solo por un componente compartido, hay que
  mirar el componente antes de concluir que la página entera sigue en la demo.
