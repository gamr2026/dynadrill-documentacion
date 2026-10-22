# BRIEF S2: QHSE-B (Investigación, Legales, Objetivos y Aspectos, Avisos)

## Prompt de arranque

Abra Claude Code en `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s2` y pegue:

```
Usted es la sesión S2 del plan de sesiones paralelas de Dynadrill. Trabaje SOLO en esta carpeta (rama sesion/s2-qhse-b).
Lea C:/Users/Digitec/Documents/proyectos/documentacion/modulos/sesiones/BRIEF-S2.md y siga sus instrucciones y las reglas de
C:/Users/Digitec/Documents/proyectos/documentacion/modulos/PLAN-SESIONES-PARALELAS.md. Responda en español con «usted». Empiece por la mini-especificación
y el plan de rebanadas de su primer subdominio y espere la aprobación del usuario antes de construir.
```

## Datos de la sesión

- Carpeta de trabajo: `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s2` · rama: `sesion/s2-qhse-b` · módulo para `commit-modulo.ps1`: `qhse`
- Código principal: `libs/qhse/seguridad`
- Antes de la primera prueba: `npx nx run <proyecto>:prisma-generate` (los clientes generados no se versionan).

## Cómo trabajar (obligatorio)

Lea primero, en este orden: `documentacion/modulos/PLAN-SESIONES-PARALELAS.md` (reglas §4 y §5: son obligatorias), `documentacion/modulos/PENDIENTES-DE-MIGRACION.md` (§0 y la sección de su módulo), `documentacion/modulos/00-CONTEXTO-COMPARTIDO.md` y `01-REGLAS-DE-COORDINACION.md`, y el plan de su módulo. Luego siga el flujo del §4 del plan con las skills instaladas (`using-agent-skills`, `spec-driven-development` corto, `planning-and-task-breakdown`, `incremental-implementation` + `test-driven-development`, `doubt-driven-development` en migraciones, `code-review-and-quality`).

**Primera entrega:** la mini-especificación y el plan de rebanadas de su primer subdominio. **Muéstrela al usuario y espere su aprobación** antes de escribir migraciones o código.

## Alcance (en este orden de prioridad)

1. **Investigación de incidentes** (`Investigacion`, DYN-SGI-RE-034): Near Miss / Leve / Grave / Fatal (plazo de 30 días para Near Miss), 5 Porqués, Ishikawa, acciones correctivas y preventivas. 5 Porqués y causas de Ishikawa como **filas**, no JSON; estados e historia inmutable.
2. **Requisitos legales** (`DocumentoLegalQhse`): registro y vigencia; el documento por el servicio de archivos.
3. **Objetivos ambientales** (`ObjetivoAmbiental`) y **Aspectos ambientales** (`AspectoAmbiental`, matriz de aspectos e impactos), con seguimiento.
4. **Avisos de QHSE**: alertas agregadas (vencimientos de ART, requisitos legales por vencer, inspecciones vencidas, plazos de investigación) resueltas con **reglas y plantillas del módulo de Avisos** de la plataforma, no con un servicio aparte. No incluya el aviso de límite de desechos (es de S1).

## Planes y documentos de referencia

- `documentacion/modulos/plan-qhse.md` y `documentacion/qhse/`.
- Demo: modelos `Investigacion`, `DocumentoLegalQhse`, `ObjetivoAmbiental`, `AspectoAmbiental` en `dynadrill-backend`, y `qhse-avisos-feeder.service` del frontend.

## Reglas específicas de esta sesión

- Todo vive en `libs/qhse/seguridad` (esquema `qhse`), igual que S1: en los archivos compartidos (módulo Nest, índice, `permissions.ts`) solo agregue su bloque al final.
- Migraciones: `2026102411xxxx` en adelante (posteriores a `20261023120000`).
- No toque las tablas de S1 (desechos, derrames, emergencias).
- El dashboard HSE-MASTER-001 (TRIR, LTIR, etc.) queda para la sesión principal cuando S1 y S2 terminen sus tablas: deje documentado qué columnas y eventos necesitará.

## Criterio de «terminado» por subdominio

Migración aplicada en base vacía · semilla de catálogos · API con permisos en `permissions.ts` · eventos por outbox · pruebas de integración en verde (reglas de la base incluidas) · `PENDIENTES-DE-MIGRACION.md` actualizado (hecho / falta / qué necesitará el frontend) · commit con `commit-modulo.ps1`.

## Frontend (segunda parte: solo después del backend)

**Orden:** primero todo su backend, hasta la hora de corte. Después, en el último bloque, adapte el frontend de los subdominios que quedaron **terminados, probados y commiteados**. Lo que no alcance queda anotado en `PENDIENTES-DE-MIGRACION.md` como pendiente de frontend. La sesión principal se encarga de las pantallas cuyo backend ya existía antes de hoy (Despachos de Bodega, Códigos por cliente de FCR, corte de Facturación a `/api/comercial`, catálogos a `/api/v2/catalogos`): **no las toque**.

**Dónde:** `C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-merge` (rama de trabajo `integracion/fusion-front`; es la copia adaptada del frontend, **su `origin` es la demo: NUNCA empujar a `origin`**). Se edita en esa carpeta, sin cambiar de rama.

**Cómo se entrega:** rama propia `modulo/s2-front` (ya creada) con el script, desde la carpeta del frontend, solo con rutas propias:
`..\..\dynadrill-platform\scripts\commit-modulo.ps1 -Modulo s2-front -Mensaje "feat(...): ..." -Rutas <rutas propias> -Subir -Remoto respaldo`
(el script crea el commit en `modulo/s2-front` sin tocar la rama actual; la sesión principal la fusiona en `integracion/fusion-front`).

**Reglas de frontend (obligatorias):**
- **Diseño idéntico al de la demo, en escritorio y móvil.** No invente diseño ni haga «copy-pages sin estilos»: tome los componentes y estilos de la pantalla de la demo (`dynadrill/dynadrill-frontend/src/app/features/...`) y cambie solo los datos y la lógica para usar el backend nuevo (`/api/v2/qhse`, `/api/operaciones/...`, `/api/comercial`, `/api/plataforma/...`; ids UUID). Antes de agregar algo, confirme en la demo que es parte del flujo.
- Texto en español neutro con **«usted»**, nunca voseo (también en mensajes de error y botones).
- Angular del proyecto: componentes standalone con `ChangeDetectionStrategy.OnPush`, señales, `input()`/`output()`, flujo de control nativo (`@if`, `@for`), formularios reactivos, accesibilidad AA. Retire el servicio de la demo que la pantalla reemplaza.
- **Archivos compartidos del frontend** (`app.routes`, `qhse.routes.ts`, `navigation.service.ts`, modelos y servicios comunes): solo agregue su bloque; **no los incluya en su commit** (el script formatearía y llevaría los cambios de otras sesiones): avise a la sesión principal qué cambió y ella los commitea.
- Verificación: `npx ngc --noEmit -p tsconfig.app.json` (no valida SCSS: use `npx sass --no-source-map archivo.scss`), `npx ng test --watch=false --include='<ruta>'`. **No use el navegador (Playwright) ni levante `ng serve`**: son del usuario y de la sesión principal; pida al usuario que revise la pantalla.
- Solo formatee (`prettier`) sus propias rutas.

**Pantallas de su alcance:**
- `features/qhse/investigaciones`, `features/qhse/legal`, `features/qhse/objetivos-ambientales`, `features/qhse/aspectos-ambientales`.
- Retirar el `qhse-avisos-feeder.service` de la demo cuando los avisos de QHSE salgan del módulo de Avisos de la plataforma.
