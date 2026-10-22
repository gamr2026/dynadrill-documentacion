# BRIEF S1: QHSE-A (Desechos, Derrames, Emergencias)

## Prompt de arranque

Abra Claude Code en `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s1` y pegue:

```
Usted es la sesión S1 del plan de sesiones paralelas de Dynadrill. Trabaje SOLO en esta carpeta (rama sesion/s1-qhse-a).
Lea C:/Users/Digitec/Documents/proyectos/documentacion/modulos/sesiones/BRIEF-S1.md y siga sus instrucciones y las reglas de
C:/Users/Digitec/Documents/proyectos/documentacion/modulos/PLAN-SESIONES-PARALELAS.md. Responda en español con «usted». Empiece por la mini-especificación
y el plan de rebanadas de su primer subdominio y espere la aprobación del usuario antes de construir.
```

## Datos de la sesión

- Carpeta de trabajo: `C:/Users/Digitec/Documents/proyectos/dynadrill-platform-s1` · rama: `sesion/s1-qhse-a` · módulo para `commit-modulo.ps1`: `qhse`
- Código principal: `libs/qhse/seguridad`
- Antes de la primera prueba: `npx nx run <proyecto>:prisma-generate` (los clientes generados no se versionan).

## Cómo trabajar (obligatorio)

Lea primero, en este orden: `documentacion/modulos/PLAN-SESIONES-PARALELAS.md` (reglas §4 y §5: son obligatorias), `documentacion/modulos/PENDIENTES-DE-MIGRACION.md` (§0 y la sección de su módulo), `documentacion/modulos/00-CONTEXTO-COMPARTIDO.md` y `01-REGLAS-DE-COORDINACION.md`, y el plan de su módulo. Luego siga el flujo del §4 del plan con las skills instaladas (`using-agent-skills`, `spec-driven-development` corto, `planning-and-task-breakdown`, `incremental-implementation` + `test-driven-development`, `doubt-driven-development` en migraciones, `code-review-and-quality`).

**Primera entrega:** la mini-especificación y el plan de rebanadas de su primer subdominio. **Muéstrela al usuario y espere su aprobación** antes de escribir migraciones o código.

## Alcance (en este orden de prioridad)

1. **Desechos** (`Desecho`): peligroso / no peligroso con características CRETIB, contenedor por color, **límite de almacenamiento de 12 meses** (AM 142), manifiesto con tres firmas, certificado. Catálogos de característica, contenedor y estado como tablas; firmas en tabla inmutable; usar el OCR de firmas cuando se cargue el documento firmado (D6).
2. **Derrames** (`DerrameEvento`): alerta por volumen y ubicación, checklist de contención de 5 minutos, notificación obligatoria al MAE; un derrame en suelo **genera un desecho** (mismo esquema `qhse`: FK real). **Los umbrales de las bandas son un supuesto de la demo: modélelos como datos configurables (tabla de bandas) y deje los valores marcados «por confirmar con Dynadrill»; no los dé por definitivos.**
3. **Emergencias / MEDEVAC** (`EmergenciaEvento`): activación con cronómetro, nivel 1–3, conteo de personal (locación, evacuados, faltantes), triage médico por color, signos vitales, notificación a hospital; vínculo SWA ↔ emergencia.

## Planes y documentos de referencia

- `documentacion/modulos/plan-qhse.md` (tramos Q4, Q5 y Q6) y `documentacion/qhse/` (documentos de origen).
- Demo de referencia: modelos `Desecho`, `DerrameEvento` y `EmergenciaEvento` en `dynadrill-backend`, y las pantallas en `dynadrill/dynadrill-frontend/src/app/features/qhse`.

## Reglas específicas de esta sesión

- Todo vive en `libs/qhse/seguridad` (esquema `qhse`); API bajo `/api/v2/qhse`; eventos con prefijo `qhse.`.
- Migraciones con marca de tiempo posterior a `20261023120000` (la última): use `2026102410xxxx` en adelante.
- Plantillas de avisos (límite de desechos próximo, notificación al MAE pendiente) mediante el módulo de Avisos de la plataforma, no un servicio aparte.
- No toque las tablas de S2 (investigaciones, legales, objetivos, aspectos). S2 trabaja en la misma lib: en los archivos compartidos (módulo Nest, índice, `permissions.ts`) solo agregue su bloque al final.

## Criterio de «terminado» por subdominio

Migración aplicada en base vacía · semilla de catálogos · API con permisos en `permissions.ts` · eventos por outbox · pruebas de integración en verde (reglas de la base incluidas) · `PENDIENTES-DE-MIGRACION.md` actualizado (hecho / falta / qué necesitará el frontend) · commit con `commit-modulo.ps1`.

## Frontend (segunda parte: solo después del backend)

**Orden:** primero todo su backend, hasta la hora de corte. Después, en el último bloque, adapte el frontend de los subdominios que quedaron **terminados, probados y commiteados**. Lo que no alcance queda anotado en `PENDIENTES-DE-MIGRACION.md` como pendiente de frontend. La sesión principal se encarga de las pantallas cuyo backend ya existía antes de hoy (Despachos de Bodega, Códigos por cliente de FCR, corte de Facturación a `/api/comercial`, catálogos a `/api/v2/catalogos`): **no las toque**.

**Dónde:** `C:/Users/Digitec/Documents/proyectos/dynadrill/dynadrill-frontend-merge` (rama de trabajo `integracion/fusion-front`; es la copia adaptada del frontend, **su `origin` es la demo: NUNCA empujar a `origin`**). Se edita en esa carpeta, sin cambiar de rama.

**Cómo se entrega:** rama propia `modulo/s1-front` (ya creada) con el script, desde la carpeta del frontend, solo con rutas propias:
`..\..\dynadrill-platform\scripts\commit-modulo.ps1 -Modulo s1-front -Mensaje "feat(...): ..." -Rutas <rutas propias> -Subir -Remoto respaldo`
(el script crea el commit en `modulo/s1-front` sin tocar la rama actual; la sesión principal la fusiona en `integracion/fusion-front`).

**Reglas de frontend (obligatorias):**
- **Diseño idéntico al de la demo, en escritorio y móvil.** No invente diseño ni haga «copy-pages sin estilos»: tome los componentes y estilos de la pantalla de la demo (`dynadrill/dynadrill-frontend/src/app/features/...`) y cambie solo los datos y la lógica para usar el backend nuevo (`/api/v2/qhse`, `/api/operaciones/...`, `/api/comercial`, `/api/plataforma/...`; ids UUID). Antes de agregar algo, confirme en la demo que es parte del flujo.
- Texto en español neutro con **«usted»**, nunca voseo (también en mensajes de error y botones).
- Angular del proyecto: componentes standalone con `ChangeDetectionStrategy.OnPush`, señales, `input()`/`output()`, flujo de control nativo (`@if`, `@for`), formularios reactivos, accesibilidad AA. Retire el servicio de la demo que la pantalla reemplaza.
- **Archivos compartidos del frontend** (`app.routes`, `qhse.routes.ts`, `navigation.service.ts`, modelos y servicios comunes): solo agregue su bloque; **no los incluya en su commit** (el script formatearía y llevaría los cambios de otras sesiones): avise a la sesión principal qué cambió y ella los commitea.
- Verificación: `npx ngc --noEmit -p tsconfig.app.json` (no valida SCSS: use `npx sass --no-source-map archivo.scss`), `npx ng test --watch=false --include='<ruta>'`. **No use el navegador (Playwright) ni levante `ng serve`**: son del usuario y de la sesión principal; pida al usuario que revise la pantalla.
- Solo formatee (`prettier`) sus propias rutas.

**Pantallas de su alcance:**
- `features/qhse/desechos`, `features/qhse/derrames`, `features/qhse/emergencias` (y su entrada en el menú y en el tablero de QHSE cuando exista el dato).
- Avisos visibles al usuario de desechos (límite de 12 meses) y de derrames (notificación al MAE).
